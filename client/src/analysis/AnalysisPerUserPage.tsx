import './AnalysisPerUserPage.css';

import React, {useMemo} from 'react';
import {Navigate, useOutletContext, useParams} from 'react-router';

import {UserResult} from 'types/types';

import UserResultView from './UserResultView';
import EmptyStatePlaceholder from 'components/EmptyStatePlaceholder';
import {AnalysisOutletContext} from './AnalysisPage';
import AnalysisSidebar from './AnalysisSidebar';

const AnalysisPerUserPage: React.FC = () => {
  const { result, teams, excludedUserIds } = useOutletContext<AnalysisOutletContext>();
  const params = useParams<{userId?: string}>();

  const sortedPeopleResults: ReadonlyArray<UserResult> = useMemo(() => {
    return Object.values(result.userResults)
      .filter((user) => !excludedUserIds.includes(user.id))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [result, excludedUserIds]);

  const selectedUser = params.userId ? result.userResults[params.userId] : undefined;
  if (!selectedUser && sortedPeopleResults.length) {
    return <Navigate to={`/analysis/people/${sortedPeopleResults[0].id}`} replace />;
  }

  return (
    <div className="AnalysisPerUserPage">
      <AnalysisSidebar
        className="AnalysisPerUserPage__sidebar"
        teams={teams}
        users={sortedPeopleResults}
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
