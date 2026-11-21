'use client';

import { useTranslations } from 'next-intl';
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartFigure, PointsTable } from './chart-figure';
import { TOOLTIP_PROPS, tooltipFormatter } from './tooltip-style';
import { AXIS_TICK, CHART_HEIGHT, type SeriesChartProps } from './types';

// Design-system line chart (PRD §6.8: performance over time). One series in the accent colour, with no animation
// (PRD §9, reduced motion). A baseline is a labelled reference line, never a point of the series (BR-26).

export function LineChart({
  baseline,
  invertY = false,
  ...props
}: SeriesChartProps & {
  /** BR-26: the starting reference, drawn as a labelled dashed line. */
  baseline?: { value: number; label: string };
  /** For pace, where lower is better: the axis runs downwards so "up" still reads as better. */
  invertY?: boolean;
}) {
  const t = useTranslations('Charts');
  const { title, summary, categoryLabel, valueLabel, points, formatValue, empty } = props;
  const rows = points.map((p) => ({ key: p.key, label: p.label, value: formatValue(p.value) }));
  if (baseline)
    rows.unshift({
      key: 'baseline',
      label: t('baseline', { label: baseline.label }),
      value: formatValue(baseline.value),
    });

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
        <RechartsLineChart data={[...points]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} stroke="var(--border)" tickLine={false} />
          <YAxis
            reversed={invertY}
            tick={AXIS_TICK}
            tickFormatter={formatValue}
            stroke="var(--border)"
            tickLine={false}
            width={56}
            domain={['auto', 'auto']}
          />
          <Tooltip {...TOOLTIP_PROPS} formatter={tooltipFormatter(formatValue, valueLabel)} />
          {baseline ? (
            <ReferenceLine
              y={baseline.value}
              stroke="var(--muted)"
              strokeDasharray="4 4"
              label={{
                value: t('baseline', { label: baseline.label }),
                fill: 'var(--muted)',
                fontSize: 12,
                position: 'insideTopLeft',
              }}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--accent)' }}
            isAnimationActive={false}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
