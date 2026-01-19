import './AnalysisPerUserPage.css';

import classNames from 'classnames';
import React, {useMemo} from 'react';
import {NavLink, Navigate, useOutletContext, useParams} from 'react-router';

import SidebarList, {SidebarItemRendererProps} from 'components/SidebarList';
import {UserResult} from 'types/types';

import UserResultView from './UserResultView';
import EmptyStatePlaceholder from 'components/EmptyStatePlaceholder';
import {AnalysisOutletContext} from './AnalysisPage';

const PeopleSidebarItem: React.FC<PeopleSidebarItemProps> = ({className, item}) => {
  return (
    <NavLink
      className={({isActive}) => classNames('AnalysisPerUserPage__sidebar-item', className, isActive && 'SidebarList__item--selected selected')}
      to={`/analysis/people/${item.id}`}
    >
      {item.displayName}
    </NavLink>
  );
};
type PeopleSidebarItemProps = SidebarItemRendererProps<UserResult>;

const AnalysisPerUserPage: React.FC = () => {
  const { result } = useOutletContext<AnalysisOutletContext>();
  const params = useParams<{userId?: string}>();

  const sortedPeopleResults: ReadonlyArray<UserResult> = useMemo(() => {
    return Object.values(result.userResults).sort((left, right) =>
      left.displayName.localeCompare(right.displayName)
    );
  }, [result]);

  const selectedUser = params.userId ? result.userResults[params.userId] : undefined;
  if (!selectedUser && sortedPeopleResults.length) {
    return <Navigate to={`/analysis/people/${sortedPeopleResults[0].id}`} replace />;
  }

  return (
    <div className="AnalysisPerUserPage">
      <SidebarList<UserResult>
        className="AnalysisPerUserPage__sidebar"
        items={sortedPeopleResults}
        isHeaderVisible={false}
        itemRenderer={PeopleSidebarItem}
      />
      <div className="AnalysisPerUserPage__content-area">
        {selectedUser ? (
          <UserResultView user={selectedUser} fullResult={result} />
        ) : (
          <EmptyStatePlaceholder>This analysis contains no users.</EmptyStatePlaceholder>
        )}
      </div>
    </div>
  );
};
AnalysisPerUserPage.displayName = 'AnalysisPerUserPage';

export default AnalysisPerUserPage;
