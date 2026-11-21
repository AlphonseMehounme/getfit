import type { ChartEmpty } from './chart-figure';

/** One point of a line or bar chart. `label` is the category, already formatted (e.g. "23 Nov"). */
export interface ChartPoint {
  key: string;
  label: string;
  value: number;
}

/** What the line and bar charts share. Every string comes translated from the caller; no rule lives here. */
export interface SeriesChartProps {
  title: string;
  summary: string;
  /** The table's first column header, e.g. "Week". */
  categoryLabel: string;
  /** The table's value column header, with its unit, e.g. "Distance (km)". */
  valueLabel: string;
  points: readonly ChartPoint[];
  /** Formats ticks, tooltips and the table (units and locale are the caller's). */
  formatValue: (value: number) => string;
  empty: ChartEmpty;
}

/** The chart's drawing height, in px. Its width follows its container (360 px to 1440 px). */
export const CHART_HEIGHT = 220;

/** Axis ticks in the muted tone, with tabular numbers (PRD §9). */
export const AXIS_TICK = {
  fill: 'var(--muted)',
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
} as const;
