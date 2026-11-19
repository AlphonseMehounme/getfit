/** An empty number field is null, not 0; React Hook Form also passes the default (null) of an untouched field. */
export const optionalNumber = {
  setValueAs: (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v)),
};

/** A number as an input's server-rendered value. */
export const shown = (value: number | null) => value ?? '';
