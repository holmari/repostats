import {descByCreationDate} from '../../arrays/sort';
import {removeDuplicates} from '../../arrays/utils';
import {createInterval, EMPTY_INTERVAL, getPeriodStartDate, unionAllIntervals} from '../../date/utils';
import {
  AnalyzeResult,
  AuthoredTotals,
  CommentsPerChangeByUserId,
  DateInterval,
  Granularity,
  Mutable,
  ReceivedTotals,
  RepoConfig,
  ReviewComment,
  ReviewsSummary,
  UserActivitySummary,
  UserRepoTotals,
  UserResult,
} from '../../types/types';
import {
  IntermediateAnalyzeResult,
  IntermediateUserResult,
  IntermediateUserResultsByUserId,
  UserResultsByDisplayName,
} from './types';

/**
 * Computes the value at a given percentile from a sorted array.
 * Uses linear interpolation for values between indices.
 */
function computePercentile(sortedValues: ReadonlyArray<number>, percentile: number): number {
  if (sortedValues.length === 0) {
    return NaN;
  }
  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sortedValues[lower];
  }

  // Linear interpolation
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Computes percentile statistics for change open times.
 */
function computeChangeOpenTimePercentiles(changeTimes: ReadonlyArray<number>): {
  median: number;
  p25: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
} {
  if (changeTimes.length === 0) {
    return {median: NaN, p25: NaN, p75: NaN, p90: NaN, p95: NaN, p99: NaN};
  }

  const sorted = [...changeTimes].sort((a, b) => a - b);
  return {
    p25: computePercentile(sorted, 25),
    median: computePercentile(sorted, 50),
    p75: computePercentile(sorted, 75),
    p90: computePercentile(sorted, 90),
    p95: computePercentile(sorted, 95),
    p99: computePercentile(sorted, 99),
  };
}

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
      medianChangeOpenTimeMsec: NaN,
      p25ChangeOpenTimeMsec: NaN,
      p75ChangeOpenTimeMsec: NaN,
      p90ChangeOpenTimeMsec: NaN,
      p95ChangeOpenTimeMsec: NaN,
      p99ChangeOpenTimeMsec: NaN,
      linesAdded: 0,
      linesDeleted: 0,
      medianCommitSize: NaN,
      distinctPRsCommentedOn: 0,
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
  const changeTimes = changesInRepo.map((change) => change.timeOpenMsec);
  const percentiles = computeChangeOpenTimePercentiles(changeTimes);

  return {
    ...repoTotals,
    authoredTotals: {
      ...repoTotals.authoredTotals,
      changesCreated: changesInRepo.length,
      medianChangeOpenTimeMsec: percentiles.median,
      p25ChangeOpenTimeMsec: percentiles.p25,
      p75ChangeOpenTimeMsec: percentiles.p75,
      p90ChangeOpenTimeMsec: percentiles.p90,
      p95ChangeOpenTimeMsec: percentiles.p95,
      p99ChangeOpenTimeMsec: percentiles.p99,
    },
  };
}

function toTimeSeries(
  userResult: IntermediateUserResult,
  granularity: Granularity
): ReadonlyArray<UserActivitySummary> {
  const authoredCommentsDates = Object.keys(userResult.commentsAuthoredByDay);
  const commentsReceivedDates = Object.keys(userResult.commentsReceivedByDay);
  const changesAuthoredDates = Object.keys(userResult.changesAuthoredByDay);
  const commitsAuthoredDates = Object.keys(userResult.commitsAuthoredByDay);
  const reviewsAuthoredDates = Object.keys(userResult.reviewsAuthoredByDay);
  const reviewsReceivedDates = Object.keys(userResult.reviewsReceivedByDay);
  const linesAddedDates = Object.keys(userResult.linesAddedByDay);
  const linesDeletedDates = Object.keys(userResult.linesDeletedByDay);

  const allDates: ReadonlyArray<string> = [
    ...removeDuplicates([
      ...authoredCommentsDates,
      ...commentsReceivedDates,
      ...changesAuthoredDates,
      ...commitsAuthoredDates,
      ...reviewsAuthoredDates,
      ...reviewsReceivedDates,
      ...linesAddedDates,
      ...linesDeletedDates,
    ]),
  ].sort((a, b) => -b.localeCompare(a));

  // Group daily data by period
  const groupedByPeriod: Mutable<{[period: string]: Mutable<UserActivitySummary>}> = {};

  for (const date of allDates) {
    const periodStart = getPeriodStartDate(date, granularity);

    if (!groupedByPeriod[periodStart]) {
      groupedByPeriod[periodStart] = {
        date: periodStart,
        changesAuthored: 0,
        commentsAuthored: 0,
        commentsReceived: 0,
        commitsAuthored: 0,
        reviewsAuthored: {approvals: 0, rejections: 0},
        reviewsReceived: {approvals: 0, rejections: 0},
        linesAdded: 0,
        linesDeleted: 0,
      };
    }

    const period = groupedByPeriod[periodStart];
    period.changesAuthored += userResult.changesAuthoredByDay[date] || 0;
    period.commentsAuthored += userResult.commentsAuthoredByDay[date] || 0;
    period.commentsReceived += userResult.commentsReceivedByDay[date] || 0;
    period.commitsAuthored += userResult.commitsAuthoredByDay[date] || 0;
    period.linesAdded += userResult.linesAddedByDay[date] || 0;
    period.linesDeleted += userResult.linesDeletedByDay[date] || 0;

    const reviewsAuthored = userResult.reviewsAuthoredByDay[date];
    if (reviewsAuthored) {
      period.reviewsAuthored = {
        approvals: (period.reviewsAuthored as ReviewsSummary).approvals + reviewsAuthored.approvals,
        rejections:
          (period.reviewsAuthored as ReviewsSummary).rejections + reviewsAuthored.rejections,
      };
    }

    const reviewsReceived = userResult.reviewsReceivedByDay[date];
    if (reviewsReceived) {
      period.reviewsReceived = {
        approvals: (period.reviewsReceived as ReviewsSummary).approvals + reviewsReceived.approvals,
        rejections:
          (period.reviewsReceived as ReviewsSummary).rejections + reviewsReceived.rejections,
      };
    }
  }

  return Object.values(groupedByPeriod).sort((a, b) => -b.date.localeCompare(a.date));
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

function aggregateAuthoredTotals(
  repoTotals: ReadonlyArray<UserRepoTotals>,
  allChangeTimes: ReadonlyArray<number>
): AuthoredTotals {
  const percentiles = computeChangeOpenTimePercentiles(allChangeTimes);
  // Use medianCommitSize from first repo (it's computed per-user, not per-repo)
  const medianCommitSize = repoTotals.length > 0 ? repoTotals[0].authoredTotals.medianCommitSize : NaN;

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
          // Percentiles are computed from all changes, not aggregated per-repo
          medianChangeOpenTimeMsec: percentiles.median,
          p25ChangeOpenTimeMsec: percentiles.p25,
          p75ChangeOpenTimeMsec: percentiles.p75,
          p90ChangeOpenTimeMsec: percentiles.p90,
          p95ChangeOpenTimeMsec: percentiles.p95,
          p99ChangeOpenTimeMsec: percentiles.p99,
          linesAdded: totals.linesAdded + item.linesAdded,
          linesDeleted: totals.linesDeleted + item.linesDeleted,
          medianCommitSize,
          distinctPRsCommentedOn:
            totals.distinctPRsCommentedOn + item.distinctPRsCommentedOn,
        };
      },
      {
        approvals: 0,
        changesCreated: 0,
        commentsWrittenTotal: 0,
        commentsWrittenToOthers: 0,
        rejections: 0,
        commits: 0,
        medianChangeOpenTimeMsec: percentiles.median,
        p25ChangeOpenTimeMsec: percentiles.p25,
        p75ChangeOpenTimeMsec: percentiles.p75,
        p90ChangeOpenTimeMsec: percentiles.p90,
        p95ChangeOpenTimeMsec: percentiles.p95,
        p99ChangeOpenTimeMsec: percentiles.p99,
        linesAdded: 0,
        linesDeleted: 0,
        medianCommitSize,
        distinctPRsCommentedOn: 0,
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

function postProcessUserResult(
  userResult: IntermediateUserResult,
  granularity: Granularity
): UserResult {
  const timeSeries = toTimeSeries(userResult, granularity);

  const repoTotals = userResult.repoTotals.map((totals) =>
    postProcessUserRepoTotals(totals, userResult)
  );

  const allChangeTimes = userResult.changesAuthored.map((change) => change.timeOpenMsec);

  return {
    id: userResult.displayName, // intentional: displayName is assumed to be unique at this point.
    displayName: userResult.displayName,
    realName: pickBestRealName(userResult),
    url: userResult.url,
    changesAuthored: [...userResult.changesAuthored].sort(descByCreationDate),
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
    aggregatedAuthoredTotals: aggregateAuthoredTotals(repoTotals, allChangeTimes),
    aggregatedReceivedTotals: aggregateReceivedTotals(repoTotals),
  };
}

export function postProcessUserResults(
  results: IntermediateUserResultsByUserId,
  granularity: Granularity
): UserResultsByDisplayName {
  const mappedResultsHolder: {[displayName: string]: UserResult} = {};

  Object.keys(results).forEach((userId) => {
    const processedResult = postProcessUserResult(results[userId], granularity);
    mappedResultsHolder[processedResult.displayName] = processedResult;
  });

  return mappedResultsHolder;
}

export function createAnalyzeResult(
  result: IntermediateAnalyzeResult,
  requestedInterval: DateInterval,
  granularity: Granularity = 'day'
): AnalyzeResult {
  const userResults = postProcessUserResults(result.userResults, granularity);
  const interval: DateInterval | null = unionAllIntervals(
    Object.values(userResults).map((userResult) => userResult.interval)
  );

  return {
    includedRepos: result.includedRepos,
    interval,
    requestedInterval,
    userResults,
    granularity,
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
