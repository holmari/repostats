import './TeamGraph.css';

import classNames from 'classnames';
import * as d3 from 'd3';
import {D3DragEvent} from 'd3-drag';
import React, {useCallback, useMemo} from 'react';

import {ChartShape, Margins, Size} from '../chart/types';
import D3Chart from '../chart/D3Chart';
import {GraphLink, GraphNode, SimulationGraphLink} from './types';
import {UserResult} from 'types/types';

const lowConnectionColors: ReadonlyArray<string> = [
  '#e6550d', // less connections
  '#fd8d3c',
  '#fdae6b',
  '#fdd0a2', // more connections
];

const highConnectionColors: ReadonlyArray<string> = [
  '#c7e9c0', // less connections
  '#a1d99b',
  '#74c476',
  '#31a354', // more connections
];

const crosshairMargin = 35;
const margins: Margins = {left: 0, top: 0, bottom: 0, right: 0};
// const centeredItemRadius = 15;

interface ProximityGraphConfig {
  readonly shape: ChartShape;
  readonly charge: number;
  readonly centeredIdentifier: string | null;
  readonly defaultItemOpacity: number;
  readonly drawCrosshair: boolean;
  readonly highlightSelection: boolean;
  readonly linkDistance: number;
  readonly linkForceFactor: number;
  readonly relativeLinkValueThreshold: number;
}

function assertDefined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('Required value was undefined');
  }
  return value;
}

function mapConnectionsToColor(relativeConnectionCount: number, colors: ReadonlyArray<string>) {
  const colorIndex = Math.min(
    colors.length - 1,
    Math.floor(relativeConnectionCount * colors.length)
  );
  return colors[colorIndex];
}

function getUserCommitCount(userResult: UserResult): number {
  return d3.sum(userResult.repoTotals.map((totals) => totals.authoredTotals.commits));
}

function getNodeRadius(node: GraphNode, medianCommitCount: number): number {
  if (medianCommitCount > 0) {
    return Math.max(
      3,
      Math.min(20, 2 * Math.sqrt(getUserCommitCount(node.userResult) / medianCommitCount))
    );
  } else {
    return 3;
  }
}

function toSimulationNodeData(nodes: ReadonlyArray<GraphNode>): GraphNode[] {
  // Make a deep copy; d3 modifies these
  return nodes.map((node) => ({...node}));
}

function mergeBidirectionalLinks(links: ReadonlyArray<GraphLink>): ReadonlyArray<GraphLink> {
  const combinedLinks: {[combinedKey: string]: GraphLink} = {};

  links.forEach((link) => {
    combinedLinks[`${link.source}--${link.target}`] = link;
  });

  links.forEach((link) => {
    const reverseKey = `${link.target}--${link.source}`;
    const existingItem = combinedLinks[reverseKey];
    combinedLinks[reverseKey] = {
      ...(existingItem || link),
      value: (existingItem?.value || 0) + link.value,
    };
  });
  return Object.values(combinedLinks);
}

function toSimulationLinksData(links: ReadonlyArray<GraphLink>): SimulationGraphLink[] {
  // Convert the types in a very unsafe way.
  // d3 has pretty strange properties for the nodes and links - it adds properties to them,
  // such as x and y coordinates, that are needed later. If this was done in d3 by nesting
  // objects, this could be done in a type-safe way, but instead the existing keys `source`
  // and `target` are replaced.
  return Object.values(links).map((link) => ({...link} as any));
}

function isLinkSelected(link: GraphLink, selectedIdentifier: string | null) {
  return link.source === selectedIdentifier || link.target === selectedIdentifier;
}

/**
 * Filter out the links that are below the given relative percentage, between [0..1].
 * For example, if relativeThreshold is 0.1, all links that have under 10% of the maximum
 * interaction are filtered out.
 */
function insignificantLinkFilter(
  maxLinkValue: number,
  relativeThreshold: number,
  selectedIdentifier: string | null
): (link: GraphLink) => boolean {
  return (link) =>
    link.value / maxLinkValue >= relativeThreshold || isLinkSelected(link, selectedIdentifier);
}

function drag(
  simulation: d3.Simulation<GraphNode, undefined>
): d3.DragBehavior<Element, GraphNode, GraphNode | undefined> {
  function dragSubject(event: D3DragEvent<Element, GraphNode, GraphNode>) {
    return simulation.find(event.x, event.y);
  }

  function dragStarted(event: D3DragEvent<Element, GraphNode, GraphNode>) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event: D3DragEvent<Element, GraphNode, GraphNode>) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragEnded(event: D3DragEvent<Element, GraphNode, GraphNode>) {
    if (!event.active) {
      simulation.alphaTarget(0);
    }
    event.subject.fx = null;
    event.subject.fy = null;
  }

  return d3
    .drag<Element, GraphNode, GraphNode | undefined>()
    .subject(dragSubject)
    .on('start', dragStarted)
    .on('drag', dragged)
    .on('end', dragEnded);
}

function scale(min: number, max: number, factor: number) {
  return min + (max - min) * factor;
}

function renderGraph(
  chart: d3.Selection<SVGGElement, unknown, null, undefined>,
  config: ProximityGraphConfig,
  sourceNodes: ReadonlyArray<GraphNode>,
  sourceLinks: ReadonlyArray<GraphLink>
) {
  const nodes = toSimulationNodeData(sourceNodes);

  let selectedIdentifier: string | null = null;
  function updateSelection(selectedId: string | null) {
    selectedIdentifier = selectedId;
  }

  const mergedLinks = mergeBidirectionalLinks(sourceLinks);
  const maxLinkValue = Math.max(...mergedLinks.map((link) => link.value));
  const links = toSimulationLinksData(
    mergedLinks.filter(
      insignificantLinkFilter(maxLinkValue, config.relativeLinkValueThreshold, selectedIdentifier)
    )
  );

  const medianCommitCount =
    d3.median(
      nodes
        .map((node) => getUserCommitCount(node.userResult))
        .filter((count) => count > 0)
        .sort((a, b) => a - b)
    ) || 0;
  const medianConnectionCount = d3.median(nodes.map((node) => node.connectionCount)) || 1;

  const maxConnectionCount = Math.max(...nodes.map((node) => node.connectionCount));

  const simulation = d3
    .forceSimulation(nodes)
    .force('charge', d3.forceManyBody())
    .force(
      'link',
      d3
        .forceLink<GraphNode, SimulationGraphLink>(links)
        .id((d) => d.id)
        .strength((d) => (config.linkForceFactor * d.value) / maxLinkValue)
    )
    .force('center', d3.forceCenter(config.shape.size.width / 2, config.shape.size.height / 2))
    .force(
      'collide',
      d3
        .forceCollide()
        .radius((d) => {
          const relativeConnectionCount = nodes[d.index!].connectionCount / maxConnectionCount;
          // the more connections, the smaller the radius
          return scale(30, 60, 1 - relativeConnectionCount);
        })
        .iterations(2)
    );

  if (config.centeredIdentifier) {
    const node = nodes.find((node) => node.id === config.centeredIdentifier);
    if (node) {
      node.fx = config.shape.size.width / 2;
      node.fy = config.shape.size.height / 2;
    }
  }

  const legendTitle = chart
    .append('text')
    .attr('class', 'TeamGraph__legend-title')
    .attr('x', 16)
    .attr('y', 24)
    .text(null); // updated on hover

  if (config.drawCrosshair) {
    chart
      .append('line')
      .attr('x1', crosshairMargin)
      .attr('y1', config.shape.size.height / 2)
      .attr('x2', config.shape.size.width - crosshairMargin)
      .attr('y2', config.shape.size.height / 2)
      .attr('stroke-width', 0.5)
      .attr('stroke', '#dddddd')
      .attr('fill-opacity', 0.5);
    chart
      .append('line')
      .attr('x1', config.shape.size.width / 2)
      .attr('y1', crosshairMargin)
      .attr('x2', config.shape.size.width / 2)
      .attr('y2', config.shape.size.height - crosshairMargin)
      .attr('stroke-width', 0.5)
      .attr('stroke', '#dddddd')
      .attr('fill-opacity', 0.5);
  }

  const link = chart
    .append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('class', 'TeamGraph__link')
    .attr('stroke-opacity', (d) => {
      if (!config.centeredIdentifier) {
        return 0.6;
      }
      if (d.source.id === config.centeredIdentifier || d.target.id === config.centeredIdentifier) {
        return 0.75;
      }
      return 0.25;
    })
    .attr('stroke', (d) => {
      if (!config.centeredIdentifier) {
        return '#999';
      }
      if (d.source.id === config.centeredIdentifier || d.target.id === config.centeredIdentifier) {
        return '#707070';
      }
      return '#bbb';
    })
    .attr('stroke-width', (d) => 10 * (d.value / maxLinkValue));

  const nodeDragBehavior = drag(simulation);
  const node = chart
    .append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('class', (d) =>
      classNames('TeamGraph__node', {
        centered:
          d.userResult.id === config.centeredIdentifier || d.userResult.id === selectedIdentifier,
      })
    )
    .on('mouseover', function (_, d) {
      updateSelection(d.userResult.id);
      if (config.highlightSelection) {
        d3.select(this).classed('selected', true);
        legendTitle.text(d.userResult.displayName);
      }
    })
    .on('mouseout', function () {
      updateSelection(null);
      d3.select(this).classed('selected', false);
      legendTitle.text(null);
    })
    .attr('r', (d) => getNodeRadius(d, medianCommitCount))
    .style('fill', (d) => {
      const relativeConnectionCount = d.connectionCount / medianConnectionCount;
      if (relativeConnectionCount >= 1) {
        return mapConnectionsToColor(d.connectionCount / maxConnectionCount, highConnectionColors);
      } else {
        return mapConnectionsToColor(relativeConnectionCount, lowConnectionColors);
      }
    })
    .call(nodeDragBehavior as any); // Hack: this `any` cast is due to strict nullness checks

  node
    .classed('selected', function (d) {
      return d.userResult.id === selectedIdentifier;
    })
    .attr('fill-opacity', function (d) {
      if (config.highlightSelection) {
        return d.userResult.id === selectedIdentifier ? 1 : config.defaultItemOpacity;
      } else {
        return config.defaultItemOpacity;
      }
    });

  simulation.on('tick', () => {
    link
      .attr('x1', (d) => d.source.x!)
      .attr('y1', (d) => d.source.y!)
      .attr('x2', (d) => d.target.x!)
      .attr('y2', (d) => d.target.y!);

    node.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);
  });
}

const TeamGraph: React.FC<Props> = ({
  charge,
  centeredIdentifier,
  defaultItemOpacity,
  drawCrosshair,
  highlightSelection,
  linkDistance,
  linkForceFactor,
  relativeLinkValueThreshold,
  size,
  nodes,
  links,
}) => {
  if (!size) {
    throw new Error(`size must be defined; was '${size}'`);
  }

  const config = useMemo<ProximityGraphConfig>(
    () => ({
      shape: {size, margins},
      charge: assertDefined(charge),
      centeredIdentifier: assertDefined(centeredIdentifier),
      defaultItemOpacity: assertDefined(defaultItemOpacity),
      drawCrosshair: assertDefined(drawCrosshair),
      highlightSelection,
      linkDistance: assertDefined(linkDistance),
      linkForceFactor: assertDefined(linkForceFactor),
      relativeLinkValueThreshold: assertDefined(relativeLinkValueThreshold),
    }),
    [
      centeredIdentifier,
      charge,
      defaultItemOpacity,
      drawCrosshair,
      highlightSelection,
      linkDistance,
      linkForceFactor,
      relativeLinkValueThreshold,
      size,
    ]
  );

  const render = useCallback(
    (chart: d3.Selection<SVGGElement, unknown, null, undefined>) => {
      renderGraph(chart, config, nodes, links);
    },
    [config, nodes, links]
  );

  return <D3Chart className="TeamGraph" size={size} margins={margins} renderChart={render} />;
};
TeamGraph.displayName = 'TeamGraph';
TeamGraph.defaultProps = {
  centeredIdentifier: null,
  charge: -200,
  defaultItemOpacity: 0.6,
  drawCrosshair: false,
  highlightSelection: true,
  linkDistance: 25,
  linkForceFactor: 1,
  relativeLinkValueThreshold: 0.025,
  size: {width: 1050, height: 700},
  selectedIdentifier: null,
};

interface Props {
  charge?: number;
  centeredIdentifier?: string | null;
  defaultItemOpacity?: number;
  drawCrosshair?: boolean;
  highlightSelection: boolean;
  linkDistance?: number;
  linkForceFactor?: number;
  relativeLinkValueThreshold?: number;
  selectedIdentifier?: string | null;
  size?: Size;
  nodes: ReadonlyArray<GraphNode>;
  links: ReadonlyArray<GraphLink>;
}

export default TeamGraph;
