import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// AGENTS §9: no hardcoded colours in UI code; colours come from the design tokens in app/globals.css.
const HEX =
  '(^|[^0-9A-Za-z_&])#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})($|[^0-9A-Za-z_-])';
const COLOUR_FN = '(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(';
const colourMessage =
  'AGENTS §9: use a design token (app/globals.css) instead of a colour literal.';
const noColourLiterals = [HEX, COLOUR_FN].flatMap((pattern) => [
  { selector: `Literal[value=/${pattern}/]`, message: colourMessage },
  { selector: `TemplateElement[value.raw=/${pattern}/]`, message: colourMessage },
]);

const repositoriesImport = {
  group: ['@/server/repositories', '@/server/repositories/*', '**/server/repositories/**'],
  message: 'AGENTS §5.2: routes and components go through server/services, never repositories.',
};

export default defineConfig([
  globalIgnores([
    '**/.next/**',
    '**/node_modules/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    '**/next-env.d.ts',
  ]),
  ...nextVitals,
  ...nextTs,
  {
    // React is installed in apps/web only, so eslint-plugin-react can't detect it from the root.
    settings: { next: { rootDir: 'apps/web/' }, react: { version: '19.3' } },
  },
  {
    // AGENTS §2: no `any` in the domain package or the server layer.
    files: ['packages/domain/**/*.ts', 'apps/web/server/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    // AGENTS §5.1 and ADR 0002: the domain is pure and never reads the real clock.
    files: ['packages/domain/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'ADR 0002: pass `now` in; the domain never reads the real clock.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'ADR 0002: pass `now` in; the domain never reads the real clock.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['next', 'next/*', 'react', 'react-dom', '@supabase/*', 'dexie', 'node:*'],
              message:
                'AGENTS §5.1: packages/domain is pure, with no framework, database or I/O imports.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/app/**/*.{ts,tsx}', 'apps/web/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [repositoriesImport] }],
      'no-restricted-syntax': ['error', ...noColourLiterals],
    },
  },
]);
