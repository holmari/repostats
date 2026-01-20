import './ExclusionsSettingsPage.css';

import React, {useCallback, useEffect, useState} from 'react';
import classNames from 'classnames';

import {get, put} from 'repos/requests';
import {AppSettings, TeamInfo, UserInfo} from 'types/types';
import CenteredSpinner from 'components/CenteredSpinner';
import {toggleValue} from 'arrays/utils';

type Tab = 'teams' | 'users';

const ExclusionsSettingsPage: React.FC = () => {
  const [teams, setTeams] = useState<ReadonlyArray<TeamInfo>>([]);
  const [users, setUsers] = useState<ReadonlyArray<UserInfo>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('teams');

  const [excludedTeamSlugs, setExcludedTeamSlugs] = useState<ReadonlyArray<string>>([]);
  const [excludedUserIds, setExcludedUserIds] = useState<ReadonlyArray<string>>([]);

  useEffect(() => {
    Promise.all([get('teams'), get('users'), get('settings')])
      .then(([fetchedTeams, fetchedUsers, fetchedSettings]) => {
        setTeams(fetchedTeams);
        setUsers(fetchedUsers);
        setExcludedTeamSlugs(fetchedSettings.excludedTeamSlugs);
        setExcludedUserIds(fetchedSettings.excludedUserIds);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const saveSettings = useCallback(
    (newSettings: Partial<AppSettings>) => {
      put('settings', newSettings).catch(() => {
        // Revert on error - could add error handling here
      });
    },
    []
  );

  const handleToggleTeam = useCallback(
    (slug: string) => {
      const newExcluded = toggleValue(excludedTeamSlugs, slug);
      setExcludedTeamSlugs(newExcluded);
      saveSettings({excludedTeamSlugs: newExcluded, excludedUserIds});
    },
    [excludedTeamSlugs, excludedUserIds, saveSettings]
  );

  const handleToggleUser = useCallback(
    (userId: string) => {
      const newExcluded = toggleValue(excludedUserIds, userId);
      setExcludedUserIds(newExcluded);
      saveSettings({excludedTeamSlugs, excludedUserIds: newExcluded});
    },
    [excludedTeamSlugs, excludedUserIds, saveSettings]
  );

  if (isLoading) {
    return <CenteredSpinner />;
  }

  return (
    <div className="ExclusionsSettingsPage">
      <div className="ExclusionsSettingsPage__tabs">
        <button
          className={classNames(
            'ExclusionsSettingsPage__tab',
            activeTab === 'teams' && 'ExclusionsSettingsPage__tab--active'
          )}
          onClick={() => setActiveTab('teams')}
          type="button"
        >
          Teams ({excludedTeamSlugs.length} excluded)
        </button>
        <button
          className={classNames(
            'ExclusionsSettingsPage__tab',
            activeTab === 'users' && 'ExclusionsSettingsPage__tab--active'
          )}
          onClick={() => setActiveTab('users')}
          type="button"
        >
          Users ({excludedUserIds.length} excluded)
        </button>
      </div>

      <div className="ExclusionsSettingsPage__content">
        {activeTab === 'teams' && (
          <>
            <p className="ExclusionsSettingsPage__description">
              Excluded teams will not appear in the analysis sidebar.
            </p>
            {teams.length === 0 ? (
              <p className="ExclusionsSettingsPage__empty">No teams available.</p>
            ) : (
              <div className="ExclusionsSettingsPage__list">
                {teams.map((team) => (
                  <label key={team.slug} className="ExclusionsSettingsPage__item">
                    <input
                      type="checkbox"
                      checked={excludedTeamSlugs.includes(team.slug)}
                      onChange={() => handleToggleTeam(team.slug)}
                    />
                    <span>{team.name}</span>
                  </label>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'users' && (
          <>
            <p className="ExclusionsSettingsPage__description">
              Excluded users will not appear in the analysis sidebar or results.
            </p>
            {users.length === 0 ? (
              <p className="ExclusionsSettingsPage__empty">No users available.</p>
            ) : (
              <div className="ExclusionsSettingsPage__list">
                {users.map((user) => (
                  <label key={user.id} className="ExclusionsSettingsPage__item">
                    <input
                      type="checkbox"
                      checked={excludedUserIds.includes(user.id)}
                      onChange={() => handleToggleUser(user.id)}
                    />
                    <span>{user.displayName}</span>
                  </label>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
ExclusionsSettingsPage.displayName = 'ExclusionsSettingsPage';

export default ExclusionsSettingsPage;
