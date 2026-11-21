/** Tooltip colours from the design tokens, so both themes follow (PRD §9). */
export const TOOLTIP_PROPS = {
  contentStyle: {
    background: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    color: 'var(--foreground)',
  },
  labelStyle: { color: 'var(--muted)' },
  itemStyle: { color: 'var(--foreground)' },
  isAnimationActive: false,
} as const;

/** The tooltip shows the value as the table does, under the value column's name. */
export const tooltipFormatter =
  (formatValue: (value: number) => string, valueLabel: string) =>
  (value: unknown): [string, string] => [formatValue(Number(value)), valueLabel];
