import {descByCreationDate} from '../../arrays/sort';
import {removeDuplicates} from '../../arrays/utils';
import {createInterval, EMPTY_INTERVAL, unionAllIntervals} from '../../date/utils';
import {
  AnalyzeResult,
  AuthoredTotals,
  CommentsPerChangeByUserId,
  DateInterval,
  ReceivedTotals,
  RepoConfig,
  ReviewComment,
  UserActivitySummary,
  UserRepoTotals,
  UserResult,
} from '../../types/types';
import {
  IntermediateAnalyzeResult,
  IntermediateUserResult,
  IntermediateUserResultsByUserId,
  UserResultsByEmail,
} from './types';

export function createDefaultUserRepoTotals(repoConfig: RepoConfig): UserRepoTotals {
  return {
    repoName: repoConfig.name,
    authoredTotals: {
      approvals: 0,
      rejections: 0,
      commentsWrittenTotal: 0,
      commentsWrittenToOthers: 0,
      changesCreated: 0,
      commits: 0,
      meanChangeOpenTimeMsec: NaN,
    },
    receivedTotals: {
      commentsTotal: 0,
      commentsByOthers: 0,
      approvals: 0,
      rejections: 0,
      reviewRequests: 0,
    },
  };
}

function getUserResultDateInterval(
  timeSeries: ReadonlyArray<UserActivitySummary>
): DateInterval | null {
  return createInterval(...timeSeries.map((item) => item.date));
}

function postProcessUserRepoTotals(
  repoTotals: UserRepoTotals,
  userResult: IntermediateUserResult
): UserRepoTotals {
  const changesInRepo = userResult.changesAuthored.filter(
    (change) => change.repoName === repoTotals.repoName
  );
  return {
    ...repoTotals,
    authoredTotals: {
      ...repoTotals.authoredTotals,
      changesCreated: changesInRepo.length,
      meanChangeOpenTimeMsec:
        userResult.changesAuthored.length > 0
          ? userResult.changesAuthored
              .map((change) => change.timeOpenMsec)
              .reduce((acc, timeOpen) => acc + timeOpen, 0) / userResult.changesAuthored.length
          : NaN,
    },
  };
}

function toTimeSeries(userResult: IntermediateUserResult): ReadonlyArray<UserActivitySummary> {
  const authoredCommentsDates = Object.keys(userResult.commentsAuthoredByDay);
  const commentsReceivedDates = Object.keys(userResult.commentsReceivedByDay);
  const changesAuthoredDates = Object.keys(userResult.changesAuthoredByDay);
  const commitsAuthoredDates = Object.keys(userResult.commitsAuthoredByDay);
  const reviewsAuthoredDates = Object.keys(userResult.reviewsAuthoredByDay);
  const reviewsReceivedDates = Object.keys(userResult.reviewsReceivedByDay);

  const allDates: ReadonlyArray<string> = [
    ...removeDuplicates([
      ...authoredCommentsDates,
      ...commentsReceivedDates,
      ...changesAuthoredDates,
      ...commitsAuthoredDates,
      ...reviewsAuthoredDates,
      ...reviewsReceivedDates,
    ]),
  ].sort((a, b) => -b.localeCompare(a));

  return allDates.map((date) => {
    return {
      date,
      changesAuthored: userResult.changesAuthoredByDay[date] || 0,
      commentsAuthored: userResult.commentsAuthoredByDay[date] || 0,
      commentsReceived: userResult.commentsReceivedByDay[date] || 0,
      commitsAuthored: userResult.commitsAuthoredByDay[date] || 0,
      reviewsAuthored: userResult.reviewsAuthoredByDay[date] || {approvals: 0, rejections: 0},
      reviewsReceived: userResult.reviewsReceivedByDay[date] || {approvals: 0, rejections: 0},
    };
  });
}

function pickBestRealName(userResult: IntermediateUserResult) {
  const namesAndCounts = userResult.possibleRealNameCounts;
  return (
    Object.keys(userResult.possibleRealNameCounts)
      // Prefer any other name than the user id
      .filter((name) => name !== userResult.id)
      .reduce<string | null>((prevLargestName, name) => {
        const count = namesAndCounts[name];
        return count > (namesAndCounts[prevLargestName || ''] || 0) ? name : prevLargestName;
      }, null)
  );
}

type CommentsByUserId = {readonly [userId: string]: ReadonlyArray<ReviewComment>};

function getCommentsAuthoredPerChangeByUserId(
  userResult: IntermediateUserResult
): CommentsPerChangeByUserId {
  const commentsByUserId: CommentsByUserId = userResult.commentsAuthored.reduce<CommentsByUserId>(
    (acc, comment) => {
      if (!comment.recipientUserId) {
        return acc;
      }
      const existingItem = acc[comment.recipientUserId] || [];
      return {
        ...acc,
        [comment.recipientUserId]: [...existingItem, comment],
      };
    },
    {}
  );

  return Object.keys(commentsByUserId).reduce<CommentsPerChangeByUserId>((acc, userId) => {
    const comments = commentsByUserId[userId];
    const changes = removeDuplicates(comments.map((comment) => comment.reviewUrl));
    return {
      ...acc,
      [userId]: comments.length / changes.length,
    };
  }, {});
}

function aggregateAuthoredTotals(repoTotals: ReadonlyArray<UserRepoTotals>): AuthoredTotals {
  return repoTotals
    .map((totals) => totals.authoredTotals)
    .reduce<AuthoredTotals>(
      (totals, item) => {
        return {
          approvals: totals.approvals + item.approvals,
          changesCreated: totals.changesCreated + item.changesCreated,
          commentsWrittenTotal: totals.commentsWrittenTotal + item.commentsWrittenTotal,
          commentsWrittenToOthers: totals.commentsWrittenToOthers + item.commentsWrittenToOthers,
          rejections: totals.rejections + item.rejections,
          commits: totals.commits + item.commits,
          meanChangeOpenTimeMsec: isNaN(totals.meanChangeOpenTimeMsec)
            ? item.meanChangeOpenTimeMsec
            : (totals.meanChangeOpenTimeMsec + item.meanChangeOpenTimeMsec) / 2,
        };
      },
      {
        approvals: 0,
        changesCreated: 0,
        commentsWrittenTotal: 0,
        commentsWrittenToOthers: 0,
        rejections: 0,
        commits: 0,
        meanChangeOpenTimeMsec: NaN,
      }
    );
}

function aggregateReceivedTotals(repoTotals: ReadonlyArray<UserRepoTotals>): ReceivedTotals {
  return repoTotals
    .map((totals) => totals.receivedTotals)
    .reduce<ReceivedTotals>(
      (totals, item) => ({
        approvals: totals.approvals + item.approvals,
        rejections: totals.rejections + item.rejections,
        commentsTotal: totals.commentsTotal + item.commentsTotal,
        commentsByOthers: totals.commentsByOthers + item.commentsByOthers,
        reviewRequests: totals.reviewRequests + item.reviewRequests,
      }),
      {approvals: 0, rejections: 0, commentsTotal: 0, commentsByOthers: 0, reviewRequests: 0}
    );
}

function postProcessUserResult(userResult: IntermediateUserResult): UserResult {
  const timeSeries = toTimeSeries(userResult);

  const repoTotals = userResult.repoTotals.map((totals) =>
    postProcessUserRepoTotals(totals, userResult)
  );

  return {
    id: userResult.id,
    displayName: userResult.displayName,
    realName: pickBestRealName(userResult),
    url: userResult.url,
    commentsAuthored: [...userResult.commentsAuthored].sort(descByCreationDate),
    reviewRequestsAuthoredByUserId: userResult.reviewRequestsAuthoredByUserId,
    reviewRequestsReceivedByUserId: userResult.reviewRequestsReceivedByUserId,
    commentsWrittenByUserId: userResult.commentsWrittenByUserId,
    commentsReceivedByUserId: userResult.commentsReceivedByUserId,
    commentsAuthoredPerChangeByUserId: getCommentsAuthoredPerChangeByUserId(userResult),
    authoredReviewsByUserId: userResult.authoredReviewsByUserId,
    reviewsReceivedByUserId: userResult.reviewsReceivedByUserId,
    timeSeries,
    emailAddresses: [...userResult.emailAddresses].sort((a, b) => a.localeCompare(b)),
    repoTotals,
    interval: getUserResultDateInterval(timeSeries) || EMPTY_INTERVAL,
    activeDaysCount: timeSeries.length,
    aggregatedAuthoredTotals: aggregateAuthoredTotals(repoTotals),
    aggregatedReceivedTotals: aggregateReceivedTotals(repoTotals),
  };
}

export function postProcessUserResults(
  results: IntermediateUserResultsByUserId
): UserResultsByEmail {
  const mappedResultsHolder: {[emailAddress: string]: UserResult} = {};

  Object.keys(results).forEach((emailAddress) => {
    mappedResultsHolder[emailAddress] = postProcessUserResult(results[emailAddress]);
  });

  return mappedResultsHolder;
}

export function createAnalyzeResult(result: IntermediateAnalyzeResult): AnalyzeResult {
  const userResults = postProcessUserResults(result.userResults);
  const interval: DateInterval | null = unionAllIntervals(
    Object.values(userResults).map((userResult) => userResult.interval)
  );

  return {
    includedRepos: result.includedRepos,
    interval,
    userResults,
  };
}

export function createIntermediateAnalyzeResult(
  repoConfig: RepoConfig,
  userResults: IntermediateUserResultsByUserId
): IntermediateAnalyzeResult {
  return {
    includedRepos: [repoConfig],
    userResults,
  };
}
