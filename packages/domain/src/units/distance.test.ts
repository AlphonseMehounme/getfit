import { describe, expect, it } from 'vitest';
import { distanceUnitFor, metresTo, toMetres } from './distance';

describe('distance units', () => {
  it('picks km for metric and mi for imperial', () => {
    expect(distanceUnitFor('metric')).toBe('km');
    expect(distanceUnitFor('imperial')).toBe('mi');
  });

  it('D2: 10,840 m is 10.84 km and about 6.74 mi', () => {
    expect(metresTo(10_840, 'km')).toBe(10.84);
    expect(metresTo(10_840, 'mi')).toBeCloseTo(6.7357, 4);
  });

  it('BR-20: user input becomes whole metres', () => {
    expect(toMetres(10.84, 'km')).toBe(10_840);
    expect(toMetres(1, 'mi')).toBe(1609);
    expect(toMetres(6.2137, 'mi')).toBe(10_000);
  });

  it('BR-20: whole metres round-trip through km and mi', () => {
    for (const metres of [1, 400, 1609, 7000, 10_840, 42_195]) {
      expect(toMetres(metresTo(metres, 'km'), 'km')).toBe(metres);
      expect(toMetres(metresTo(metres, 'mi'), 'mi')).toBe(metres);
    }
  });

  it.each([Number.NaN, Infinity])('rejects %d', (value) => {
    expect(() => metresTo(value, 'km')).toThrow(RangeError);
    expect(() => toMetres(value, 'mi')).toThrow(RangeError);
  });
});
