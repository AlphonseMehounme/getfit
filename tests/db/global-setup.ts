import type { TestProject } from 'vitest/node';
import { type LocalSupabase, readLocalSupabase } from '../support/local-supabase';

declare module 'vitest' {
  export interface ProvidedContext {
    supabase: LocalSupabase;
  }
}

export default function setup(project: TestProject) {
  project.provide('supabase', readLocalSupabase());
}
