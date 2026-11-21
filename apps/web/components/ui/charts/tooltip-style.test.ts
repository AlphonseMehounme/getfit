import { describe, expect, it } from 'vitest';
import { tooltipFormatter } from './tooltip-style';

describe('tooltipFormatter', () => {
  it('formats the value as the table does, under the value column name', () => {
    expect(tooltipFormatter((n) => `${n} km`, 'Distance')(12)).toEqual(['12 km', 'Distance']);
    expect(tooltipFormatter((n) => `${n} km`, 'Distance')('7')).toEqual(['7 km', 'Distance']);
  });
});
