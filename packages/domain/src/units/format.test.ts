import { describe, expect, it } from 'vitest';
import { formatDuration, formatPace } from './format';

describe('formatPace', () => {
  it('BR-23 / D2: 440 s/km is "7:20"', () => {
    expect(formatPace(440)).toBe('7:20');
    expect(formatPace(440.0369)).toBe('7:20');
  });

  it('BR-23: rounding at 59.5 s never produces "x:60"', () => {
    expect(formatPace(479.5)).toBe('8:00');
    expect(formatPace(419.5)).toBe('7:00');
    expect(formatPace(59.5)).toBe('1:00');
    expect(formatPace(479.49)).toBe('7:59');
  });

  it('pads seconds and keeps minutes unpadded', () => {
    expect(formatPace(150)).toBe('2:30');
    expect(formatPace(1200)).toBe('20:00');
    expect(formatPace(65)).toBe('1:05');
    expect(formatPace(0)).toBe('0:00');
  });

  it.each([-1, Number.NaN, Infinity])('rejects %d', (value) => {
    expect(() => formatPace(value)).toThrow(RangeError);
  });
});

describe('formatDuration', () => {
  it('D2: 4,770 s is "1:19:30"', () => {
    expect(formatDuration(4770)).toBe('1:19:30');
  });

  it('uses m:ss under one hour', () => {
    expect(formatDuration(1800)).toBe('30:00');
    expect(formatDuration(45)).toBe('0:45');
  });

  it('rounds the total, never showing ":60"', () => {
    expect(formatDuration(3599.5)).toBe('1:00:00');
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(36_005)).toBe('10:00:05');
  });

  it.each([-1, Number.NaN])('rejects %d', (value) => {
    expect(() => formatDuration(value)).toThrow(RangeError);
  });
});
