import './ComparisonGranularityPicker.css';

import {DateTime} from 'luxon';
import React, {useState} from 'react';
import {OverlayTrigger} from 'react-bootstrap';
import Popover from 'react-bootstrap/Popover';

import {ComparisonMode, DateInterval} from 'types/types';
import {formatInterval, getComparisonIntervals} from 'date/utils';
import TopBarButton from './TopBarButton';

type ComparisonOption = ComparisonMode | 'off';

const COMPARISON_OPTIONS: ReadonlyArray<{value: ComparisonOption; label: string}> = [
  {value: 'off', label: 'Off'},
  {value: 'qoq', label: 'Quarter over Quarter'},
  {value: 'qyoy', label: 'Quarter Year over Year'},
  {value: 'yoy', label: 'Year over Year'},
];

function getComparisonLabel(value: ComparisonMode | undefined): string {
  if (value === undefined) {
    return 'Off';
  }
  return COMPARISON_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Off';
}

function getReferenceDate(dateInterval: DateInterval | undefined): DateTime {
  const today = DateTime.local().startOf('day');
  if (!dateInterval) {
    return today;
  }
  const end = DateTime.fromISO(dateInterval.endDate);
  return end.toMillis() === 0 || end > today ? today : end;
}

function getComparisonTooltip(
  dateInterval: DateInterval | undefined,
  comparisonMode: ComparisonMode | undefined
): string | null {
  if (!comparisonMode) {
    return null;
  }
  const intervals = getComparisonIntervals(getReferenceDate(dateInterval), comparisonMode);
  return `${formatInterval(intervals.current)} vs ${formatInterval(intervals.previous)}`;
}

const ComparisonGranularityPicker: React.FC<Props> = ({
  comparisonMode,
  dateInterval,
  onChange,
}) => {
  const [isPopoverOpen, setPopoverOpen] = useState(false);

  const handleSelect = (value: ComparisonOption) => {
    setPopoverOpen(false);
    onChange(value === 'off' ? undefined : value);
  };

  const currentValue: ComparisonOption = comparisonMode ?? 'off';
  const tooltipText = getComparisonTooltip(dateInterval, comparisonMode);

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
      show={isPopoverOpen}
      placement="bottom-start"
      overlay={popover}
      rootClose
    >
      <div
        className="ComparisonGranularityPicker"
        title={tooltipText ?? undefined}
      >
        <TopBarButton
          onClick={() => setPopoverOpen(!isPopoverOpen)}
          title="Compare"
          subtitle={getComparisonLabel(comparisonMode)}
        />
      </div>
    </OverlayTrigger>
  );
};
ComparisonGranularityPicker.displayName = 'ComparisonGranularityPicker';

interface Props {
  comparisonMode: ComparisonMode | undefined;
  dateInterval?: DateInterval;
  onChange: (mode: ComparisonMode | undefined) => void;
}

export default ComparisonGranularityPicker;
