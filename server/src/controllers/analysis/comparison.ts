import {
  AuthoredTotals,
  AuthoredTotalsComparison,
  ChangeSample,
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
    medianChangeOpenTimeMsec: createMetricComparison(
      current.medianChangeOpenTimeMsec,
      previous.medianChangeOpenTimeMsec
    ),
    linesAdded: createMetricComparison(current.linesAdded, previous.linesAdded),
    linesDeleted: createMetricComparison(current.linesDeleted, previous.linesDeleted),
    medianCommitSize: createMetricComparison(current.medianCommitSize, previous.medianCommitSize),
    distinctPRsCommentedOn: createMetricComparison(
      current.distinctPRsCommentedOn,
      previous.distinctPRsCommentedOn
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
    medianChangeOpenTimeMsec: 0,
    p25ChangeOpenTimeMsec: 0,
    p75ChangeOpenTimeMsec: 0,
    p90ChangeOpenTimeMsec: 0,
    p95ChangeOpenTimeMsec: 0,
    p99ChangeOpenTimeMsec: 0,
    linesAdded: 0,
    linesDeleted: 0,
    medianCommitSize: 0,
    distinctPRsCommentedOn: 0,
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

function changesToSamples(result: UserResult | undefined): ReadonlyArray<ChangeSample> {
  return (
    result?.changesAuthored.map((change) => ({
      timeOpenMsec: change.timeOpenMsec,
      linesChanged: change.linesChanged,
    })) ?? []
  );
}

export function compareUserResult(
  current: UserResult | undefined,
  previous: UserResult | undefined
): UserResultComparison {
  const currentAuthored = current?.aggregatedAuthoredTotals ?? createEmptyAuthoredTotals();
  const currentReceived = current?.aggregatedReceivedTotals ?? createEmptyReceivedTotals();
  const previousAuthored = previous?.aggregatedAuthoredTotals ?? createEmptyAuthoredTotals();
  const previousReceived = previous?.aggregatedReceivedTotals ?? createEmptyReceivedTotals();

  return {
    authoredTotals: compareAuthoredTotals(currentAuthored, previousAuthored),
    receivedTotals: compareReceivedTotals(currentReceived, previousReceived),
    currentAuthoredChangeSamples: changesToSamples(current),
    previousAuthoredChangeSamples: changesToSamples(previous),
  };
}

export function buildComparisonResults(
  currentResults: UserResultsByUserId,
  previousResults: UserResultsByUserId
): {readonly [userId: string]: UserResultComparison} {
  const comparisons: {[userId: string]: UserResultComparison} = {};

  // Include any user that appears in either slice — a user might have authored
  // PRs only in the previous slice and still be displayed via the eval window.
  const allUserIds = new Set<string>([
    ...Object.keys(currentResults),
    ...Object.keys(previousResults),
  ]);

  for (const userId of allUserIds) {
    comparisons[userId] = compareUserResult(currentResults[userId], previousResults[userId]);
  }

  return comparisons;
}
