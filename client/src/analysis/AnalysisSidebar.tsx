import './AnalysisSidebar.css';

import classNames from 'classnames';
import React from 'react';
import {NavLink} from 'react-router';

import CollapsibleSection from 'components/CollapsibleSection';
import {TeamInfo, UserResult} from 'types/types';

interface Props {
  teams: ReadonlyArray<TeamInfo>;
  users: ReadonlyArray<UserResult>;
  className?: string;
}

const AnalysisSidebar: React.FC<Props> = ({teams, users, className}) => {
  return (
    <div className={classNames('AnalysisSidebar', className)}>
      <CollapsibleSection title="Teams" defaultExpanded={true}>
        {teams.length === 0 ? (
          <div className="AnalysisSidebar__empty">No teams found.</div>
        ) : (
          teams.map((team) => (
            <NavLink
              key={team.slug}
              className={({isActive}) =>
                classNames('AnalysisSidebar__item', isActive && 'AnalysisSidebar__item--selected')
              }
              to={`/analysis/teams/${team.slug}`}
            >
              {team.name}
            </NavLink>
          ))
        )}
      </CollapsibleSection>
      <CollapsibleSection title="Users" defaultExpanded={true}>
        {users.length === 0 ? (
          <div className="AnalysisSidebar__empty">No users found.</div>
        ) : (
          users.map((user) => (
            <NavLink
              key={user.id}
              className={({isActive}) =>
                classNames('AnalysisSidebar__item', isActive && 'AnalysisSidebar__item--selected')
              }
              to={`/analysis/people/${user.id}`}
            >
              {user.displayName}
            </NavLink>
          ))
        )}
      </CollapsibleSection>
    </div>
  );
};
AnalysisSidebar.displayName = 'AnalysisSidebar';

export default AnalysisSidebar;
