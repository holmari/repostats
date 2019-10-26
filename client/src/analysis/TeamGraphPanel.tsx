import React, {useMemo} from 'react';

import Panel from 'components/Panel';
import {AnalyzeResult, UserResult} from 'types/types';

import TeamGraph from './graph/TeamGraph';
import {getFullLinkData, getFullNodeData, getRelatedUserIds} from './graph/utils';

const TeamGraphPanel: React.FC<Props> = ({fullResult, user}) => {
  const [nodes, links] = useMemo(() => {
    const relatedUserIds = getRelatedUserIds(user);
    return [
      getFullNodeData(fullResult, relatedUserIds),
      getFullLinkData(fullResult, relatedUserIds),
    ];
  }, [fullResult, user]);

  return (
    <Panel title="Team Graph" size="flex">
      {nodes.length ? (
        <TeamGraph
          nodes={nodes}
          links={links}
          drawCrosshair
          highlightSelection
          selectedIdentifier={null}
          centeredIdentifier={user.id}
        />
      ) : (
        <span>Not enough information is available to display the team graph for this user.</span>
      )}
    </Panel>
  );
};
TeamGraphPanel.displayName = 'TeamGraphPanel';

interface Props {
  fullResult: AnalyzeResult;
  user: UserResult;
}

export default TeamGraphPanel;
