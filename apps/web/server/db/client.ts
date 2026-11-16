import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

/** A Supabase client acting as one user (RLS applies). Services and repositories receive it. */
export type DbClient = SupabaseClient<Database>;
