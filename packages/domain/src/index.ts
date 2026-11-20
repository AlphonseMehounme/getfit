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
export * from './status/shows-plan';
export * from './metrics/adherence';
export * from './metrics/programme-progress';
export * from './metrics/running-distance';
export * from './recovery/rules';
export * from './recovery/evaluate-move';
export * from './recovery/candidates';
export * from './recovery/overrides';
export * from './recovery/attention';
export * from './prescription/types';
export * from './prescription/deload';
export * from './prescription/resolve';
export * from './prescription/volume';
export * from './prescription/snapshot';
export * from './workout/progress';
export * from './workout/summary';
export * from './workout/timer';
export * from './workout/substitutes';
export * from './workout/best-set';
export { roundTo, type UnitSystem } from './units/system';
export * from './units/distance';
export * from './units/mass';
export * from './units/length';
export * from './units/format';
export * from './running/pace';
export * from './running/validate';
export * from './running/link';
export * from './onboarding/equipment-check';
export * from './onboarding/availability';
export * from './onboarding/steps';
export * from './onboarding/measurements';
export * from './library/search';
