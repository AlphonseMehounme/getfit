'use client';

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartFigure, PointsTable } from './chart-figure';
import { TOOLTIP_PROPS, tooltipFormatter } from './tooltip-style';
import { AXIS_TICK, CHART_HEIGHT, type SeriesChartProps } from './types';

// Design-system bar chart (PRD §6.8: weekly volume and distance). One series in the accent colour, no animation.

export function BarChart(props: SeriesChartProps) {
  const { title, summary, categoryLabel, valueLabel, points, formatValue, empty } = props;
  const rows = points.map((p) => ({ key: p.key, label: p.label, value: formatValue(p.value) }));
  return (
    <ChartFigure
      title={title}
      summary={summary}
      empty={empty}
      isEmpty={points.length === 0}
      table={
        <PointsTable
          caption={title}
          categoryLabel={categoryLabel}
          valueLabel={valueLabel}
          rows={rows}
        />
      }
    >
      <ResponsiveContainer
        width="100%"
        height={CHART_HEIGHT}
        initialDimension={{ width: 320, height: CHART_HEIGHT }}
      >
        <RechartsBarChart data={[...points]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} stroke="var(--border)" tickLine={false} />
          <YAxis
            tick={AXIS_TICK}
            tickFormatter={formatValue}
            stroke="var(--border)"
            tickLine={false}
            width={56}
          />
          <Tooltip
            {...TOOLTIP_PROPS}
            cursor={{ fill: 'var(--surface)' }}
            formatter={tooltipFormatter(formatValue, valueLabel)}
          />
          <Bar
            dataKey="value"
            fill="var(--accent)"
            radius={[6, 6, 0, 0]}
            isAnimationActive={false}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
