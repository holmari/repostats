import {SimulationLinkDatum, SimulationNodeDatum} from 'd3-force';
import {UserResult} from 'types/types';

export interface GraphNode extends SimulationNodeDatum {
  readonly id: string;
  readonly userResult: UserResult;
  readonly connectionCount: number;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  readonly source: string;
  readonly target: string;
  readonly value: number;
}

export interface SimulationGraphLink extends SimulationLinkDatum<GraphNode> {
  readonly source: GraphNode;
  readonly target: GraphNode;
  readonly value: number;
}
