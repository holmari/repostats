import './DateIntervalPicker.css';

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

const DateIntervalPicker: React.FC<Props> = ({interval, onChange}) => {
  const [proposedInterval, setProposedInterval] = useState(interval);
  const [isPopoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    setProposedInterval(interval);
  }, [interval]);

  const handleConfirm = () => {
    setPopoverOpen(false);
    onChange(proposedInterval);
  };

  const handleReset = () => {
    setPopoverOpen(false);
    onChange(ALL_TIME_INTERVAL);
  };

  const popover = (
    <Popover id="date-interval-popover" placement="top-start">
      <Popover.Title>Date Interval</Popover.Title>
      <Popover.Content>
        <div className="DateIntervalPicker__popover-content">
          <fieldset>
            <legend>Start Date</legend>
            <DatePicker
              date={proposedInterval.startDate}
              onChange={(startDate) => setProposedInterval({...proposedInterval, startDate})}
            />
          </fieldset>
          <fieldset>
            <legend>End Date</legend>
            <DatePicker
              date={proposedInterval.endDate}
              onChange={(endDate) => setProposedInterval({...proposedInterval, endDate})}
            />
          </fieldset>
        </div>
        <div className="DateIntervalPicker__popover-content-footer">
          <Button onClick={handleConfirm} size="sm">
            Change
          </Button>
          <Button
            className="DateIntervalPicker__reset-button"
            onClick={handleReset}
            size="sm"
            variant="outline-danger"
          >
            Reset
          </Button>
        </div>
      </Popover.Content>
    </Popover>
  );

  return (
    <OverlayTrigger show={isPopoverOpen} placement="bottom-start" overlay={popover} rootClose>
      <div className="DateIntervalPicker">
        <TopBarButton
          onClick={() => setPopoverOpen(!isPopoverOpen)}
          title="Evaluation Interval"
          subtitle={formatInterval(interval)}
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
