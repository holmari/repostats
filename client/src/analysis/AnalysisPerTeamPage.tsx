import './AnalysisPerTeamPage.css';

import React, {useMemo} from 'react';
import {Navigate, useOutletContext, useParams} from 'react-router';

import {UserResult} from 'types/types';

import TeamResultView from './TeamResultView';
import EmptyStatePlaceholder from 'components/EmptyStatePlaceholder';
import {AnalysisOutletContext} from './AnalysisPage';
import AnalysisSidebar from './AnalysisSidebar';

const AnalysisPerTeamPage: React.FC = () => {
  const {result, teams, excludedUserIds} = useOutletContext<AnalysisOutletContext>();
  const params = useParams<{teamSlug?: string}>();

  const sortedPeopleResults: ReadonlyArray<UserResult> = useMemo(() => {
    return Object.values(result.userResults)
      .filter((user) => !excludedUserIds.includes(user.id))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [result, excludedUserIds]);

  const selectedTeam = useMemo(() => {
    return teams.find((t) => t.slug === params.teamSlug);
  }, [teams, params.teamSlug]);

  const teamMembers: ReadonlyArray<UserResult> = useMemo(() => {
    if (!selectedTeam) return [];
    const memberLoginSet = new Set(selectedTeam.memberLogins.map((l) => l.toLowerCase()));
    return sortedPeopleResults.filter((user) =>
      memberLoginSet.has(user.displayName.toLowerCase())
    );
  }, [selectedTeam, sortedPeopleResults]);

  // If no team is selected and teams exist, redirect to the first team
  if (!selectedTeam && teams.length > 0) {
    return <Navigate to={`/analysis/teams/${teams[0].slug}`} replace />;
  }

  return (
    <div className="AnalysisPerTeamPage">
      <AnalysisSidebar
        className="AnalysisPerTeamPage__sidebar"
        teams={teams}
        users={sortedPeopleResults}
      />
      <div className="AnalysisPerTeamPage__content-area">
        {selectedTeam ? (
          <TeamResultView team={selectedTeam} members={teamMembers} fullResult={result} />
        ) : (
          <EmptyStatePlaceholder>No teams available.</EmptyStatePlaceholder>
        )}
      </div>
    </div>
  );
};
AnalysisPerTeamPage.displayName = 'AnalysisPerTeamPage';

export default AnalysisPerTeamPage;
