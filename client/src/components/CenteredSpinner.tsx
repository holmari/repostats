import './CenteredSpinner.css';

import classNames from 'classnames';
import React from 'react';
import {Spinner} from 'react-bootstrap';

const CenteredSpinner: React.FC<Props> = ({className}) => {
  return <Spinner animation="border" className={classNames('CenteredSpinner', className)} />;
};
interface Props {
  className?: string;
}
CenteredSpinner.displayName = 'CenteredSpinner';

export default CenteredSpinner;
