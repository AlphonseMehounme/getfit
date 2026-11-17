import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

// AGENTS §9: the ESLint guard that keeps colour literals out of UI code.
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function colourErrors(code: string, file = 'apps/web/components/ui/sample.tsx') {
  const [result] = await eslint.lintText(code, { filePath: `${root}${file}` });
  return (result?.messages ?? []).filter((m) => m.message.startsWith('AGENTS §9')).length;
}

describe('no hardcoded colours', () => {
  // Loading the ESLint config takes a few seconds on a busy machine; pay it once, outside the 5 s test limit.
  beforeAll(() => colourErrors(''), 30_000);

  it.each([
    ['export const a = <p className="bg-[#ffffff]" />;', 'an arbitrary hex class'],
    ["export const a = <p style={{ color: '#2F5BEA' }} />;", 'a hex style'],
    ["export const a = <p style={{ color: 'rgb(0, 0, 0)' }} />;", 'an rgb() colour'],
    ["export const a = <p style={{ color: 'oklch(0.6 0.2 260)' }} />;", 'an oklch() colour'],
    ['export const a = `text-[#fff]`;', 'a hex in a template literal'],
  ])('flags %s (%s)', async (code) => {
    expect(await colourErrors(code)).toBe(1);
  });

  it('allows token utilities and non-colour hashes', async () => {
    expect(
      await colourErrors(
        'export const a = <a href="#main" className="bg-accent text-accent-foreground border-control" />;',
      ),
    ).toBe(0);
  });

  it('applies to routes as well as components', async () => {
    expect(await colourErrors("export const a = '#000';", 'apps/web/app/sample/page.tsx')).toBe(1);
  });
});
