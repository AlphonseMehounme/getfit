// SQL literal helpers for the generated seed. Postgres runs with standard_conforming_strings on,
// so a quote is the only character to escape inside '…'.

export function literal(value: string): string {
  if (value.includes('\u0000')) throw new RangeError('SQL text cannot contain a NUL character');
  return `'${value.replaceAll("'", "''")}'`;
}

export const nullable = (value: string | null) => (value === null ? 'null' : literal(value));

export const bool = (value: boolean) => (value ? 'true' : 'false');

/** A typed array literal, e.g. `array['lats', 'biceps']::text[]`; empty arrays keep their type. */
export function array(values: readonly string[], type: string): string {
  if (values.length === 0) return `'{}'::${type}[]`;
  return `array[${values.map(literal).join(', ')}]::${type}[]`;
}

export const jsonb = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;
