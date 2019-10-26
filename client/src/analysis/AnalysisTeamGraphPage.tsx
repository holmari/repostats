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
      <Panel title="Team Graph" size="flex">
        <TeamGraph
          nodes={nodes}
          links={links}
          highlightSelection
          charge={-450}
          defaultItemOpacity={0.6}
          linkDistance={45}
          linkForceFactor={0.25}
          relativeLinkValueThreshold={0.1}
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
