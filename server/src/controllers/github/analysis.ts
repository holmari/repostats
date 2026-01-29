import path from 'path';
import fs from 'fs';
import {spawnSync} from 'child_process';

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
  sliceDate,
  singleDateInterval,
} from '../../date/utils';
import {NormalizedAnalyzeRequest} from '../analysis';
import {createDefaultUserRepoTotals, createIntermediateAnalyzeResult} from '../analysis/utils';
import {IntermediateAnalyzeResult, IntermediateUserResult} from '../analysis/types';
import {removeDuplicates} from '../../arrays/utils';
import {getPullRequestNumberFromUrl} from './utils';
import {getGitClonePath} from '../../file/paths';
import {buildEmailMapping} from '../../git/emailMapping';
import {getDefaultBranch} from '../../git/utils';

type PullsByNumber = {readonly [prNumber: string]: PullRequest};
type TeamMembersBySlug = {readonly [teamSlug: string]: ReadonlyArray<User>};
type FirstReviewTimeByPullNumber = {readonly [prNumber: string]: string};

function computeMedian(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    return NaN;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

const DEFAULT_REVIEW_SUMMARIES: ReviewsSummary = {approvals: 0, rejections: 0};
interface GithubComputeContext {
  readonly repoConfig: RepoConfig<GithubConnector>;

  readonly getPull: (pullNumber: string | number) => PullRequest | null;
  readonly getFirstReviewTime: (pullNumber: string | number) => string | null;
  readonly matchesDateFilter: (interval: DateInterval | string | null) => boolean;
  readonly acquireUserResult: (user: User) => IntermediateUserResult;
  readonly adjustUserResult: (newUserResult: IntermediateUserResult) => void;
}

function createUserResult(user: User, repoConfig: RepoConfig): IntermediateUserResult {
  return {
    id: user.login,
    displayName: user.login,
    possibleRealNameCounts: {},
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
    linesAddedByDay: {},
    linesDeletedByDay: {},
    interval: EMPTY_INTERVAL,
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

function toChange(
  repoName: string,
  pullRequest: PullRequest,
  firstReviewTime: string | null
): Change {
  const interval: DateInterval | null = getPullRequestInterval(pullRequest);
  const timeOpenMsec = getIntervalDuration(interval, 'milliseconds');

  let timeToFirstReviewMsec: number | null = null;
  if (firstReviewTime) {
    const reviewInterval = createInterval(pullRequest.created_at, firstReviewTime);
    timeToFirstReviewMsec = getIntervalDuration(reviewInterval, 'milliseconds');
  }

  return {
    repoName,
    reviewUrl: pullRequest.html_url,
    createdAt: pullRequest.created_at,
    title: pullRequest.title,
    timeOpenMsec,
    timeToFirstReviewMsec,
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
      commentsWrittenTotal:
        authoredTotals.commentsWrittenTotal + (adjustments.commentsWrittenTotal || 0),
      commentsWrittenToOthers:
        authoredTotals.commentsWrittenToOthers + (adjustments.commentsWrittenToOthers || 0),
      commits: authoredTotals.commits + (adjustments.commits || 0),
      // Percentiles are computed in the post-processing step
      medianChangeOpenTimeMsec: NaN,
      p25ChangeOpenTimeMsec: NaN,
      p75ChangeOpenTimeMsec: NaN,
      p90ChangeOpenTimeMsec: NaN,
      p95ChangeOpenTimeMsec: NaN,
      p99ChangeOpenTimeMsec: NaN,
      linesAdded: authoredTotals.linesAdded + (adjustments.linesAdded || 0),
      linesDeleted: authoredTotals.linesDeleted + (adjustments.linesDeleted || 0),
      medianCommitSize: NaN, // Computed in processGitStats
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
      commentsTotal: receivedTotals.commentsTotal + (adjustments.commentsTotal || 0),
      commentsByOthers: receivedTotals.commentsByOthers + (adjustments.commentsByOthers || 0),
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
  const pulls: {[prNumber: string]: PullRequest} = {};

  for (const [pull] of iterEachFile<PullRequest>(getGithubPullsPath(repoConfig))) {
    pulls[`${pull.number}`] = pull;
  }

  return pulls;
}

function getFirstReviewTimeByPullNumber(repoConfig: RepoConfig): FirstReviewTimeByPullNumber {
  const firstReviewTimes: {[prNumber: string]: string} = {};

  const reviews = iterEachFile<Review>(getGithubReviewsPath(repoConfig));
  for (const [review] of reviews) {
    if (!review.submitted_at || !review.user) {
      continue;
    }

    const pullNumber = getPullRequestNumberFromUrl(review.pull_request_url);
    const existingTime = firstReviewTimes[pullNumber];

    if (!existingTime || review.submitted_at < existingTime) {
      firstReviewTimes[pullNumber] = review.submitted_at;
    }
  }

  return firstReviewTimes;
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
      const firstReviewTime = context.getFirstReviewTime(pull.number);
      context.adjustUserResult({
        ...userResult,
        changesAuthored: [
          ...userResult?.changesAuthored,
          toChange(context.repoConfig.name, pull, firstReviewTime),
        ],
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
              pullAuthorResult.displayName
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
    const commentCountTotal = reviewComment ? 1 : 0;
    const commentCountToOthers = reviewComment && pull?.user?.id !== comment.user.id ? 1 : 0;

    const authoredTotals = incrementAuthoredTotals(commentAuthorUserResult, {
      commentsWrittenTotal: commentCountTotal,
      commentsWrittenToOthers: commentCountToOthers,
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
      const receivedTotals = incrementReceivedTotals(recipientUserResult, {
        commentsTotal: commentCountTotal,
        commentsByOthers: commentCountToOthers,
      });
      context.adjustUserResult({
        ...recipientUserResult,
        repoTotals: [receivedTotals],
        commentsReceivedByUserId: incrementCommentsReceivedByUserId(
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

    // Skip reviews where the user is null (deleted accounts, ghost users, etc.)
    if (!review.user) {
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

    const authoredTotals = incrementAuthoredTotals(reviewAuthorUserResult, {
      rejections: rejectionCount,
      approvals: approvalCount,
      commentsWrittenTotal: commentCountTotal,
      commentsWrittenToOthers: commentCountToOthers,
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
        commentsTotal: commentCountTotal,
        commentsByOthers: commentCountToOthers,
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
      possibleRealNameCounts: {
        [displayName]: (userResult.possibleRealNameCounts[displayName] || 0) + 1,
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
  const firstReviewTimeByPullNumber: FirstReviewTimeByPullNumber =
    getFirstReviewTimeByPullNumber(repoConfig);

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

    getFirstReviewTime: (pullNumber: string | number) => {
      return firstReviewTimeByPullNumber[pullNumber] || null;
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

  // Process git stats if repo is cloned and SSH key is available
  processGitStats(context, request.dateInterval, userResults);

  return createIntermediateAnalyzeResult(repoConfig, userResults);
}

function processGitStats(
  context: GithubComputeContext,
  dateInterval: DateInterval,
  userResults: {[userId: string]: IntermediateUserResult}
): void {
  const repoPath = getGitClonePath(context.repoConfig.name);

  // Check if repo is cloned
  if (!fs.existsSync(repoPath) || !fs.existsSync(`${repoPath}/.git`)) {
    return;
  }

  // Build email mapping from GitHub commit data
  const emailMapping = buildEmailMapping(context.repoConfig);

  // Get the default branch name
  const defaultBranch = getDefaultBranch(repoPath);

  // Get excluded file paths from repo config
  const excludedPaths = context.repoConfig.excludedFilePaths || [];

  const args = [
    'log',
    '--format=%H|%ae|%aI',
    '--shortstat',
    '--no-merges',
    defaultBranch,
    `--since=${dateInterval.startDate}`,
    `--until=${dateInterval.endDate}`,
  ];

  // Add pathspec exclusions if configured
  if (excludedPaths.length > 0) {
    args.push('--');
    for (const pattern of excludedPaths) {
      args.push(`:!${pattern}`);
    }
  }

  const result = spawnSync('git', args, {cwd: repoPath, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024});
  if (result.status !== 0) {
    console.error(`Git log failed for ${context.repoConfig.name}: ${result.stderr}`);
    return;
  }

  // Parse git log output
  const entries = parseGitLogOutput(result.stdout);

  // Aggregate stats by user login (totals and per day)
  // Using mutable type for aggregation since CountByDay is readonly
  type MutableCountByDay = {[date: string]: number};
  const statsByLogin: {
    [login: string]: {
      linesAdded: number;
      linesDeleted: number;
      linesAddedByDay: MutableCountByDay;
      linesDeletedByDay: MutableCountByDay;
      commitSizes: number[];
    };
  } = {};

  for (const entry of entries) {
    const login = emailMapping.get(entry.email);
    if (!login) {
      continue;
    }

    if (!statsByLogin[login]) {
      statsByLogin[login] = {
        linesAdded: 0,
        linesDeleted: 0,
        linesAddedByDay: {},
        linesDeletedByDay: {},
        commitSizes: [],
      };
    }

    statsByLogin[login].linesAdded += entry.insertions;
    statsByLogin[login].linesDeleted += entry.deletions;
    statsByLogin[login].commitSizes.push(entry.insertions + entry.deletions);

    // Aggregate per day
    const dateKey = sliceDate(entry.date);
    statsByLogin[login].linesAddedByDay[dateKey] =
      (statsByLogin[login].linesAddedByDay[dateKey] || 0) + entry.insertions;
    statsByLogin[login].linesDeletedByDay[dateKey] =
      (statsByLogin[login].linesDeletedByDay[dateKey] || 0) + entry.deletions;
  }

  // Update user results with line stats by finding users by their displayName
  for (const userResult of Object.values(userResults)) {
    const login = userResult.displayName;
    const stats = statsByLogin[login];

    if (!stats || userResult.repoTotals.length === 0) {
      continue;
    }

    // Compute median commit size
    const medianCommitSize = computeMedian(stats.commitSizes);

    // Update the repoTotals with line stats
    const updatedRepoTotals = userResult.repoTotals.map((totals) => ({
      ...totals,
      authoredTotals: {
        ...totals.authoredTotals,
        linesAdded: totals.authoredTotals.linesAdded + stats.linesAdded,
        linesDeleted: totals.authoredTotals.linesDeleted + stats.linesDeleted,
        medianCommitSize,
      },
    }));

    // Merge per-day line stats (using mutable type for modification, then assign to readonly)
    const mergedLinesAddedByDay: MutableCountByDay = {...userResult.linesAddedByDay};
    const mergedLinesDeletedByDay: MutableCountByDay = {...userResult.linesDeletedByDay};
    for (const [date, count] of Object.entries(stats.linesAddedByDay)) {
      mergedLinesAddedByDay[date] = (mergedLinesAddedByDay[date] || 0) + count;
    }
    for (const [date, count] of Object.entries(stats.linesDeletedByDay)) {
      mergedLinesDeletedByDay[date] = (mergedLinesDeletedByDay[date] || 0) + count;
    }

    userResults[userResult.id] = {
      ...userResult,
      repoTotals: updatedRepoTotals,
      linesAddedByDay: mergedLinesAddedByDay,
      linesDeletedByDay: mergedLinesDeletedByDay,
    };
  }
}

interface ParsedGitLogEntry {
  sha: string;
  email: string;
  date: string;
  insertions: number;
  deletions: number;
}

function parseGitLogOutput(output: string): ParsedGitLogEntry[] {
  const entries: ParsedGitLogEntry[] = [];
  const lines = output.split('\n');

  let currentEntry: Partial<ParsedGitLogEntry> | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      continue;
    }

    // Check if this is a commit line (SHA|email|date)
    if (trimmedLine.includes('|') && trimmedLine.length >= 40) {
      // If we have a previous entry without stats, add it with zeros
      if (currentEntry && currentEntry.sha) {
        entries.push({
          sha: currentEntry.sha,
          email: currentEntry.email ?? '',
          date: currentEntry.date ?? '',
          insertions: currentEntry.insertions ?? 0,
          deletions: currentEntry.deletions ?? 0,
        });
      }

      const parts = trimmedLine.split('|');
      if (parts.length >= 3) {
        currentEntry = {
          sha: parts[0],
          email: parts[1].toLowerCase(),
          date: parts[2],
          insertions: 0,
          deletions: 0,
        };
      }
    } else if (currentEntry && (trimmedLine.includes('insertion') || trimmedLine.includes('deletion'))) {
      // Parse shortstat line
      const insertionMatch = trimmedLine.match(/(\d+)\s+insertion/);
      const deletionMatch = trimmedLine.match(/(\d+)\s+deletion/);

      if (insertionMatch) {
        currentEntry.insertions = parseInt(insertionMatch[1], 10);
      }
      if (deletionMatch) {
        currentEntry.deletions = parseInt(deletionMatch[1], 10);
      }

      // Add entry and reset
      entries.push({
        sha: currentEntry.sha ?? '',
        email: currentEntry.email ?? '',
        date: currentEntry.date ?? '',
        insertions: currentEntry.insertions ?? 0,
        deletions: currentEntry.deletions ?? 0,
      });
      currentEntry = null;
    }
  }

  // Handle last entry if no stats line followed
  if (currentEntry && currentEntry.sha) {
    entries.push({
      sha: currentEntry.sha,
      email: currentEntry.email ?? '',
      date: currentEntry.date ?? '',
      insertions: currentEntry.insertions ?? 0,
      deletions: currentEntry.deletions ?? 0,
    });
  }

  return entries;
}
