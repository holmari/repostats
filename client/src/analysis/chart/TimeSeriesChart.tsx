import './TimeSeriesChart.css';

import {useCallback} from 'react';
import * as d3 from 'd3';

import {removeDuplicates} from 'arrays/utils';
import {formatIsoDate, getMaxDate, getMinDate} from 'date/utils';
import {DEFAULT_MARGINS, DEFAULT_SIZE} from './utils';

import D3Chart from './D3Chart';
import {ChartDataSeries, ChartShape, DateValue, Margins, Size} from './types';

interface VerticalGuide {
  readonly show: () => void;
  readonly hide: () => void;
  readonly updatePosition: (position: [number, number]) => void;
}

interface SvgTimeSeriesChartContext {
  readonly svg: d3.Selection<SVGGElement, unknown, null, undefined>;
  readonly chartShape: ChartShape;
  readonly xDomain: [Date, Date];
  readonly series: ReadonlyArray<ChartDataSeries>;
  readonly xScale: d3.ScaleTime<number, number, never>;
  readonly yScale: d3.ScaleLinear<number, number, never>;
}

const dateBisector = d3.bisector<DateValue, Date>((datum) => datum.date).left;

function getClosestValueToDate(referenceDate: Date, dataSeries: ChartDataSeries): number | null {
  const series = dataSeries.series;
  const refEpoch = referenceDate.getTime();
  const index = dateBisector(series, referenceDate, 1);
  if (index >= series.length) {
    return null;
  }

  return series[index].date.getTime() - refEpoch > series[index - 1].date.getTime() - refEpoch
    ? series[index - 1].value
    : series[index].value;
}

function createLegendItem(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  series: ChartDataSeries,
  x: number,
  y: number,
  legendItemSize = 16,
  fontSize = 12
) {
  parent
    .append('rect')
    .attr('width', legendItemSize)
    .attr('height', legendItemSize)
    .attr('x', x)
    .attr('y', y)
    .style('fill', series.color);

  parent
    .append('text')
    .attr('class', 'TimeSeriesChart__legend-item')
    .attr('x', x + legendItemSize + 12)
    .attr('y', y + legendItemSize - fontSize / 2)
    .style('font-size', `${fontSize}px`)
    .style('alignment-baseline', 'middle')
    .text(series.label);

  return parent
    .append('text')
    .attr('class', 'TimeSeriesChart__legend-item')
    .attr('x', x + 160)
    .attr('y', y + legendItemSize - fontSize / 2)
    .style('font-size', `${fontSize}px`)
    .style('alignment-baseline', 'middle')
    .text(''); // updated at runtime
}

function createLegendItems(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  context: SvgTimeSeriesChartContext,
  x = 10,
  y = context.chartShape.margins.top + 16
): ReadonlyArray<d3.Selection<SVGTextElement, unknown, null, undefined>> {
  return context.series.map((seriesItem, index) => {
    return createLegendItem(parent, seriesItem, x, y + 24 * index);
  });
}

function createLegend(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  context: SvgTimeSeriesChartContext,
  x = 0,
  y = 0,
  paddingX = 10,
  paddingY = context.chartShape.margins.top + 16
): [
  d3.Selection<SVGGElement, unknown, null, undefined>,
  ReadonlyArray<d3.Selection<SVGTextElement, unknown, null, undefined>>
] {
  const legendContainer = parent
    .append('g')
    .attr('class', 'chartLegend')
    .attr('transform', `translate(${x},${y})`);

  return [legendContainer, createLegendItems(legendContainer, context, paddingX, paddingY)];
}

function createVerticalGuide(
  context: SvgTimeSeriesChartContext,
  legendSize: Size = {width: 210, height: 120},
  legendMargin: number = 10
): VerticalGuide {
  const guideLine = context.svg
    .append('line')
    .attr('class', 'TimeSeriesChart__vertical-guide')
    .attr('x1', 100)
    .attr('y1', 0)
    .attr('x2', 100)
    .attr('y2', context.chartShape.size.height)
    .style('visibility', 'hidden');

  const dynamicLegendGroup = context.svg.append('g').style('visibility', 'hidden');
  dynamicLegendGroup
    .append('rect')
    .attr('class', 'TimeSeriesChart__legend-background')
    .attr('width', legendSize.width)
    .attr('height', legendSize.height);

  const legendHeader = dynamicLegendGroup
    .append('text')
    .attr('class', 'TimeSeriesChart__legend-title')
    .attr('x', 10)
    .attr('y', context.chartShape.margins.top);

  const focusDotsGroup = context.svg
    .append('g')
    .attr('class', 'focusCircleGroup')
    .style('visibility', 'hidden');

  const focusDots: ReadonlyArray<
    d3.Selection<SVGCircleElement, unknown, null, undefined>
  > = context.series.map((seriesItem) =>
    focusDotsGroup.append('circle').attr('r', 5).style('fill', seriesItem.color)
  );

  const legendItems = createLegendItems(dynamicLegendGroup, context);

  function setVisibility(isVisible: boolean) {
    const visibility = isVisible ? 'visible' : 'hidden';

    guideLine.style('visibility', visibility);
    dynamicLegendGroup.style('visibility', visibility);
    focusDotsGroup.style('visibility', visibility);
  }

  return {
    show: () => setVisibility(true),
    hide: () => setVisibility(false),
    updatePosition: ([x]: [number, number]) => {
      guideLine.attr('x1', x).attr('x2', x);

      const legendGroupX =
        x + legendSize.width >= context.chartShape.size.width
          ? x - legendMargin - legendSize.width
          : x + legendMargin;
      dynamicLegendGroup.attr('transform', 'translate(' + legendGroupX + ',' + legendMargin + ')');

      const date = getMaxDate(
        context.xDomain[0],
        getMinDate(context.xScale.invert(x), context.xDomain[1])
      );

      legendHeader.text(formatIsoDate(date.toISOString()));

      focusDots.forEach((focusDotItem, index) => {
        const value = getClosestValueToDate(date, context.series[index]);
        if (value === null) {
          return;
        }

        focusDotItem.attr('cx', x).attr('cy', context.yScale(value));

        legendItems[index].text(value);
      });
    },
  };
}

function renderChart(
  svg: d3.Selection<SVGGElement, unknown, null, undefined>,
  shape: ChartShape,
  series: ReadonlyArray<ChartDataSeries>
) {
  const dates = removeDuplicates(
    series
      .flatMap((item) => item.series)
      .map((dateValue) => dateValue.date)
      .sort((a, b) => a.getTime() - b.getTime())
  );
  const xDomain = dates.length ? [new Date(dates[0]), new Date(dates[dates.length - 1])] : [];
  const isValid = xDomain.length === 2;

  const xScale = d3.scaleTime([0, shape.size.width]).domain(xDomain);
  const yScale = d3
    .scaleLinear([shape.size.height, 0])
    .domain([
      0,
      d3.max(series.map((item) => d3.max(item.series.map((value) => value.value)) || 0)) || 0,
    ]);

  const xAxis = d3.axisBottom(xScale).tickFormat((dateOrNumber) => {
    const date: Date = dateOrNumber as Date;
    const formatter = d3.timeYear(date) < date ? d3.timeFormat('%B') : d3.timeFormat('%Y');
    return formatter(date);
  });
  const yAxis = d3.axisLeft(yScale);

  svg
    .append('g')
    .attr('class', 'y TimeSeriesChart__axis')
    .append('text')
    .attr('class', 'TimeSeriesChart__axis-label')
    .attr('transform', 'rotate(90) translate(' + shape.size.height / 2 + ', 0)')
    .attr('x', 0)
    .attr('y', shape.margins.left - 6)
    .style('text-anchor', 'middle')
    .text('Actions');

  if (isValid) {
    const context: SvgTimeSeriesChartContext = {
      svg,
      chartShape: shape,
      series,
      xDomain: [xDomain[0], xDomain[1]],
      xScale,
      yScale,
    };

    const [legend] = createLegend(svg, context, 16, 0, 0, 0);

    series.forEach((seriesItem) => {
      const seriesMapper = d3
        .line<DateValue>()
        .curve(d3.curveStepAfter)
        .x((datum) => xScale(datum.date))
        .y((datum) => yScale(datum.value));

      svg
        .append('path')
        .datum(seriesItem)
        .attr('class', 'TimeSeriesChart__line')
        .style('stroke', seriesItem.color)
        .attr('d', seriesMapper(seriesItem.series)!);
    });

    const verticalGuide = createVerticalGuide(context);

    svg
      .append('rect')
      .attr('width', shape.size.width + shape.margins.left + shape.margins.right)
      .attr('height', shape.size.height + shape.margins.top + shape.margins.bottom)
      .attr('fill', 'transparent')
      .on('mouseover', (event) => {
        verticalGuide.show();
        verticalGuide.updatePosition(d3.pointer(event));
        legend.style('visibility', 'hidden');
      })
      .on('mouseout', () => {
        verticalGuide.hide();
        legend.style('visibility', 'visible');
      })
      .on('mousemove', (event) => {
        verticalGuide.updatePosition(d3.pointer(event));
      });
  }

  svg
    .append('g')
    .attr('class', 'x TimeSeriesChart__axis')
    .attr('transform', 'translate(0,' + shape.size.height + ')')
    .call(xAxis);

  svg.append('g').attr('class', 'y TimeSeriesChart__axis').call(yAxis);

  return isValid;
}

const TimeSeriesChart: React.FC<Props> = ({data, margins, size}) => {
  const render = useCallback(
    (chart: d3.Selection<SVGGElement, unknown, null, undefined>, shape: ChartShape) => {
      renderChart(chart, shape, data);
    },
    [data]
  );

  if (!size) {
    throw new Error(`size must be defined; was '${size}'`);
  }
  if (!margins) {
    throw new Error(`margin must be defined; was '${margins}'`);
  }

  return <D3Chart size={size} margins={margins} renderChart={render} />;
};
TimeSeriesChart.displayName = 'TimeSeriesChart';
TimeSeriesChart.defaultProps = {
  margins: DEFAULT_MARGINS,
  size: DEFAULT_SIZE,
};
interface Props {
  data: ReadonlyArray<ChartDataSeries>;
  margins?: Margins;
  size?: Size;
}

export default TimeSeriesChart;
