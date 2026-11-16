import { describe, expect, it } from 'vitest';
import en from './en.json';
import fr from './fr.json';

function keyPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function leafValues(value: unknown): unknown[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [value];
  return Object.values(value).flatMap(leafValues);
}

// AGENTS §9 / D15: every user-facing string exists in both catalogues.
describe('message catalogues', () => {
  it('fr and en have identical key sets', () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(fr).sort());
  });

  it.each([
    ['fr', fr],
    ['en', en],
  ])('%s has only non-empty string values', (_locale, messages) => {
    for (const value of leafValues(messages)) {
      expect(typeof value).toBe('string');
      expect((value as string).trim()).not.toBe('');
    }
  });
});
