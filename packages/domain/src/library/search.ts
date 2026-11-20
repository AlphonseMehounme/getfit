// PRD §6.7: the exercise library's search and filters. A query matches the name or the alternative names in French
// and English, whatever the user's language, without regard to case or accents ("traction" and "pull-up" find the
// same exercise). Filters narrow the result; nothing here reads content or the network.
import type { EquipmentType } from '../workout/substitutes';

export interface LibraryNames {
  name: string;
  altNames: readonly string[];
}

export interface LibraryExercise {
  slug: string;
  category: string;
  difficulty: string;
  equipment: readonly EquipmentType[];
  muscleGroups: readonly string[];
  names: { fr: LibraryNames; en: LibraryNames };
}

export interface LibraryFilters {
  query?: string | undefined;
  category?: string | undefined;
  /** D42: "bodyweight" means the exercises that need nothing but the body. */
  equipment?: EquipmentType | undefined;
  muscle?: string | undefined;
  difficulty?: string | undefined;
}

/** Lower case, accents removed, spaces collapsed: "Fente  arrière" → "fente arriere". */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const usesEquipment = (exercise: LibraryExercise, item: EquipmentType) =>
  item === 'bodyweight'
    ? exercise.equipment.every((e) => e === 'bodyweight')
    : exercise.equipment.includes(item);

/** 0: a name matches, 1: only an alternative name matches, null: no match. */
function rank(exercise: LibraryExercise, query: string): 0 | 1 | null {
  const { fr, en } = exercise.names;
  if ([fr.name, en.name].some((n) => normalise(n).includes(query))) return 0;
  if ([...fr.altNames, ...en.altNames].some((n) => normalise(n).includes(query))) return 1;
  return null;
}

/** The exercises that pass every filter: name matches first, then alternative names, then alphabetical. */
export function searchExercises(
  exercises: readonly LibraryExercise[],
  filters: LibraryFilters,
  locale: 'fr' | 'en',
): LibraryExercise[] {
  const query = normalise(filters.query ?? '');
  const ranked: { exercise: LibraryExercise; rank: number }[] = [];
  for (const exercise of exercises) {
    if (filters.category && exercise.category !== filters.category) continue;
    if (filters.difficulty && exercise.difficulty !== filters.difficulty) continue;
    if (filters.muscle && !exercise.muscleGroups.includes(filters.muscle)) continue;
    if (filters.equipment && !usesEquipment(exercise, filters.equipment)) continue;
    const r = query ? rank(exercise, query) : 0;
    if (r !== null) ranked.push({ exercise, rank: r });
  }
  const collator = new Intl.Collator(locale);
  return ranked
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        collator.compare(a.exercise.names[locale].name, b.exercise.names[locale].name),
    )
    .map((r) => r.exercise);
}
