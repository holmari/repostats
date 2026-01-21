import './UserHeaderPanel.css';

import React, {useCallback, useState} from 'react';
import Dropdown from 'react-bootstrap/Dropdown';

import Panel from 'components/Panel';
import {useToast} from 'components/ToastContext';

import {UserResult} from 'types/types';
import {Button, OverlayTrigger, Popover} from 'react-bootstrap';
import {get, put} from 'repos/requests';

const UserHeaderPanel: React.FC<Props> = ({user}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const {showToast} = useToast();

  const handleExcludeUser = useCallback(async () => {
    setMenuOpen(false);

    try {
      const settings = await get('settings');
      const excludedUserIds = settings.excludedUserIds || [];

      if (excludedUserIds.includes(user.id)) {
        showToast(`${user.displayName} is already excluded`);
        return;
      }

      await put('settings', {
        excludedUserIds: [...excludedUserIds, user.id],
      });

      showToast(`Excluded "${user.displayName}". Refresh to update.`, {
        action: {
          icon: 'refresh',
          onClick: () => window.location.reload(),
        },
      });
    } catch (error) {
      showToast('Failed to exclude user');
    }
  }, [user.id, user.displayName, showToast]);

  const popover = (
    <Popover id="date-interval-popover" placement="top-start">
      <Popover.Header>Contact Info</Popover.Header>
      <Popover.Body>
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
      </Popover.Body>
    </Popover>
  );

  return (
    <Panel
      className="UserHeaderPanel"
      title={user.realName || user.displayName}
      titleClass="h1"
      size="flex"
    >
      <h4>
        <a href={user.url}>{user.displayName}</a>
      </h4>
      <div className="UserHeaderPanel__actions">
        <OverlayTrigger placement="bottom-start" trigger="click" overlay={popover} rootClose>
          <Button variant="link">Contact info</Button>
        </OverlayTrigger>
        <Dropdown show={menuOpen} onToggle={setMenuOpen}>
          <Dropdown.Toggle
            as="button"
            className={`UserHeaderPanel__menu-button ${menuOpen ? 'UserHeaderPanel__menu-button--visible' : ''}`}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
          >
            ⋮
          </Dropdown.Toggle>
          <Dropdown.Menu className="UserHeaderPanel__dropdown-menu">
            <Dropdown.Item className="UserHeaderPanel__dropdown-item" onClick={handleExcludeUser}>
              Exclude User
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </Panel>
  );
};
UserHeaderPanel.displayName = 'UserHeaderPanel';

interface Props {
  user: UserResult;
}

export default UserHeaderPanel;
