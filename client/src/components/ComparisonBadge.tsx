import './ComparisonBadge.css';

import classNames from 'classnames';
import React from 'react';

import {ComparisonGranularity, MetricComparison} from 'types/types';
import {getChangeQuality, MetricPolarity} from 'analysis/metricPolarity';

function formatPercentageChange(change: number | null): string {
  if (change === null) {
    return '-';
  }
  const sign = change >= 0 ? '+' : '';
  return `${sign}${Math.round(change)}%`;
}

function getGranularityLabel(granularity: ComparisonGranularity): string {
  return granularity === 'year' ? 'YoY' : 'QoQ';
}

const ComparisonBadge: React.FC<Props> = ({comparison, polarity, granularity}) => {
  const quality = getChangeQuality(comparison.percentageChange, polarity);
  const label = `${formatPercentageChange(comparison.percentageChange)} ${getGranularityLabel(granularity)}`;

  return (
    <span className={classNames('ComparisonBadge', `ComparisonBadge--${quality}`)}>
      {label}
    </span>
  );
};
ComparisonBadge.displayName = 'ComparisonBadge';

interface Props {
  comparison: MetricComparison;
  polarity: MetricPolarity;
  granularity: ComparisonGranularity;
}

export default ComparisonBadge;
