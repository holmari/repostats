import './ComparisonGranularityPicker.css';

import React, {useState} from 'react';
import {OverlayTrigger} from 'react-bootstrap';
import Popover from 'react-bootstrap/Popover';

import {ComparisonGranularity, DateInterval} from 'types/types';
import {formatInterval, isAllTimeInterval, shiftIntervalBack} from 'date/utils';
import TopBarButton from './TopBarButton';

type ComparisonOption = ComparisonGranularity | 'off';

const COMPARISON_OPTIONS: ReadonlyArray<{value: ComparisonOption; label: string}> = [
  {value: 'off', label: 'Off'},
  {value: 'quarter', label: 'Quarter (QoQ)'},
  {value: 'year', label: 'Year (YoY)'},
];

function getComparisonLabel(value: ComparisonGranularity | undefined): string {
  if (value === undefined) {
    return 'Off';
  }
  return COMPARISON_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Off';
}

function getComparisonTooltip(
  dateInterval: DateInterval | undefined,
  comparisonGranularity: ComparisonGranularity | undefined
): string | null {
  if (!dateInterval || !comparisonGranularity) {
    return null;
  }
  const currentIntervalStr = formatInterval(dateInterval);
  const previousInterval = shiftIntervalBack(dateInterval, comparisonGranularity);
  const previousIntervalStr = formatInterval(previousInterval);
  return `${currentIntervalStr} vs ${previousIntervalStr}`;
}

const ComparisonGranularityPicker: React.FC<Props> = ({
  comparisonGranularity,
  dateInterval,
  onChange,
}) => {
  const [isPopoverOpen, setPopoverOpen] = useState(false);
  const isDisabled = dateInterval ? isAllTimeInterval(dateInterval) : false;

  const handleSelect = (value: ComparisonOption) => {
    setPopoverOpen(false);
    onChange(value === 'off' ? undefined : value);
  };

  const currentValue: ComparisonOption = comparisonGranularity ?? 'off';
  const tooltipText = isDisabled
    ? 'Comparison not available for "All time" interval'
    : getComparisonTooltip(dateInterval, comparisonGranularity);

  const popover = (
    <Popover id="comparison-granularity-popover" placement="top-start">
      <Popover.Header>Compare</Popover.Header>
      <Popover.Body className="ComparisonGranularityPicker__popover-content">
        <ul className="ComparisonGranularityPicker__options">
          {COMPARISON_OPTIONS.map((option) => (
            <li
              key={option.value}
              className={`ComparisonGranularityPicker__option ${
                currentValue === option.value ? 'ComparisonGranularityPicker__option--selected' : ''
              }`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      </Popover.Body>
    </Popover>
  );

  return (
    <OverlayTrigger
      show={isPopoverOpen && !isDisabled}
      placement="bottom-start"
      overlay={popover}
      rootClose
    >
      <div
        className={`ComparisonGranularityPicker ${isDisabled ? 'ComparisonGranularityPicker--disabled' : ''}`}
        title={tooltipText ?? undefined}
      >
        <TopBarButton
          onClick={() => !isDisabled && setPopoverOpen(!isPopoverOpen)}
          title="Compare"
          subtitle={isDisabled ? 'N/A' : getComparisonLabel(comparisonGranularity)}
        />
      </div>
    </OverlayTrigger>
  );
};
ComparisonGranularityPicker.displayName = 'ComparisonGranularityPicker';

interface Props {
  comparisonGranularity: ComparisonGranularity | undefined;
  dateInterval?: DateInterval;
  onChange: (granularity: ComparisonGranularity | undefined) => void;
}

export default ComparisonGranularityPicker;
