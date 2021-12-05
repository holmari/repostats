import './AnalysisTeamGraphPage.css';

import React, {useMemo} from 'react';

import {AnalyzeResult} from 'types/types';
import Panel from 'components/Panel';
import TeamGraph from './graph/TeamGraph';
import {getFullLinkData, getFullNodeData} from './graph/utils';

const graphSize = {width: 1100, height: 900};

const AnalysisTeamGraphPage: React.FC<Props> = ({result}) => {
  const [nodes, links] = useMemo(() => {
    return [getFullNodeData(result, null), getFullLinkData(result, null)];
  }, [result]);

  return (
    <div className="AnalysisTeamGraphPage">
      <Panel title="Organization Graph" size="flex">
        <TeamGraph
          nodes={nodes}
          links={links}
          highlightSelection
          charge={-450}
          linkDistance={45}
          relativeLinkValueThreshold={0.05}
          size={graphSize}
        />
      </Panel>
    </div>
  );
};
AnalysisTeamGraphPage.displayName = 'AnalysisTeamGraphPage';

interface Props {
  result: AnalyzeResult;
}

export default AnalysisTeamGraphPage;
