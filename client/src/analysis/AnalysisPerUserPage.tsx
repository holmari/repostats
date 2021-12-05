import './AnalysisPerUserPage.css';

import classNames from 'classnames';
import React, {useMemo} from 'react';
import {NavLink, match as RouterMatch, Redirect} from 'react-router-dom';

import SidebarList, {SidebarItemRendererProps} from 'components/SidebarList';
import {AnalyzeResult, UserResult} from 'types/types';

import UserResultView from './UserResultView';
import EmptyStatePlaceholder from 'components/EmptyStatePlaceholder';
import {SelectedUserMatch} from './types';

const PeopleSidebarItem: React.FC<PeopleSidebarItemProps> = ({className, item}) => {
  return (
    <NavLink
      className={classNames('AnalysisPerUserPage__sidebar-item', className)}
      activeClassName="SidebarList__item--selected selected"
      to={`/analysis/people/${item.id}`}
    >
      {item.displayName}
    </NavLink>
  );
};
type PeopleSidebarItemProps = SidebarItemRendererProps<UserResult>;

const AnalysisPerUserPage: React.FC<ContentProps> = ({match, result}) => {
  const sortedPeopleResults: ReadonlyArray<UserResult> = useMemo(() => {
    return Object.values(result.userResults).sort((left, right) => left.id.localeCompare(right.id));
  }, [result]);

  const selectedUser = result.userResults[match.params.userId];
  if (!selectedUser && sortedPeopleResults.length) {
    return <Redirect to={`/analysis/people/${sortedPeopleResults[0].id}`} />;
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
interface ContentProps {
  match: RouterMatch<SelectedUserMatch>;
  result: AnalyzeResult;
}
AnalysisPerUserPage.displayName = 'AnalysisPerUserPage';

export default AnalysisPerUserPage;
