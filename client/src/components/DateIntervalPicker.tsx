import './DateIntervalPicker.css';

import {DateTime} from 'luxon';
import React, {useEffect, useState} from 'react';
import {Button, OverlayTrigger} from 'react-bootstrap';
import Popover from 'react-bootstrap/Popover';

import {DateInterval} from 'types/types';
import {formatInterval} from 'date/utils';
import DatePicker from './DatePicker';
import TopBarButton from './TopBarButton';

export const ALL_TIME_INTERVAL: DateInterval = {
  startDate: new Date(0).toISOString(),
  endDate: new Date('2100-01-01').toISOString(),
};

type PresetKey =
  | 'trailing52Weeks'
  | 'trailing6Months'
  | 'trailingQuarter'
  | 'thisYear'
  | 'lastQuarter'
  | 'last6Months'
  | 'allTime'
  | 'custom';

interface Preset {
  key: PresetKey;
  label: string;
  getInterval: () => DateInterval;
}

function getTrailing52WeeksInterval(): DateInterval {
  const today = DateTime.now();
  const start = today.minus({weeks: 52});
  return {
    startDate: start.toISODate()!,
    endDate: today.toISODate()!,
  };
}

function getTrailing6MonthsInterval(): DateInterval {
  const today = DateTime.now();
  const start = today.minus({months: 6});
  return {
    startDate: start.toISODate()!,
    endDate: today.toISODate()!,
  };
}

function getTrailingQuarterInterval(): DateInterval {
  const today = DateTime.now();
  const start = today.minus({quarters: 1});
  return {
    startDate: start.toISODate()!,
    endDate: today.toISODate()!,
  };
}

function getThisYearInterval(): DateInterval {
  const today = DateTime.now();
  const startOfYear = today.startOf('year');
  const endOfYear = today.endOf('year');
  return {
    startDate: startOfYear.toISODate()!,
    endDate: endOfYear.toISODate()!,
  };
}

function getLastQuarterInterval(): DateInterval {
  const today = DateTime.now();
  const currentQuarterStart = today.startOf('quarter');
  const lastQuarterEnd = currentQuarterStart.minus({days: 1});
  const lastQuarterStart = lastQuarterEnd.startOf('quarter');
  return {
    startDate: lastQuarterStart.toISODate()!,
    endDate: lastQuarterEnd.toISODate()!,
  };
}

function getLast6MonthsInterval(): DateInterval {
  const today = DateTime.now();
  const currentMonthStart = today.startOf('month');
  const lastMonthEnd = currentMonthStart.minus({days: 1});
  const sixMonthsAgoStart = lastMonthEnd.startOf('month').minus({months: 5});
  return {
    startDate: sixMonthsAgoStart.toISODate()!,
    endDate: lastMonthEnd.toISODate()!,
  };
}

const PRESETS: Preset[] = [
  {key: 'trailing52Weeks', label: 'Trailing 52 Weeks', getInterval: getTrailing52WeeksInterval},
  {key: 'trailing6Months', label: 'Trailing 6 Months', getInterval: getTrailing6MonthsInterval},
  {key: 'trailingQuarter', label: 'Trailing Quarter', getInterval: getTrailingQuarterInterval},
  {key: 'thisYear', label: 'This Year', getInterval: getThisYearInterval},
  {key: 'lastQuarter', label: 'Last Quarter', getInterval: getLastQuarterInterval},
  {key: 'last6Months', label: 'Last 6 Months', getInterval: getLast6MonthsInterval},
  {key: 'allTime', label: 'All Time', getInterval: () => ALL_TIME_INTERVAL},
  {key: 'custom', label: 'Custom Interval', getInterval: () => getTrailing52WeeksInterval()},
];

export const DEFAULT_INTERVAL = getTrailing52WeeksInterval();

function detectPresetFromInterval(interval: DateInterval): PresetKey {
  for (const preset of PRESETS) {
    if (preset.key === 'custom') continue;
    const presetInterval = preset.getInterval();
    if (
      presetInterval.startDate === interval.startDate &&
      presetInterval.endDate === interval.endDate
    ) {
      return preset.key;
    }
  }
  return 'custom';
}

const DateIntervalPicker: React.FC<Props> = ({interval, onChange}) => {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>(() =>
    detectPresetFromInterval(interval)
  );
  const [customInterval, setCustomInterval] = useState<DateInterval>(interval);
  const [isPopoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    const detected = detectPresetFromInterval(interval);
    setSelectedPreset(detected);
    if (detected === 'custom') {
      setCustomInterval(interval);
    }
  }, [interval]);

  const handlePresetSelect = (preset: Preset) => {
    setSelectedPreset(preset.key);
    if (preset.key !== 'custom') {
      setPopoverOpen(false);
      onChange(preset.getInterval());
    }
  };

  const handleCustomConfirm = () => {
    setPopoverOpen(false);
    onChange(customInterval);
  };

  const popover = (
    <Popover id="date-interval-popover" placement="top-start">
      <Popover.Header>Evaluation Interval</Popover.Header>
      <Popover.Body className="DateIntervalPicker__popover-body">
        <ul className="DateIntervalPicker__presets">
          {PRESETS.map((preset) => (
            <li
              key={preset.key}
              className={`DateIntervalPicker__preset ${
                selectedPreset === preset.key ? 'DateIntervalPicker__preset--selected' : ''
              }`}
              onClick={() => handlePresetSelect(preset)}
            >
              {preset.label}
            </li>
          ))}
        </ul>
        {selectedPreset === 'custom' && (
          <div className="DateIntervalPicker__custom-section">
            <div className="DateIntervalPicker__custom-fields">
              <fieldset>
                <legend>Start Date</legend>
                <DatePicker
                  date={customInterval.startDate}
                  onChange={(startDate) => setCustomInterval({...customInterval, startDate})}
                />
              </fieldset>
              <fieldset>
                <legend>End Date</legend>
                <DatePicker
                  date={customInterval.endDate}
                  onChange={(endDate) => setCustomInterval({...customInterval, endDate})}
                />
              </fieldset>
            </div>
            <div className="DateIntervalPicker__custom-footer">
              <Button onClick={handleCustomConfirm} size="sm">
                Apply
              </Button>
            </div>
          </div>
        )}
      </Popover.Body>
    </Popover>
  );

  const subtitle =
    selectedPreset !== 'custom'
      ? PRESETS.find((p) => p.key === selectedPreset)?.label ?? formatInterval(interval)
      : formatInterval(interval);

  const tooltipText = formatInterval(interval);

  return (
    <OverlayTrigger show={isPopoverOpen} placement="bottom-start" overlay={popover} rootClose>
      <div className="DateIntervalPicker" title={tooltipText}>
        <TopBarButton
          onClick={() => setPopoverOpen(!isPopoverOpen)}
          title="Evaluation Interval"
          subtitle={subtitle}
        />
      </div>
    </OverlayTrigger>
  );
};
DateIntervalPicker.displayName = 'DateIntervalPicker';

interface Props {
  interval: DateInterval;
  onChange: (interval: DateInterval) => void;
}

export default DateIntervalPicker;
