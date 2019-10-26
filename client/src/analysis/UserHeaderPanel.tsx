import './UserHeaderPanel.css';

import React from 'react';

import Panel from 'components/Panel';

import {UserResult} from 'types/types';
import {Button, OverlayTrigger, Popover} from 'react-bootstrap';

const UserHeaderPanel: React.FC<Props> = ({user}) => {
  const popover = (
    <Popover id="date-interval-popover" placement="top-start">
      <Popover.Title>Contact Info</Popover.Title>
      <Popover.Content>
        <div className="DateIntervalPicker__popover-content">
          <fieldset>
            <legend>Email {user.emailAddresses.length > 1 ? 'addresses' : 'address'}</legend>
            <ul>
              {user.emailAddresses.map((email) => (
                <li key={email}>
                  <a href={`mailto:${email}`}>{email}</a>
                </li>
              )) || 'Unknown'}
            </ul>
          </fieldset>
        </div>
      </Popover.Content>
    </Popover>
  );

  return (
    <Panel className="UserHeaderPanel" title={user.displayName} titleClass="h1" size="flex">
      <h4>
        <a href={user.url}>{user.id}</a>
      </h4>
      <div className="UserHeaderPanel__contact-info">
        <OverlayTrigger placement="bottom-start" trigger="click" overlay={popover} rootClose>
          <Button variant="link">Contact info</Button>
        </OverlayTrigger>
      </div>
    </Panel>
  );
};
UserHeaderPanel.displayName = 'UserHeaderPanel';

interface Props {
  user: UserResult;
}

export default UserHeaderPanel;
