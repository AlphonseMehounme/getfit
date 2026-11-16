import { describe, expect, it } from 'vitest';
import * as sqlModule from './sql.ts';
import { array, bool, jsonb, literal, nullable } from './sql.ts';

describe('SQL literals', () => {
  it("escapes single quotes (French copy: l'épaule)", () => {
    expect(literal("l'épaule")).toBe("'l''épaule'");
    expect(literal('back\\slash')).toBe("'back\\slash'");
  });

  it('refuses a NUL character', () => {
    expect(() => literal('a\u0000b')).toThrow(RangeError);
  });

  it('writes nulls and booleans', () => {
    expect(nullable(null)).toBe('null');
    expect(nullable('pull')).toBe("'pull'");
    expect(bool(true)).toBe('true');
    expect(bool(false)).toBe('false');
  });

  it('types arrays, including empty ones', () => {
    expect(array(['lats', "it's"], 'text')).toBe("array['lats', 'it''s']::text[]");
    expect(array([], 'public.equipment_type')).toBe("'{}'::public.equipment_type[]");
  });

  it('writes jsonb with escaped quotes', () => {
    expect(jsonb(["Garde l'axe."])).toBe(`'["Garde l''axe."]'::jsonb`);
  });
});

describe('num', () => {
  it('types numbers and nulls', () => {
    const { num } = sqlModule;
    expect(num(0.65, 'numeric')).toBe('0.65::numeric');
    expect(num(null, 'integer')).toBe('null::integer');
    expect(() => num(Number.NaN, 'integer')).toThrow(RangeError);
  });
});
