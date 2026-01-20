import {
  AuthoredTotals,
  AuthoredTotalsComparison,
  MetricComparison,
  ReceivedTotals,
  ReceivedTotalsComparison,
  UserResult,
  UserResultComparison,
  UserResultsByUserId,
} from '../../types/types';

export function computePercentageChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

export function createMetricComparison(current: number, previous: number): MetricComparison {
  return {
    currentValue: current,
    previousValue: previous,
    percentageChange: computePercentageChange(current, previous),
  };
}

export function compareAuthoredTotals(
  current: AuthoredTotals,
  previous: AuthoredTotals
): AuthoredTotalsComparison {
  return {
    approvals: createMetricComparison(current.approvals, previous.approvals),
    rejections: createMetricComparison(current.rejections, previous.rejections),
    commentsWrittenTotal: createMetricComparison(
      current.commentsWrittenTotal,
      previous.commentsWrittenTotal
    ),
    commentsWrittenToOthers: createMetricComparison(
      current.commentsWrittenToOthers,
      previous.commentsWrittenToOthers
    ),
    changesCreated: createMetricComparison(current.changesCreated, previous.changesCreated),
    commits: createMetricComparison(current.commits, previous.commits),
    meanChangeOpenTimeMsec: createMetricComparison(
      current.meanChangeOpenTimeMsec,
      previous.meanChangeOpenTimeMsec
    ),
  };
}

export function compareReceivedTotals(
  current: ReceivedTotals,
  previous: ReceivedTotals
): ReceivedTotalsComparison {
  return {
    approvals: createMetricComparison(current.approvals, previous.approvals),
    rejections: createMetricComparison(current.rejections, previous.rejections),
    commentsTotal: createMetricComparison(current.commentsTotal, previous.commentsTotal),
    commentsByOthers: createMetricComparison(current.commentsByOthers, previous.commentsByOthers),
    reviewRequests: createMetricComparison(current.reviewRequests, previous.reviewRequests),
  };
}

function createEmptyAuthoredTotals(): AuthoredTotals {
  return {
    approvals: 0,
    rejections: 0,
    commentsWrittenTotal: 0,
    commentsWrittenToOthers: 0,
    changesCreated: 0,
    commits: 0,
    meanChangeOpenTimeMsec: 0,
  };
}

function createEmptyReceivedTotals(): ReceivedTotals {
  return {
    approvals: 0,
    rejections: 0,
    commentsTotal: 0,
    commentsByOthers: 0,
    reviewRequests: 0,
  };
}

export function compareUserResult(
  current: UserResult,
  previous: UserResult | undefined
): UserResultComparison {
  const previousAuthored = previous?.aggregatedAuthoredTotals ?? createEmptyAuthoredTotals();
  const previousReceived = previous?.aggregatedReceivedTotals ?? createEmptyReceivedTotals();

  return {
    authoredTotals: compareAuthoredTotals(current.aggregatedAuthoredTotals, previousAuthored),
    receivedTotals: compareReceivedTotals(current.aggregatedReceivedTotals, previousReceived),
  };
}

export function buildComparisonResults(
  currentResults: UserResultsByUserId,
  previousResults: UserResultsByUserId
): {readonly [userId: string]: UserResultComparison} {
  const comparisons: {[userId: string]: UserResultComparison} = {};

  for (const userId of Object.keys(currentResults)) {
    comparisons[userId] = compareUserResult(currentResults[userId], previousResults[userId]);
  }

  return comparisons;
}
