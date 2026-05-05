import './ComparisonBadge.css';

import classNames from 'classnames';
import React from 'react';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';

import {ComparisonIntervals, ComparisonMode, MetricComparison} from 'types/types';
import {getChangeQuality, MetricPolarity} from 'analysis/metricPolarity';
import {formatInterval} from 'date/utils';

function formatPercentageChange(change: number | null): string {
  if (change === null) {
    return '-';
  }
  const sign = change >= 0 ? '+' : '';
  return `${sign}${Math.round(change)}%`;
}

function getModeLabel(mode: ComparisonMode): string {
  switch (mode) {
    case 'qoq':
      return 'QoQ';
    case 'qyoy':
      return 'Q-YoY';
    case 'yoy':
      return 'YoY';
    case 'pop':
      return 'PoP';
  }
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
  mode,
  comparisonIntervals,
  formatComparisonValue = defaultFormatComparisonValue,
}) => {
  const quality = getChangeQuality(comparison.percentageChange, polarity);
  const label = `${formatPercentageChange(comparison.percentageChange)} ${getModeLabel(mode)}`;

  const badge = (
    <span className={classNames('ComparisonBadge', `ComparisonBadge--${quality}`)}>{label}</span>
  );

  if (!comparisonIntervals) {
    return badge;
  }

  const previousFormatted = formatComparisonValue(comparison.previousValue);
  const currentFormatted = formatComparisonValue(comparison.currentValue);

  const tooltipContent = (
    <>
      <div>
        {formatInterval(comparisonIntervals.current)} vs{' '}
        {formatInterval(comparisonIntervals.previous)}
      </div>
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
  mode: ComparisonMode;
  comparisonIntervals?: ComparisonIntervals;
  formatComparisonValue?: (value: number) => string;
}

export default ComparisonBadge;
