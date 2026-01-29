import {MetricComparison} from 'types/types';

export type MetricPolarity = 'positive' | 'negative';

export function computeRatioComparison(
  numerator: MetricComparison | undefined,
  denominator: MetricComparison | undefined
): MetricComparison | undefined {
  if (!numerator || !denominator) {
    return undefined;
  }

  const currentValue =
    denominator.currentValue === 0 ? 0 : numerator.currentValue / denominator.currentValue;
  const previousValue =
    denominator.previousValue === 0 ? 0 : numerator.previousValue / denominator.previousValue;
  const percentageChange =
    previousValue === 0 ? null : ((currentValue - previousValue) / previousValue) * 100;

  return {currentValue, previousValue, percentageChange};
}

export const AUTHORED_METRIC_POLARITY: Record<string, MetricPolarity> = {
  approvals: 'positive',
  rejections: 'positive',
  commentsWrittenTotal: 'positive',
  commentsWrittenToOthers: 'positive',
  changesCreated: 'positive',
  commits: 'positive',
  medianChangeOpenTimeMsec: 'negative', // less time in review is better
  linesAdded: 'positive',
  linesDeleted: 'positive', // deletion is neutral/positive - cleaning up code
  medianCommitSize: 'negative', // smaller commits are generally better for review
};

export const RECEIVED_METRIC_POLARITY: Record<string, MetricPolarity> = {
  approvals: 'positive',
  rejections: 'negative',
  commentsTotal: 'negative',
  commentsByOthers: 'negative',
  reviewRequests: 'positive',
};

export function getChangeQuality(
  change: number | null,
  polarity: MetricPolarity
): 'good' | 'bad' | 'neutral' {
  if (change === null || change === 0) {
    return 'neutral';
  }

  const isIncrease = change > 0;

  if (polarity === 'positive') {
    return isIncrease ? 'good' : 'bad';
  } else {
    return isIncrease ? 'bad' : 'good';
  }
}
