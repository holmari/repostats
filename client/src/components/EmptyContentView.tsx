import './EmptyContentView.css';

import React from 'react';
import {Button} from 'react-bootstrap';
import {NavLink} from 'react-router-dom';

const EmptyContentView: React.FC<Props> = ({
  buttonTitle,
  description,
  onButtonClick,
  title,
  toUrl,
}) => {
  const button = <Button onClick={onButtonClick}>{buttonTitle}</Button>;

  return (
    <div className="EmptyContentView">
      <div className="EmptyContentView__centered-horizontal">
        <div className="EmptyContentView__centered-vertical">
          <h4>{title}</h4>

          <p>{description}</p>
          {onButtonClick ? button : <NavLink to={toUrl!}>{button}</NavLink>}
        </div>
      </div>
    </div>
  );
};
EmptyContentView.displayName = 'EmptyContentView';
EmptyContentView.defaultProps = {
  buttonTitle: 'Add repository',
  description: 'To start downloading data, configure a new repository first.',
  title: 'No repositories have been configured yet.',
  toUrl: '/settings/repos/repo/new',
};
interface Props {
  buttonTitle?: string;
  description?: string;
  onButtonClick?: () => void;
  title?: string;
  toUrl?: string;
}

export default EmptyContentView;
