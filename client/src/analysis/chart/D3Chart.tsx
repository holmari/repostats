import classNames from 'classnames';
import * as d3 from 'd3';
import React, {useEffect, useRef} from 'react';

import {ChartShape, Margins, Size} from './types';

function createSvgCanvas(parent: HTMLDivElement, size: Size, margin: Margins) {
  return d3
    .select(parent)
    .append('svg')
    .attr('width', size.width + margin.left + margin.right)
    .attr('height', size.height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
}

const D3Chart: React.FC<Props> = ({className, margins, renderChart, size}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  if (!size) {
    throw new Error(`size must be defined; was '${size}'`);
  }
  if (!margins) {
    throw new Error(`margin must be defined; was '${margins}'`);
  }

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }
    const parent = chartRef.current;

    const chart = createSvgCanvas(parent, size, margins);
    renderChart(chart, {size, margins});

    return () => {
      while (parent.firstChild) {
        parent.firstChild.remove();
      }
    };
  }, [chartRef, margins, renderChart, size]);

  return <div className={classNames('D3Chart', className)} ref={chartRef} />;
};
interface Props {
  className?: string;
  margins: Margins;
  renderChart: (
    svg: d3.Selection<SVGGElement, unknown, null, undefined>,
    shape: ChartShape
  ) => void;
  size: Size;
}

export default D3Chart;
