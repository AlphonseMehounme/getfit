'use client';

import type { EquipmentType, IsoWeekday } from '@getfit/domain';
import { useFormatter, useTranslations } from 'next-intl';
import { Notice } from '@/components/ui/notice';
import { weekdayDate } from '@/lib/onboarding/weekday';

// PRD §6.2: the programme recommendation warns when the programme needs equipment the user said they lack (AC), and
// D36 says that the programme keeps its own days when the availability answers differ. Neither blocks the start.

export function StartNotices({
  missingEquipment,
  availabilityMismatches,
}: {
  missingEquipment: readonly EquipmentType[];
  availabilityMismatches: readonly IsoWeekday[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  if (missingEquipment.length === 0 && availabilityMismatches.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {missingEquipment.length > 0 ? (
        <Notice tone="warning" title={t('Start.equipmentWarning.title')}>
          {t('Start.equipmentWarning.body', {
            items: format.list(
              missingEquipment.map((item) => t(`Onboarding.equipment.options.${item}`)),
            ),
          })}
        </Notice>
      ) : null}
      {availabilityMismatches.length > 0 ? (
        <Notice tone="info" title={t('Start.availabilityNote.title')}>
          {t('Start.availabilityNote.body', {
            days: format.list(
              availabilityMismatches.map((day) =>
                format.dateTime(weekdayDate(day), { weekday: 'long', timeZone: 'UTC' }),
              ),
            ),
          })}
        </Notice>
      ) : null}
    </div>
  );
}
