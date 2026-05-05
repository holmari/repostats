import './ValueCell.css';

import classNames from 'classnames';
import React from 'react';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';

import {ComparisonIntervals, ComparisonMode, MetricComparison} from 'types/types';
import {MetricPolarity} from 'analysis/metricPolarity';
import ComparisonBadge from './ComparisonBadge';

function getDisplayableNumberValue(value: number): number | string {
  if (Number.isNaN(value) || value === Infinity) {
    return '–';
  } else if (!Number.isFinite(value)) {
    return '∞';
  } else if (!Number.isInteger(value)) {
    return value.toFixed(3);
  }

  return value;
}

function getDisplayValue(value: number | string): React.ReactNode {
  if (value === 'Infinity' || value === 'NaN') {
    return '–';
  } else if (typeof value === 'number') {
    return getDisplayableNumberValue(value);
  }
  return value;
}

const ValueCell: React.FC<Props> = ({
  className,
  comparison,
  comparisonIntervals,
  comparisonMode,
  comparisonPolarity,
  cornerContent,
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
    comparisonMode !== undefined;

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
              mode={comparisonMode}
              comparisonIntervals={comparisonIntervals}
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
  comparisonIntervals?: ComparisonIntervals;
  comparisonMode?: ComparisonMode;
  comparisonPolarity?: MetricPolarity;
  cornerContent?: React.ReactNode;
  fontSize?: 'small' | 'normal';
  formatComparisonValue?: (value: number) => string;
  size?: 'normal' | 'wide' | 'x-wide';
  title: string;
  tooltip: React.ReactNode;
  value: number | string;
}

export default ValueCell;
