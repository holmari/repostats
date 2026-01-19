import './GranularityPicker.css';

import React, {useState} from 'react';
import {OverlayTrigger} from 'react-bootstrap';
import Popover from 'react-bootstrap/Popover';

import {Granularity} from 'types/types';
import TopBarButton from './TopBarButton';

const GRANULARITY_OPTIONS: ReadonlyArray<{value: Granularity; label: string}> = [
  {value: 'day', label: 'Day'},
  {value: 'week', label: 'Week'},
  {value: 'month', label: 'Month'},
  {value: 'quarter', label: 'Quarter'},
  {value: 'year', label: 'Year'},
];

function getGranularityLabel(granularity: Granularity): string {
  return GRANULARITY_OPTIONS.find((opt) => opt.value === granularity)?.label ?? 'Day';
}

const GranularityPicker: React.FC<Props> = ({granularity, onChange}) => {
  const [isPopoverOpen, setPopoverOpen] = useState(false);

  const handleSelect = (value: Granularity) => {
    setPopoverOpen(false);
    onChange(value);
  };

  const popover = (
    <Popover id="granularity-popover" placement="top-start">
      <Popover.Header>Granularity</Popover.Header>
      <Popover.Body className="GranularityPicker__popover-content">
        <ul className="GranularityPicker__options">
          {GRANULARITY_OPTIONS.map((option) => (
            <li
              key={option.value}
              className={`GranularityPicker__option ${
                granularity === option.value ? 'GranularityPicker__option--selected' : ''
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
    <OverlayTrigger show={isPopoverOpen} placement="bottom-start" overlay={popover} rootClose>
      <div className="GranularityPicker">
        <TopBarButton
          onClick={() => setPopoverOpen(!isPopoverOpen)}
          title="Granularity"
          subtitle={getGranularityLabel(granularity)}
        />
      </div>
    </OverlayTrigger>
  );
};
GranularityPicker.displayName = 'GranularityPicker';

interface Props {
  granularity: Granularity;
  onChange: (granularity: Granularity) => void;
}

export default GranularityPicker;
