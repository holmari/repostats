import path from 'path';

import {iterEachFile} from '../../file/utils';
import {
  DateInterval,
  RepoConfig,
  ReviewComment,
  Change,
  UserRepoTotals,
  AuthoredTotals,
  ReceivedTotals,
  ReviewsSummary,
  GithubConnector,
  CountByDay,
  ReviewSummariesByDay,
} from '../../types/types';
import {
  getGithubCommentsPath,
  getGithubCommitsPath,
  getGithubPullsPath,
  getGithubReviewsPath,
  getGithubTeamMembersPath,
} from './paths';

import {PullRequest, Comment, User, Review, Commit} from '../../types/github';
import {
  createInterval,
  EMPTY_INTERVAL,
  getIntervalDuration,
  intersects,
  sliceDate,
  singleDateInterval,
} from '../../date/utils';
import {NormalizedAnalyzeRequest} from '../analysis';
import {createDefaultUserRepoTotals, createIntermediateAnalyzeResult} from '../analysis/utils';
import {removeDuplicates} from '../../collections/utils';
import {
  CommentsByDateAndUserId,
  IntermediateAnalyzeResult,
  IntermediateUserResult,
  ReviewRequestsByDateAndUserId,
  ReviewSummariesByDateAndUserId,
} from '../analysis/types';
import {getPullRequestNumberFromUrl} from './utils';

type PullsByNumber = {readonly [prNumber: string]: PullRequest};
type TeamMembersBySlug = {readonly [teamSlug: string]: ReadonlyArray<User>};

const DEFAULT_REVIEW_SUMMARIES: ReviewsSummary = {approvals: 0, rejections: 0};
interface GithubComputeContext {
  readonly repoConfig: RepoConfig<GithubConnector>;

  readonly getPull: (pullNumber: string | number) => PullRequest | null;
  readonly matchesDateFilter: (interval: DateInterval | string | null) => boolean;
  readonly acquireUserResult: (user: User) => IntermediateUserResult;
  readonly adjustUserResult: (newUserResult: IntermediateUserResult) => void;
}

function createUserResult(user: User): IntermediateUserResult {
  return {
    id: `${user.id}`,
    displayName: user.login,
    possibleRealNameCounts: {},
    emailAddresses: [],
    url: user.html_url,
    repoTotalsByDay: {},
    commentsAuthored: [],
    changesAuthored: [],
    authoredReviewsByDateAndUserId: {},
    reviewRequestsAuthoredByDateAndUserId: {},
    reviewRequestsReceivedByDateAndUserId: {},
    commentsWrittenByDateAndUserId: {},
    commentsReceivedByDateAndUserId: {},
    reviewsReceivedByDateAndUserId: {},
    commentsAuthoredPerChangeByDateAndUserId: {},
    commentsAuthoredByDay: {},
    commentsReceivedByDay: {},
    changesAuthoredByDay: {},
    commitsAuthoredByDay: {},
    reviewsAuthoredByDay: {},
    reviewsReceivedByDay: {},
  };
}

function toReviewComment(comment: Comment, pull: PullRequest | null): ReviewComment | null {
  if (!comment.body || !pull || !comment.user) {
    return null;
  }

  return {
    authorId: comment.user.id,
    comment: comment.body,
    createdAt: comment.created_at,
    reviewUrl: comment.pull_request_url,
    reviewCommentUrl: comment.html_url,
    recipientUserId: pull.user?.login || null,
    reviewTitle: pull.title,
  };
}

function fromReviewToComment(
  review: Review,
  recipientUserId: string | null,
  reviewTitle: string
): ReviewComment | null {
  if (!review.body) {
    return null;
  }

  return {
    createdAt: review.submitted_at,
    authorId: review.user.id,
    comment: review.body,
    reviewUrl: review.pull_request_url,
    reviewCommentUrl: review.html_url,
    recipientUserId: recipientUserId,
    reviewTitle,
  };
}

function getPullRequestInterval(pull: PullRequest | null): DateInterval | null {
  if (!pull) {
    return EMPTY_INTERVAL;
  }

  // This has the side effect that updates to PRs after merges are not included.
  // Often, they're not relevant and can be ruled out.
  if (pull.merged_at) {
    return createInterval(pull.created_at, pull.merged_at);
  } else if (pull.closed_at) {
    return createInterval(pull.created_at, pull.closed_at);
  }
  return createInterval(pull.created_at, pull.updated_at);
}

function toChange(repoName: string, pullRequest: PullRequest): Change {
  const interval: DateInterval | null = getPullRequestInterval(pullRequest);
  const timeOpenMsec = getIntervalDuration(interval, 'milliseconds');

  return {
    repoName,
    reviewUrl: pullRequest.html_url,
    createdAt: pullRequest.created_at,
    title: pullRequest.title,
    timeOpenMsec,
  };
}

function assertOneRepoTotalsExists(totals: ReadonlyArray<UserRepoTotals>) {
  if (totals.length !== 1) {
    throw new Error(
      `Assertion failed: expected only one repo to exist, but was ${JSON.stringify(totals)}`
    );
  }
}

function incrementAuthoredTotals(
  userResult: IntermediateUserResult,
  adjustments: Partial<AuthoredTotals>,
  date: string | undefined | null,
  repoName: string
): {readonly [date: string]: ReadonlyArray<UserRepoTotals>} {
  if (!date) {
    return userResult.repoTotalsByDay;
  }

  const totalsAtDate = userResult.repoTotalsByDay[date] ?? [createDefaultUserRepoTotals(repoName)];
  assertOneRepoTotalsExists(totalsAtDate);

  const authoredTotals = totalsAtDate[0].authoredTotals;

  const newTotals: UserRepoTotals = {
    ...totalsAtDate[0],
    authoredTotals: {
      approvals: authoredTotals.approvals + (adjustments.approvals || 0),
      changesCreated: authoredTotals.changesCreated + (adjustments.changesCreated || 0),
      rejections: authoredTotals.rejections + (adjustments.rejections || 0),
      commentsWrittenTotal:
        authoredTotals.commentsWrittenTotal + (adjustments.commentsWrittenTotal || 0),
      commentsWrittenToOthers:
        authoredTotals.commentsWrittenToOthers + (adjustments.commentsWrittenToOthers || 0),
      commits: authoredTotals.commits + (adjustments.commits || 0),
      meanChangeOpenTimeMsec: NaN, // this is computed in the post-processing step
    },
  };

  return {
    ...userResult.repoTotalsByDay,
    [date]: [newTotals],
  };
}

function incrementReceivedTotals(
  userResult: IntermediateUserResult,
  adjustments: Partial<ReceivedTotals>,
  date: string | null,
  repoName: string
): {readonly [date: string]: ReadonlyArray<UserRepoTotals>} {
  if (!date) {
    return userResult.repoTotalsByDay;
  }
  const totalsAtDate = userResult.repoTotalsByDay[date] ?? [createDefaultUserRepoTotals(repoName)];
  assertOneRepoTotalsExists(totalsAtDate);

  const receivedTotals = totalsAtDate[0].receivedTotals;

  const newTotals: UserRepoTotals = {
    ...totalsAtDate[0],
    receivedTotals: {
      approvals: receivedTotals.approvals + (adjustments.approvals || 0),
      rejections: receivedTotals.rejections + (adjustments.rejections || 0),
      commentsTotal: receivedTotals.commentsTotal + (adjustments.commentsTotal || 0),
      commentsByOthers: receivedTotals.commentsByOthers + (adjustments.commentsByOthers || 0),
      reviewRequests: receivedTotals.reviewRequests + (adjustments.reviewRequests || 0),
    },
  };

  return {
    ...userResult.repoTotalsByDay,
    [date]: [newTotals],
  };
}

function getTeamMembers(repoConfig: RepoConfig): TeamMembersBySlug {
  const membersHolder: {value: TeamMembersBySlug} = {value: {}};

  const users = iterEachFile<User>(getGithubTeamMembersPath(repoConfig));
  for (const [user, filename] of users) {
    const teamSlug = path.basename(path.dirname(filename));
    const membersList = membersHolder.value[teamSlug] || [];
    membersHolder.value = {...membersHolder.value, [teamSlug]: [...membersList, user]};
  }

  return membersHolder.value;
}

function getPullsByNumber(repoConfig: RepoConfig): PullsByNumber {
  const pulls: {[prNumber: string]: PullRequest} = {};

  for (const [pull] of iterEachFile<PullRequest>(getGithubPullsPath(repoConfig))) {
    pulls[`${pull.number}`] = pull;
  }

  return pulls;
}

function getReviewersFromPullRequest(
  pull: PullRequest,
  teamMembersBySlug: TeamMembersBySlug
): ReadonlyArray<User> {
  const userHandles = (pull.requested_reviewers || []).map((user) => {
    if (!user) {
      console.log(`${pull.number}`);
    }
    return user.login;
  });

  const requestedUsersInTeams = (pull.requested_teams || [])
    .flatMap((team) => teamMembersBySlug[team.slug] || [])
    // skip users in teams that were included explicitly
    .filter((user) => !userHandles.includes(user.login));

  return [...(pull.requested_reviewers || []), ...requestedUsersInTeams];
}

function incrementCommentsByUserIdCount(
  commentsByDateAndUserId: CommentsByDateAndUserId,
  keyUserId: string | undefined,
  comment: ReviewComment | null
) {
  if (!keyUserId || !comment) {
    return commentsByDateAndUserId;
  }
  const date = sliceDate(comment.createdAt);
  const userIdsForDate = commentsByDateAndUserId[date] || {};
  const previousCount = userIdsForDate[keyUserId] || 0;
  return {
    ...commentsByDateAndUserId,
    [date]: {
      ...userIdsForDate,
      [keyUserId]: previousCount + 1,
    },
  };
}

function incrementReviewRequests(
  requestsByDateAndUserId: ReviewRequestsByDateAndUserId,
  userId: string,
  pull: PullRequest
): ReviewRequestsByDateAndUserId {
  const date = sliceDate(pull.created_at);
  const requestsAtDate = requestsByDateAndUserId[date] || {};

  const existingCount = requestsAtDate[userId];
  const newValue = (existingCount || 0) + 1;

  return {...requestsByDateAndUserId, [date]: {...requestsAtDate, [userId]: newValue}};
}

function adjustReviewsSummaries(
  summaries: ReviewSummariesByDateAndUserId,
  userId: string | undefined,
  review: Review
): ReviewSummariesByDateAndUserId {
  if (!userId) {
    return summaries;
  }
  const date = sliceDate(review.submitted_at);
  const summariesAtDate = summaries[date] ?? {};
  const oldValue = summariesAtDate[userId] || {};
  const authoredReviews: ReviewsSummary = {
    approvals: (oldValue?.approvals || 0) + (review.state === 'APPROVED' ? 1 : 0),
    rejections: (oldValue?.rejections || 0) + (review.state === 'CHANGES_REQUESTED' ? 1 : 0),
  };

  return {
    ...summaries,
    [date]: {
      ...summariesAtDate,
      [userId]: authoredReviews,
    },
  };
}

function incrementAuthoredReviewRequests(
  userResult: IntermediateUserResult,
  userId: string,
  pull: PullRequest
): ReviewRequestsByDateAndUserId {
  return incrementReviewRequests(userResult.reviewRequestsAuthoredByDateAndUserId, userId, pull);
}

function incrementReceivedReviewRequests(
  userResult: IntermediateUserResult,
  userId: string,
  pull: PullRequest
): ReviewRequestsByDateAndUserId {
  return incrementReviewRequests(userResult.reviewRequestsReceivedByDateAndUserId, userId, pull);
}

function adjustAuthoredReviews(
  userResult: IntermediateUserResult,
  pullOwnerId: string | undefined,
  review: Review
) {
  return adjustReviewsSummaries(userResult.authoredReviewsByDateAndUserId, pullOwnerId, review);
}

function adjustReceivedReviews(
  userResult: IntermediateUserResult,
  reviewerId: string,
  review: Review
) {
  return adjustReviewsSummaries(userResult.reviewsReceivedByDateAndUserId, reviewerId, review);
}

function incrementCommentsWrittenByDateAndUserId(
  authorUserResult: IntermediateUserResult,
  recipientUser: User | null,
  comment: ReviewComment | null
) {
  return incrementCommentsByUserIdCount(
    authorUserResult.commentsWrittenByDateAndUserId,
    recipientUser?.login,
    comment
  );
}

function incrementCommentsReceivedByUserId(
  recipientUserResult: IntermediateUserResult,
  authorUserId: string,
  comment: ReviewComment | null
) {
  return incrementCommentsByUserIdCount(
    recipientUserResult.commentsReceivedByDateAndUserId,
    authorUserId,
    comment
  );
}

function incrementCountByDay(countByDay: CountByDay, date: string | null): CountByDay {
  if (!date) {
    return countByDay;
  }

  const key = sliceDate(date);
  const commentCount = countByDay[key] || 0;
  return {...countByDay, [key]: commentCount + 1};
}

function incrementAuthoredCommentsByDay(
  userResult: IntermediateUserResult,
  comment: ReviewComment | null
): CountByDay {
  return incrementCountByDay(userResult.commentsAuthoredByDay, comment?.createdAt || null);
}

function incrementReceivedCommentsByDay(
  userResult: IntermediateUserResult,
  comment: ReviewComment | null
): CountByDay {
  return incrementCountByDay(userResult.commentsReceivedByDay, comment?.createdAt || null);
}

function incrementChangesAuthoredByDay(
  userResult: IntermediateUserResult,
  pull: PullRequest
): CountByDay {
  return incrementCountByDay(userResult.changesAuthoredByDay, pull.created_at);
}

function getCommitAuthorDate(commit: Commit): string | null {
  if (!commit.commit) {
    return null;
  }
  return sliceDate(commit.commit.author?.date);
}

function getCommitEmailAddress(commit: Commit): string | null {
  const email = commit.commit?.author.email || null;
  return email?.endsWith('users.noreply.github.com') ? null : email;
}

function getCommitAuthorDisplayName(commit: Commit): string | null {
  return commit.commit?.author.name || null;
}

function getCommitCommitterDisplayName(commit: Commit): string | null {
  return commit.commit?.committer.name || null;
}

function incrementReviewSummariesByDay(
  summaries: ReviewSummariesByDay,
  review: Review
): ReviewSummariesByDay {
  const date = sliceDate(review.submitted_at);
  const existingSummaries = summaries[date] || DEFAULT_REVIEW_SUMMARIES;

  return {
    ...summaries,
    [date]: {
      approvals: existingSummaries.approvals + (review.state === 'APPROVED' ? 1 : 0),
      rejections: existingSummaries.rejections + (review.state === 'CHANGES_REQUESTED' ? 1 : 0),
    },
  };
}

function incrementReviewsAuthoredByDay(
  userResult: IntermediateUserResult,
  review: Review
): ReviewSummariesByDay {
  return incrementReviewSummariesByDay(userResult.reviewsAuthoredByDay, review);
}

function incrementReviewsReceivedByDay(
  userResult: IntermediateUserResult,
  review: Review
): ReviewSummariesByDay {
  return incrementReviewSummariesByDay(userResult.reviewsReceivedByDay, review);
}

function processPullRequests(context: GithubComputeContext, pullsByNumber: PullsByNumber) {
  const teamMembers = getTeamMembers(context.repoConfig);

  Object.keys(pullsByNumber)
    .map((pullNumber) => context.getPull(pullNumber))
    .filter(Boolean)
    .filter((pull) => context.matchesDateFilter(getPullRequestInterval(pull)))
    .forEach((pull) => {
      if (!pull?.user) {
        return;
      }

      const pullUser = pull.user;
      const userResult = context.acquireUserResult(pullUser);
      context.adjustUserResult({
        ...userResult,
        changesAuthored: [...userResult?.changesAuthored, toChange(context.repoConfig.name, pull)],
        changesAuthoredByDay: incrementChangesAuthoredByDay(userResult, pull),
      });

      const requestedReviewers = getReviewersFromPullRequest(pull, teamMembers);
      const allReviewerIds = requestedReviewers.map((user) => user.login);
      if (allReviewerIds.length > 0) {
        requestedReviewers.forEach((user) => {
          const requestedReviewerUserResult = context.acquireUserResult(user);
          const repoTotalsByDay = incrementReceivedTotals(
            requestedReviewerUserResult,
            {reviewRequests: 1},
            pull.created_at,
            context.repoConfig.name
          );
          const pullAuthorResult = context.acquireUserResult(pullUser);

          context.adjustUserResult({
            ...requestedReviewerUserResult,
            repoTotalsByDay,
            reviewRequestsReceivedByDateAndUserId: incrementReceivedReviewRequests(
              requestedReviewerUserResult,
              pullAuthorResult.displayName,
              pull
            ),
          });

          context.adjustUserResult({
            ...pullAuthorResult,
            reviewRequestsAuthoredByDateAndUserId: incrementAuthoredReviewRequests(
              pullAuthorResult,
              user.login,
              pull
            ),
          });
        });
      }
    });
}

function processComments(context: GithubComputeContext) {
  const comments = iterEachFile<Comment>(getGithubCommentsPath(context.repoConfig));
  for (const [comment] of comments) {
    const commentInterval = createInterval(comment.created_at, comment.updated_at);
    if (!context.matchesDateFilter(commentInterval) || !comment.user) {
      continue;
    }

    const commentAuthorUserResult = context.acquireUserResult(comment.user);

    const pullNumber = getPullRequestNumberFromUrl(comment.pull_request_url);
    const recipientUser = context.getPull(pullNumber)?.user || null;
    const pull = context.getPull(pullNumber);
    const reviewComment = toReviewComment(comment, pull);
    const commentCountTotal = reviewComment ? 1 : 0;
    const commentCountToOthers = reviewComment && pull?.user?.id !== comment.user.id ? 1 : 0;

    const authoredTotals = incrementAuthoredTotals(
      commentAuthorUserResult,
      {
        commentsWrittenTotal: commentCountTotal,
        commentsWrittenToOthers: commentCountToOthers,
      },
      pull ? sliceDate(pull.created_at) : null,
      context.repoConfig.name
    );

    context.adjustUserResult({
      ...commentAuthorUserResult,
      commentsAuthored: reviewComment
        ? [...commentAuthorUserResult.commentsAuthored, reviewComment]
        : commentAuthorUserResult.commentsAuthored,
      repoTotalsByDay: authoredTotals,
      commentsWrittenByDateAndUserId: incrementCommentsWrittenByDateAndUserId(
        commentAuthorUserResult,
        recipientUser,
        reviewComment
      ),
      commentsAuthoredByDay: incrementAuthoredCommentsByDay(commentAuthorUserResult, reviewComment),
    });

    if (recipientUser) {
      const recipientUserResult = context.acquireUserResult(recipientUser);
      const receivedTotals = incrementReceivedTotals(
        recipientUserResult,
        {
          commentsTotal: commentCountTotal,
          commentsByOthers: commentCountToOthers,
        },
        reviewComment ? sliceDate(reviewComment.createdAt) : null,
        context.repoConfig.name
      );
      context.adjustUserResult({
        ...recipientUserResult,
        repoTotalsByDay: receivedTotals,
        commentsReceivedByDateAndUserId: incrementCommentsReceivedByUserId(
          recipientUserResult,
          commentAuthorUserResult.displayName,
          reviewComment
        ),
        commentsReceivedByDay: incrementReceivedCommentsByDay(recipientUserResult, reviewComment),
      });
    }
  }
}

function processReviews(context: GithubComputeContext) {
  const reviews = iterEachFile<Review>(getGithubReviewsPath(context.repoConfig));
  for (const [review] of reviews) {
    if (!context.matchesDateFilter(review.submitted_at)) {
      continue;
    }

    const reviewAuthorUserResult = context.acquireUserResult(review.user);
    const pull = context.getPull(getPullRequestNumberFromUrl(review.pull_request_url));
    if (!pull) {
      continue;
    }

    const recipientUser =
      context.getPull(getPullRequestNumberFromUrl(review.pull_request_url))?.user || null;

    const reviewComment: ReviewComment | null = fromReviewToComment(
      review,
      context.getPull(getPullRequestNumberFromUrl(review.pull_request_url))?.user?.login || null,
      pull.title
    );

    const commentCountTotal = reviewComment ? 1 : 0;
    const commentCountToOthers = reviewComment && reviewComment.authorId !== pull.user?.id ? 1 : 0;
    const approvalCount = review.state === 'APPROVED' ? 1 : 0;
    const rejectionCount = review.state === 'CHANGES_REQUESTED' ? 1 : 0;

    const authoredTotals = incrementAuthoredTotals(
      reviewAuthorUserResult,
      {
        rejections: rejectionCount,
        approvals: approvalCount,
        commentsWrittenTotal: commentCountTotal,
        commentsWrittenToOthers: commentCountToOthers,
      },
      sliceDate(review.submitted_at),
      context.repoConfig.name
    );

    context.adjustUserResult({
      ...reviewAuthorUserResult,
      repoTotalsByDay: authoredTotals,
      commentsAuthored: reviewComment
        ? [...reviewAuthorUserResult.commentsAuthored, reviewComment]
        : reviewAuthorUserResult.commentsAuthored,
      commentsAuthoredByDay: incrementAuthoredCommentsByDay(reviewAuthorUserResult, reviewComment),
      authoredReviewsByDateAndUserId: adjustAuthoredReviews(
        reviewAuthorUserResult,
        pull.user?.login,
        review
      ),
      commentsWrittenByDateAndUserId: incrementCommentsWrittenByDateAndUserId(
        reviewAuthorUserResult,
        recipientUser,
        reviewComment
      ),
      reviewsAuthoredByDay: incrementReviewsAuthoredByDay(reviewAuthorUserResult, review),
    });

    if (recipientUser) {
      const recipientUserResult = context.acquireUserResult(recipientUser);
      const receivedTotals = incrementReceivedTotals(
        recipientUserResult,
        {
          approvals: approvalCount,
          rejections: rejectionCount,
          commentsTotal: commentCountTotal,
          commentsByOthers: commentCountToOthers,
        },
        sliceDate(review.submitted_at),
        context.repoConfig.name
      );

      context.adjustUserResult({
        ...recipientUserResult,
        repoTotalsByDay: receivedTotals,
        reviewsReceivedByDateAndUserId: adjustReceivedReviews(
          recipientUserResult,
          review.user.login,
          review
        ),
        reviewsReceivedByDay: incrementReviewsReceivedByDay(recipientUserResult, review),
      });
    }
  }
}

function processCommits(context: GithubComputeContext) {
  const commits = iterEachFile<Commit>(getGithubCommitsPath(context.repoConfig));
  for (const [commit, filename] of commits) {
    const commitAuthorDate = getCommitAuthorDate(commit);
    const pullNumber = path.basename(path.dirname(filename));
    const pull = context.getPull(pullNumber);
    const pullDate = pull?.created_at || null;
    const commitDate = commitAuthorDate || pullDate;
    if (!context.matchesDateFilter(pullDate)) {
      continue;
    }

    const emailAddress = getCommitEmailAddress(commit);

    // Commits don't necessarily have an author even if the PR author exists in GitHub.
    // At least failing verification causes commit author to be absent although pull author exists.
    const author = commit.author || pull?.user;
    if (!author) {
      continue;
    }

    const userResult = context.acquireUserResult(author);
    const repoTotalsByDay = incrementAuthoredTotals(
      userResult,
      {commits: 1},
      commitDate ? sliceDate(commitDate) : null,
      context.repoConfig.name
    );
    const authorDisplayName = getCommitAuthorDisplayName(commit);
    const committerDisplayName = getCommitCommitterDisplayName(commit);
    // Ignore the display name in case of different committers; it can lead to mismatched names
    const displayName =
      authorDisplayName === committerDisplayName && authorDisplayName
        ? authorDisplayName
        : userResult.id;

    context.adjustUserResult({
      ...userResult,
      possibleRealNameCounts: {
        [displayName]: (userResult.possibleRealNameCounts[displayName] || 0) + 1,
      },
      emailAddresses: emailAddress
        ? removeDuplicates([...userResult.emailAddresses, emailAddress])
        : userResult.emailAddresses,
      repoTotalsByDay,
      commitsAuthoredByDay: incrementCountByDay(userResult.commitsAuthoredByDay, commitDate),
    });
  }
}

export function getGithubRepoResult(
  repoConfig: RepoConfig<GithubConnector>,
  request: NormalizedAnalyzeRequest
): IntermediateAnalyzeResult {
  const pullsByNumber: PullsByNumber = getPullsByNumber(repoConfig);

  const userResults: {[userId: string]: IntermediateUserResult} = {};
  const context: GithubComputeContext = {
    repoConfig,

    acquireUserResult: (user: User): IntermediateUserResult => {
      if (!userResults[user.id]) {
        userResults[user.id] = createUserResult(user);
      }
      return userResults[user.id];
    },

    adjustUserResult: (newUserResult: IntermediateUserResult) => {
      userResults[newUserResult.id] = newUserResult;
    },

    getPull: (pullNumber: string | number) => {
      return pullsByNumber[pullNumber] || null;
    },

    matchesDateFilter: (interval: DateInterval | string | null) => {
      return typeof interval === 'string'
        ? intersects(request.dateInterval, singleDateInterval(interval))
        : intersects(request.dateInterval, interval);
    },
  };

  processPullRequests(context, pullsByNumber);
  processComments(context);
  processReviews(context);
  processCommits(context);

  return createIntermediateAnalyzeResult(repoConfig, userResults);
}
