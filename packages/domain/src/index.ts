// @getfit/domain: every GetFit business rule lives here (AGENTS §5.1).
// Pure TypeScript: no I/O, no framework imports, and time is always passed in (ADR 0002).
// Each export is referenced by its BR/D number.

export * from './time/local-date';
export * from './time/clock';
export * from './time/zone';
export * from './schedule/week';
export * from './schedule/programme-start';
export * from './schedule/calendar';
