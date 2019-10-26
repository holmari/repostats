import './DatePicker.css';
import 'react-datepicker/dist/react-datepicker.css';

import React from 'react';
import ReactDatePicker, {ReactDatePickerProps} from 'react-datepicker';

const DatePicker: React.FC<Props> = ({date, onChange, ...rest}) => {
  return (
    <ReactDatePicker
      className="DatePicker"
      selected={new Date(date)}
      onChange={(date: Date | null) => date && onChange(date.toISOString())}
      {...rest}
    />
  );
};
DatePicker.displayName = 'DatePicker';

type Props = Omit<ReactDatePickerProps, 'date' | 'onChange'> & {
  date: string;
  onChange: (date: string) => void;
};

export default DatePicker;
