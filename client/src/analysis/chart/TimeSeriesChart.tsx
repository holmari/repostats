import './TimeSeriesChart.css';

import React, {useCallback, useState} from 'react';
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

interface LegendItemElements {
  readonly rect: d3.Selection<SVGRectElement, unknown, null, undefined>;
  readonly label: d3.Selection<SVGTextElement, unknown, null, undefined>;
  readonly value: d3.Selection<SVGTextElement, unknown, null, undefined>;
  readonly clickArea: d3.Selection<SVGRectElement, unknown, null, undefined>;
}

function createLegendItem(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  series: ChartDataSeries,
  x: number,
  y: number,
  isHidden: boolean,
  onToggle: (() => void) | null,
  legendItemSize = 16,
  fontSize = 12
): LegendItemElements {
  const rect = parent
    .append('rect')
    .attr('width', legendItemSize)
    .attr('height', legendItemSize)
    .attr('x', x)
    .attr('y', y)
    .style('fill', series.color)
    .style('opacity', isHidden ? 0.3 : 1);

  const label = parent
    .append('text')
    .attr('class', 'TimeSeriesChart__legend-item')
    .attr('x', x + legendItemSize + 12)
    .attr('y', y + legendItemSize - fontSize / 2)
    .style('font-size', `${fontSize}px`)
    .style('alignment-baseline', 'middle')
    .style('text-decoration', isHidden ? 'line-through' : 'none')
    .style('opacity', isHidden ? 0.5 : 1)
    .text(series.label);

  const value = parent
    .append('text')
    .attr('class', 'TimeSeriesChart__legend-item')
    .attr('x', x + 160)
    .attr('y', y + legendItemSize - fontSize / 2)
    .style('font-size', `${fontSize}px`)
    .style('alignment-baseline', 'middle')
    .style('opacity', isHidden ? 0.5 : 1)
    .text(''); // updated at runtime

  // Invisible click area for easier clicking
  const clickArea = parent
    .append('rect')
    .attr('width', 200)
    .attr('height', legendItemSize + 4)
    .attr('x', x)
    .attr('y', y - 2)
    .style('fill', 'transparent')
    .style('cursor', onToggle ? 'pointer' : 'default');

  if (onToggle) {
    clickArea.on('click', onToggle);
  }

  return {rect, label, value, clickArea};
}

function createLegendItems(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  context: SvgTimeSeriesChartContext,
  hiddenSeriesLabels: ReadonlySet<string>,
  onToggleSeries: ((label: string) => void) | null,
  x = 10,
  y = context.chartShape.margins.top + 16
): ReadonlyArray<LegendItemElements> {
  return context.series.map((seriesItem, index) => {
    const isHidden = hiddenSeriesLabels.has(seriesItem.label);
    const onToggle = onToggleSeries ? () => onToggleSeries(seriesItem.label) : null;
    return createLegendItem(parent, seriesItem, x, y + 24 * index, isHidden, onToggle);
  });
}

interface ChartLegendProps {
  series: ReadonlyArray<ChartDataSeries>;
  hiddenSeriesLabels: ReadonlySet<string>;
  onToggleSeries: (label: string) => void;
  maxHeight?: number;
}

const ChartLegend: React.FC<ChartLegendProps> = ({
  series,
  hiddenSeriesLabels,
  onToggleSeries,
  maxHeight,
}) => {
  return (
    <div
      className="TimeSeriesChart__legend"
      style={{
        width: 200,
        maxHeight: maxHeight,
        overflowY: 'auto',
        overflowX: 'hidden',
        cursor: 'pointer',
      }}
    >
      {series.map((seriesItem) => {
        const isHidden = hiddenSeriesLabels.has(seriesItem.label);
        return (
          <div
            key={seriesItem.label}
            className="TimeSeriesChart__legend-row"
            onClick={() => onToggleSeries(seriesItem.label)}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 24,
              padding: '0 8px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                minWidth: 14,
                backgroundColor: seriesItem.color,
                opacity: isHidden ? 0.3 : 1,
                marginRight: 8,
              }}
            />
            <div
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textDecoration: isHidden ? 'line-through' : 'none',
                opacity: isHidden ? 0.5 : 1,
              }}
            >
              {seriesItem.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};


function createVerticalGuide(
  context: SvgTimeSeriesChartContext,
  hiddenSeriesLabels: ReadonlySet<string>,
  legendMargin: number = 10
): VerticalGuide {
  // Calculate dynamic legend height based on number of series
  const headerHeight = 30;
  const itemHeight = 24;
  const padding = 16;
  const legendHeight = headerHeight + context.series.length * itemHeight + padding;
  const legendSize: Size = {width: 210, height: legendHeight};

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

  // Tooltip legend doesn't need click handlers, and shows hidden items with reduced opacity
  const legendItems = createLegendItems(dynamicLegendGroup, context, hiddenSeriesLabels, null);

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
        const seriesItem = context.series[index];
        const isHidden = hiddenSeriesLabels.has(seriesItem.label);
        const value = getClosestValueToDate(date, seriesItem);
        if (value === null) {
          return;
        }

        focusDotItem
          .attr('cx', x)
          .attr('cy', context.yScale(value))
          .style('opacity', isHidden ? 0.3 : 1);

        legendItems[index].value.text(value);
      });
    },
  };
}

function renderChart(
  svg: d3.Selection<SVGGElement, unknown, null, undefined>,
  shape: ChartShape,
  series: ReadonlyArray<ChartDataSeries>,
  hiddenSeriesLabels: ReadonlySet<string>
) {
  // Filter to visible series for calculations
  const visibleSeries = series.filter((s) => !hiddenSeriesLabels.has(s.label));

  const dates = removeDuplicates(
    series
      .flatMap((item) => item.series)
      .map((dateValue) => dateValue.date)
      .sort((a, b) => a.getTime() - b.getTime())
  );
  const xDomain = dates.length ? [new Date(dates[0]), new Date(dates[dates.length - 1])] : [];
  const isValid = xDomain.length === 2;

  const xScale = d3.scaleTime([0, shape.size.width]).domain(xDomain);
  // Y-scale based on visible series only
  const yScale = d3
    .scaleLinear([shape.size.height, 0])
    .domain([
      0,
      d3.max(visibleSeries.map((item) => d3.max(item.series.map((value) => value.value)) || 0)) || 0,
    ]);

  // Adjust tick count and format based on chart width
  const tickCount = Math.max(2, Math.floor(shape.size.width / 80));
  const useShortFormat = shape.size.width < 600;

  const xAxis = d3
    .axisBottom(xScale)
    .ticks(tickCount)
    .tickFormat((dateOrNumber) => {
      const date: Date = dateOrNumber as Date;
      const isYearBoundary = d3.timeYear(date) >= date;
      if (isYearBoundary) {
        return d3.timeFormat('%Y')(date);
      }
      // Use short month format for smaller charts
      const monthFormat = useShortFormat ? '%b' : '%B';
      return d3.timeFormat(monthFormat)(date);
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

    // Only render lines for visible series
    visibleSeries.forEach((seriesItem) => {
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

    const verticalGuide = createVerticalGuide(context, hiddenSeriesLabels);

    // Overlay only covers the chart area, not the legend on the right
    svg
      .append('rect')
      .attr('width', shape.size.width)
      .attr('height', shape.size.height)
      .attr('fill', 'transparent')
      .on('mouseover', (event) => {
        verticalGuide.show();
        verticalGuide.updatePosition(d3.pointer(event));
      })
      .on('mouseout', () => {
        verticalGuide.hide();
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

const TimeSeriesChart: React.FC<Props> = ({data, margins = DEFAULT_MARGINS, size = DEFAULT_SIZE}) => {
  const [hiddenSeriesLabels, setHiddenSeriesLabels] = useState<Set<string>>(new Set());

  const toggleSeries = useCallback((label: string) => {
    setHiddenSeriesLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }, []);

  const render = useCallback(
    (chart: d3.Selection<SVGGElement, unknown, null, undefined>, shape: ChartShape) => {
      renderChart(chart, shape, data, hiddenSeriesLabels);
    },
    [data, hiddenSeriesLabels]
  );

  // Legend max height = chart height + margins
  const legendMaxHeight = size.height + margins.top + margins.bottom;

  return (
    <div className="TimeSeriesChart__container" style={{display: 'flex'}}>
      <D3Chart size={size} margins={margins} renderChart={render} />
      <ChartLegend
        series={data}
        hiddenSeriesLabels={hiddenSeriesLabels}
        onToggleSeries={toggleSeries}
        maxHeight={legendMaxHeight}
      />
    </div>
  );
};
TimeSeriesChart.displayName = 'TimeSeriesChart';
interface Props {
  data: ReadonlyArray<ChartDataSeries>;
  margins?: Margins;
  size?: Size;
}

export default TimeSeriesChart;
