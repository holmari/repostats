import React, {useMemo} from 'react';

import Panel from 'components/Panel';
import {AnalyzeResult, UserResult} from 'types/types';

import TeamGraph from './graph/TeamGraph';
import {getFullLinkData, getFullNodeData} from './graph/utils';

interface Props {
  members: ReadonlyArray<UserResult>;
  fullResult: AnalyzeResult;
}

const TeamMemberGraphPanel: React.FC<Props> = ({members, fullResult}) => {
  const [nodes, links] = useMemo(() => {
    const memberIds = members.map((m) => m.id);
    return [
      getFullNodeData(fullResult, memberIds),
      getFullLinkData(fullResult, memberIds),
    ];
  }, [fullResult, members]);

  return (
    <Panel title="Team Collaboration" size="flex">
      {nodes.length > 1 ? (
        <TeamGraph
          nodes={nodes}
          links={links}
          highlightSelection
          selectedIdentifier={null}
        />
      ) : (
        <span>Not enough team members to display a collaboration graph.</span>
      )}
    </Panel>
  );
};
TeamMemberGraphPanel.displayName = 'TeamMemberGraphPanel';

export default TeamMemberGraphPanel;
