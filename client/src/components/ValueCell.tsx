import './ValueCell.css';

import classNames from 'classnames';
import React from 'react';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';

import {ComparisonGranularity, DateInterval, MetricComparison} from 'types/types';
import {MetricPolarity} from 'analysis/metricPolarity';
import ComparisonBadge from './ComparisonBadge';

function getDisplayableNumberValue(value: number): number | string {
  if (Number.isNaN(value) || value === Infinity) {
    return '\u2013';
  } else if (!Number.isFinite(value)) {
    return '\u221e';
  } else if (!Number.isInteger(value)) {
    return value.toFixed(3);
  }

  return value;
}

function getDisplayValue(value: number | string): React.ReactNode {
  if (value === 'Infinity' || value === 'NaN') {
    return '\u2013';
  } else if (typeof value === 'number') {
    return getDisplayableNumberValue(value);
  }
  return value;
}

const ValueCell: React.FC<Props> = ({
  className,
  comparison,
  comparisonGranularity,
  comparisonPolarity,
  cornerContent,
  dateInterval,
  fontSize,
  formatComparisonValue,
  size = 'normal',
  title,
  tooltip,
  value,
}) => {
  const displayValue = getDisplayValue(value);
  const showComparison =
    comparison !== undefined &&
    comparisonPolarity !== undefined &&
    comparisonGranularity !== undefined;

  return (
    <OverlayTrigger placement="bottom" overlay={<Tooltip id="tooltip">{tooltip}</Tooltip>}>
      <div
        className={classNames('ValueCell', className, `font-size-${fontSize}`, size)}
        data-toggle="tooltip"
      >
        {cornerContent && <div className="ValueCell__corner">{cornerContent}</div>}
        <div className="ValueCell__value">
          {displayValue}
          {showComparison && (
            <ComparisonBadge
              comparison={comparison}
              polarity={comparisonPolarity}
              granularity={comparisonGranularity}
              dateInterval={dateInterval}
              formatComparisonValue={formatComparisonValue}
            />
          )}
        </div>
        <div className="ValueCell__title">{title}</div>
      </div>
    </OverlayTrigger>
  );
};
ValueCell.displayName = 'ValueCell';

interface Props {
  className?: string;
  comparison?: MetricComparison;
  comparisonGranularity?: ComparisonGranularity;
  comparisonPolarity?: MetricPolarity;
  cornerContent?: React.ReactNode;
  dateInterval?: DateInterval;
  fontSize?: 'small' | 'normal';
  formatComparisonValue?: (value: number) => string;
  size?: 'normal' | 'wide' | 'x-wide';
  title: string;
  tooltip: React.ReactNode;
  value: number | string;
}

export default ValueCell;
