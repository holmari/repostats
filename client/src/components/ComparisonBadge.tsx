import './ComparisonBadge.css';

import classNames from 'classnames';
import React from 'react';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';

import {ComparisonGranularity, DateInterval, MetricComparison} from 'types/types';
import {getChangeQuality, MetricPolarity} from 'analysis/metricPolarity';
import {formatInterval, shiftIntervalBack} from 'date/utils';

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

function defaultFormatComparisonValue(value: number): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return '-';
  }
  return Math.round(value).toLocaleString();
}

const ComparisonBadge: React.FC<Props> = ({
  comparison,
  polarity,
  granularity,
  dateInterval,
  formatComparisonValue = defaultFormatComparisonValue,
}) => {
  const quality = getChangeQuality(comparison.percentageChange, polarity);
  const label = `${formatPercentageChange(comparison.percentageChange)} ${getGranularityLabel(granularity)}`;

  const badge = (
    <span className={classNames('ComparisonBadge', `ComparisonBadge--${quality}`)}>
      {label}
    </span>
  );

  if (!dateInterval) {
    return badge;
  }

  const previousInterval = shiftIntervalBack(dateInterval, granularity);
  const previousFormatted = formatComparisonValue(comparison.previousValue);
  const currentFormatted = formatComparisonValue(comparison.currentValue);

  const tooltipContent = (
    <>
      <div>vs {formatInterval(previousInterval)}</div>
      <div>
        {previousFormatted} → {currentFormatted}
      </div>
    </>
  );

  return (
    <OverlayTrigger
      placement="top"
      overlay={<Tooltip id="comparison-tooltip">{tooltipContent}</Tooltip>}
    >
      {badge}
    </OverlayTrigger>
  );
};
ComparisonBadge.displayName = 'ComparisonBadge';

interface Props {
  comparison: MetricComparison;
  polarity: MetricPolarity;
  granularity: ComparisonGranularity;
  dateInterval?: DateInterval;
  formatComparisonValue?: (value: number) => string;
}

export default ComparisonBadge;
