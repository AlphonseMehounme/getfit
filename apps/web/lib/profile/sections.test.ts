import { describe, expect, it } from 'vitest';
import { editPath, isSettingsSection, savedSection, SETTINGS_SECTIONS } from './sections';

describe('Profile sections (D35)', () => {
  it('every onboarding step, then the preferences', () => {
    expect(SETTINGS_SECTIONS).toEqual([
      'profile',
      'goals',
      'experience',
      'equipment',
      'availability',
      'baselines',
      'preferences',
    ]);
    expect(editPath('goals')).toBe('/profile/edit/goals');
    expect(isSettingsSection('preferences')).toBe(true);
    expect(isSettingsSection('baselines')).toBe(true);
    expect(isSettingsSection('export')).toBe(false);
  });

  it('?saved= names a section, or nothing', () => {
    expect(savedSection('goals')).toBe('goals');
    expect(savedSection('nope')).toBeNull();
    expect(savedSection(['goals'])).toBeNull();
    expect(savedSection(undefined)).toBeNull();
  });
});
