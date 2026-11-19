import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

// PRD §4 / §6.4: the programme's safety notes, from content (AGENTS §5.6). No diagnostic language (AGENTS §7).
export function SafetyNotes({ notes }: { notes: readonly string[] }) {
  const t = useTranslations('Programme');
  if (notes.length === 0) return null;
  return (
    <section aria-labelledby="safety-notes" className="flex flex-col gap-3">
      <h2 id="safety-notes" className="flex items-center gap-2 text-xl font-semibold">
        <ShieldCheck aria-hidden="true" className="text-muted size-5" />
        {t('safetyNotes')}
      </h2>
      <ul className="text-muted flex list-disc flex-col gap-1 pl-5">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
}
