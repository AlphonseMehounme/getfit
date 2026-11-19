import type { FieldError, FieldErrors, FieldValues, Resolver } from 'react-hook-form';

// AGENTS §2: an onboarding form is checked with the server's own step schema. The form's values are mapped to the
// schema's input first (e.g. feet and inches to inches), and each issue is reported on the field that shows it: by
// its full path ("run.distance") when mapped, else by its first segment.

interface StepSchema {
  safeParse(input: unknown):
    | { success: true }
    | {
        success: false;
        error: { issues: { path: PropertyKey[]; code: string; message: string }[] };
      };
}

export function schemaResolver<V extends FieldValues>(
  schema: StepSchema,
  toInput: (values: V) => unknown = (values) => values,
  fieldOf: Partial<Record<string, keyof V & string>> = {},
): Resolver<V> {
  return (values) => {
    const result = schema.safeParse(toInput(values));
    if (result.success) return { values, errors: {} };
    const errors: Record<string, FieldError> = {};
    for (const issue of result.error.issues) {
      const path = String(issue.path[0]);
      const field = fieldOf[issue.path.map(String).join('.')] ?? fieldOf[path] ?? path;
      errors[field] ??= { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<V> };
  };
}
