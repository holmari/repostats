import './ValueCell.css';

import classNames from 'classnames';
import React from 'react';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';

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

const ValueCell: React.FC<Props> = ({className, fontSize, size, title, tooltip, value}) => {
  const displayValue = getDisplayValue(value);

  return (
    <OverlayTrigger placement="bottom" overlay={<Tooltip id="tooltip">{tooltip}</Tooltip>}>
      <div
        className={classNames('ValueCell', className, `font-size-${fontSize}`, size)}
        data-toggle="tooltip"
      >
        <div className="ValueCell__value">{displayValue}</div>
        <div className="ValueCell__title">{title}</div>
      </div>
    </OverlayTrigger>
  );
};
ValueCell.displayName = 'ValueCell';
ValueCell.defaultProps = {
  size: 'normal',
};

interface Props {
  className?: string;
  fontSize?: 'small' | 'normal';
  size?: 'normal' | 'wide' | 'x-wide';
  title: string;
  tooltip: React.ReactNode;
  value: number | string;
}

export default ValueCell;
