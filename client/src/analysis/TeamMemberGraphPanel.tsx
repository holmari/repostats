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
    const nodeData = getFullNodeData(fullResult, memberIds);
    const nodeIds = new Set(nodeData.map((n) => n.id));

    // Filter links to only include those where both source and target nodes exist
    const linkData = getFullLinkData(fullResult, memberIds).filter(
      (link) => nodeIds.has(link.source) && nodeIds.has(link.target)
    );

    return [nodeData, linkData];
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
