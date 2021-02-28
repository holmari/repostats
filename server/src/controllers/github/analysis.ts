import path from 'path';

import {iterEachFile} from '../../file/utils';
import {
  ReviewRequestsByUserId,
  DateInterval,
  RepoConfig,
  ReviewComment,
  Change,
  UserRepoTotals,
  AuthoredTotals,
  ReceivedTotals,
  ReviewsSummary,
  ReviewRequest,
  CommentsByUserId,
  ReviewSummariesByUserId,
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
  normalizeDate as getIsoDate,
  singleDateInterval,
} from '../../date/utils';
import {NormalizedAnalyzeRequest} from '../analysis';
import {createDefaultUserRepoTotals, createIntermediateAnalyzeResult} from '../analysis/utils';
import {IntermediateAnalyzeResult, IntermediateUserResult} from '../analysis/types';
import {removeDuplicates} from '../../arrays/utils';
import {getPullRequestNumberFromUrl} from './utils';

type PullsByNumber = {readonly [prNumber: string]: PullRequest};
type TeamMembersBySlug = {readonly [teamSlug: string]: ReadonlyArray<User>};

interface GithubComputeContext {
  readonly repoConfig: RepoConfig<GithubConnector>;

  readonly getPull: (pullNumber: string | number) => PullRequest | null;
  readonly matchesDateFilter: (interval: DateInterval | string | null) => boolean;
  readonly acquireUserResult: (user: User) => IntermediateUserResult;
  readonly adjustUserResult: (newUserResult: IntermediateUserResult) => void;
}

function createUserResult(user: User, repoConfig: RepoConfig): IntermediateUserResult {
  return {
    id: user.login,
    possibleDisplayNameCounts: {},
    emailAddresses: [],
    url: user.html_url,
    repoTotals: [createDefaultUserRepoTotals(repoConfig)],
    commentsAuthored: [],
    changesAuthored: [],
    authoredReviewsByUserId: {},
    reviewRequestsAuthoredByUserId: {},
    reviewRequestsReceivedByUserId: {},
    commentsWrittenByUserId: {},
    commentsReceivedByUserId: {},
    reviewsReceivedByUserId: {},
    commentsAuthoredByDay: {},
    commentsReceivedByDay: {},
    changesAuthoredByDay: {},
    commitsAuthoredByDay: {},
    reviewsAuthoredByDay: {},
    reviewsReceivedByDay: {},
    interval: EMPTY_INTERVAL,
  };
}

function toReviewComment(comment: Comment, pull: PullRequest | null): ReviewComment | null {
  if (!comment.body || !pull || !comment.user) {
    return null;
  }

  return {
    authorId: comment.user.login,
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
    authorId: review.user.login,
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

function assertOneRepoTotalsExists(userResult: IntermediateUserResult) {
  if (userResult.repoTotals.length !== 1) {
    throw new Error(
      `Assertion failed: expected only one repo to exist, but was ${userResult.repoTotals.length}`
    );
  }
}

function incrementAuthoredTotals(
  userResult: IntermediateUserResult,
  adjustments: Partial<AuthoredTotals>
): UserRepoTotals {
  assertOneRepoTotalsExists(userResult);

  const authoredTotals = userResult.repoTotals[0].authoredTotals;

  return {
    ...userResult.repoTotals[0],
    authoredTotals: {
      approvals: authoredTotals.approvals + (adjustments.approvals || 0),
      changesCreated: authoredTotals.changesCreated + (adjustments.changesCreated || 0),
      rejections: authoredTotals.rejections + (adjustments.rejections || 0),
      commentsWritten: authoredTotals.commentsWritten + (adjustments.commentsWritten || 0),
      commits: authoredTotals.commits + (adjustments.commits || 0),
      meanChangeOpenTimeMsec: NaN, // this is computed in the post-processing step
    },
  };
}

function incrementReceivedTotals(
  userResult: IntermediateUserResult,
  adjustments: Partial<ReceivedTotals>
): UserRepoTotals {
  assertOneRepoTotalsExists(userResult);

  const receivedTotals = userResult.repoTotals[0].receivedTotals;
  return {
    ...userResult.repoTotals[0],
    receivedTotals: {
      approvals: receivedTotals.approvals + (adjustments.approvals || 0),
      rejections: receivedTotals.rejections + (adjustments.rejections || 0),
      comments: receivedTotals.comments + (adjustments.comments || 0),
      reviewRequests: receivedTotals.reviewRequests + (adjustments.reviewRequests || 0),
    },
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
  const pullsHolder: {value: PullsByNumber} = {value: {}};

  for (const [pull] of iterEachFile<PullRequest>(getGithubPullsPath(repoConfig))) {
    pullsHolder.value = {...pullsHolder.value, [`${pull.number}`]: pull};
  }

  return pullsHolder.value;
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
  commentsByUserId: CommentsByUserId | CommentsByUserId,
  keyUserId: string | undefined,
  comment: ReviewComment | null
) {
  if (!keyUserId || !comment) {
    return commentsByUserId;
  }
  const previousCount = commentsByUserId[keyUserId] || 0;
  return {...commentsByUserId, [keyUserId]: previousCount + 1};
}

function incrementReviewRequests(
  requestsByUserId: ReviewRequestsByUserId,
  userId: string
): ReviewRequestsByUserId {
  const existingRequest = requestsByUserId[userId];
  const newRequest: ReviewRequest = {
    userId,
    timesAdded: (existingRequest?.timesAdded || 0) + 1,
  };
  return {...requestsByUserId, [userId]: newRequest};
}

function adjustReviewsSummaries(
  summaries: ReviewSummariesByUserId,
  userId: string | undefined,
  reviewState: Review['state']
) {
  if (!userId) {
    return summaries;
  }
  const oldValue = summaries[userId];
  const authoredReviews: ReviewsSummary = {
    approvals: (oldValue?.approvals || 0) + (reviewState === 'APPROVED' ? 1 : 0),
    rejections: (oldValue?.rejections || 0) + (reviewState === 'CHANGES_REQUESTED' ? 1 : 0),
  };

  return {...summaries, [userId]: authoredReviews};
}

function incrementAuthoredReviewRequests(
  userResult: IntermediateUserResult,
  userId: string
): ReviewRequestsByUserId {
  return incrementReviewRequests(userResult.reviewRequestsAuthoredByUserId, userId);
}

function incrementReceivedReviewRequests(
  userResult: IntermediateUserResult,
  userId: string
): ReviewRequestsByUserId {
  return incrementReviewRequests(userResult.reviewRequestsReceivedByUserId, userId);
}

function adjustAuthoredReviews(
  userResult: IntermediateUserResult,
  pullOwnerId: string | undefined,
  reviewState: Review['state']
) {
  return adjustReviewsSummaries(userResult.authoredReviewsByUserId, pullOwnerId, reviewState);
}

function adjustReceivedReviews(
  userResult: IntermediateUserResult,
  reviewerId: string,
  reviewState: Review['state']
) {
  return adjustReviewsSummaries(userResult.reviewsReceivedByUserId, reviewerId, reviewState);
}

function incrementCommentsWrittenByUserId(
  authorUserResult: IntermediateUserResult,
  recipientUser: User | null,
  comment: ReviewComment | null
) {
  return incrementCommentsByUserIdCount(
    authorUserResult.commentsWrittenByUserId,
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
    recipientUserResult.commentsReceivedByUserId,
    authorUserId,
    comment
  );
}

function incrementCountByDay(countByDay: CountByDay, date: string | null): CountByDay {
  if (!date) {
    return countByDay;
  }

  const key = getIsoDate(date);
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
  return getIsoDate(commit.commit.author?.date);
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
  const date = getIsoDate(review.submitted_at);
  const existingSummaries = summaries[date] || {approvals: 0, rejections: 0};
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
          const totals = incrementReceivedTotals(requestedReviewerUserResult, {reviewRequests: 1});
          const pullAuthorResult = context.acquireUserResult(pullUser);

          context.adjustUserResult({
            ...requestedReviewerUserResult,
            repoTotals: [totals],
            reviewRequestsReceivedByUserId: incrementReceivedReviewRequests(
              requestedReviewerUserResult,
              pullAuthorResult.id
            ),
          });

          context.adjustUserResult({
            ...pullAuthorResult,
            reviewRequestsAuthoredByUserId: incrementAuthoredReviewRequests(
              pullAuthorResult,
              user.login
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
    const commentCount = reviewComment ? 1 : 0;
    const authoredTotals = incrementAuthoredTotals(commentAuthorUserResult, {
      commentsWritten: commentCount,
    });

    context.adjustUserResult({
      ...commentAuthorUserResult,
      commentsAuthored: reviewComment
        ? [...commentAuthorUserResult.commentsAuthored, reviewComment]
        : commentAuthorUserResult.commentsAuthored,
      repoTotals: [authoredTotals],
      commentsWrittenByUserId: incrementCommentsWrittenByUserId(
        commentAuthorUserResult,
        recipientUser,
        reviewComment
      ),
      commentsAuthoredByDay: incrementAuthoredCommentsByDay(commentAuthorUserResult, reviewComment),
    });

    if (recipientUser) {
      const recipientUserResult = context.acquireUserResult(recipientUser);
      const receivedTotals = incrementReceivedTotals(recipientUserResult, {comments: commentCount});
      context.adjustUserResult({
        ...recipientUserResult,
        repoTotals: [receivedTotals],
        commentsReceivedByUserId: incrementCommentsReceivedByUserId(
          recipientUserResult,
          commentAuthorUserResult.id,
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

    const commentCount = reviewComment ? 1 : 0;
    const approvalCount = review.state === 'APPROVED' ? 1 : 0;
    const rejectionCount = review.state === 'CHANGES_REQUESTED' ? 1 : 0;

    const authoredTotals = incrementAuthoredTotals(reviewAuthorUserResult, {
      rejections: rejectionCount,
      approvals: approvalCount,
      commentsWritten: commentCount,
    });

    context.adjustUserResult({
      ...reviewAuthorUserResult,
      repoTotals: [authoredTotals],
      commentsAuthored: reviewComment
        ? [...reviewAuthorUserResult.commentsAuthored, reviewComment]
        : reviewAuthorUserResult.commentsAuthored,
      commentsAuthoredByDay: incrementAuthoredCommentsByDay(reviewAuthorUserResult, reviewComment),
      authoredReviewsByUserId: adjustAuthoredReviews(
        reviewAuthorUserResult,
        pull.user?.login,
        review.state
      ),
      commentsWrittenByUserId: incrementCommentsWrittenByUserId(
        reviewAuthorUserResult,
        recipientUser,
        reviewComment
      ),
      reviewsAuthoredByDay: incrementReviewsAuthoredByDay(reviewAuthorUserResult, review),
    });

    if (recipientUser) {
      const recipientUserResult = context.acquireUserResult(recipientUser);
      const receivedTotals = incrementReceivedTotals(recipientUserResult, {
        approvals: approvalCount,
        rejections: rejectionCount,
        comments: commentCount,
      });

      context.adjustUserResult({
        ...recipientUserResult,
        repoTotals: [receivedTotals],
        reviewsReceivedByUserId: adjustReceivedReviews(
          recipientUserResult,
          review.user.login,
          review.state
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
    const repoTotals = incrementAuthoredTotals(userResult, {commits: 1});
    const authorDisplayName = getCommitAuthorDisplayName(commit);
    const committerDisplayName = getCommitCommitterDisplayName(commit);
    // Ignore the display name in case of different committers; it can lead to mismatched names
    const displayName =
      authorDisplayName === committerDisplayName && authorDisplayName
        ? authorDisplayName
        : userResult.id;

    context.adjustUserResult({
      ...userResult,
      possibleDisplayNameCounts: {
        [displayName]: (userResult.possibleDisplayNameCounts[displayName] || 0) + 1,
      },
      emailAddresses: emailAddress
        ? removeDuplicates([...userResult.emailAddresses, emailAddress])
        : userResult.emailAddresses,
      repoTotals: [repoTotals],
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
      if (!userResults[user.login]) {
        userResults[user.login] = createUserResult(user, repoConfig);
      }
      return userResults[user.login];
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
