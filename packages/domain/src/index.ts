// @getfit/domain: every GetFit business rule lives here (AGENTS §5.1).
// Pure TypeScript: no I/O, no framework imports, and time is always passed in (ADR 0002).
// Each export is referenced by its BR/D number.

export * from './time/local-date';
export * from './time/clock';
export * from './time/zone';
export * from './schedule/week';
export * from './schedule/programme-start';
export * from './schedule/calendar';
export * from './schedule/types';
export * from './schedule/engine';
export * from './status/missed';
export * from './status/late-logging';
export * from './status/session-status';
export * from './metrics/adherence';
export * from './recovery/rules';
export * from './recovery/evaluate-move';
export * from './recovery/candidates';
export * from './prescription/types';
export * from './prescription/deload';
export * from './prescription/resolve';
export * from './prescription/volume';
export * from './prescription/snapshot';
