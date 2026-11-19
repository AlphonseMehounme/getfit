import { compareLocalDates, type LocalDate } from '../time/local-date';
import type { SessionStatus } from './session-status';

/**
 * D58: whether a session's targets are listed. A day before today shows only its status (PRD §6.4: past weeks show
 * logged data, never prescriptions as results), and a session already saved shows its log instead.
 */
export function showsPlan(session: { date: LocalDate; status: SessionStatus }, today: LocalDate) {
  if (compareLocalDates(session.date, today) < 0) return false;
  return session.status !== 'partial' && session.status !== 'completed';
}
