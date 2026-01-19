import './SettingsPage.css';

import React from 'react';
import {NavLink, Outlet} from 'react-router';
import classNames from 'classnames';

const SettingsPage: React.FC = () => {
  return (
    <div className="SettingsPage">
      <div className="SettingsPage__tabs">
        <NavLink
          className={({isActive}) =>
            classNames('SettingsPage__tab', isActive && 'SettingsPage__tab--active')
          }
          to="/settings/repos"
        >
          Repositories
        </NavLink>
        <NavLink
          className={({isActive}) =>
            classNames('SettingsPage__tab', isActive && 'SettingsPage__tab--active')
          }
          to="/settings/exclusions"
        >
          Exclusions
        </NavLink>
      </div>
      <div className="SettingsPage__content">
        <Outlet />
      </div>
    </div>
  );
};
SettingsPage.displayName = 'SettingsPage';

export default SettingsPage;
