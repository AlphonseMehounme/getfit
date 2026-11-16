export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      exercise_relations: {
        Row: {
          exercise_id: string;
          kind: Database['public']['Enums']['exercise_relation_kind'];
          related_exercise_id: string;
        };
        ComputedFields: never;
        Insert: {
          exercise_id: string;
          kind: Database['public']['Enums']['exercise_relation_kind'];
          related_exercise_id: string;
        };
        Update: {
          exercise_id?: string;
          kind?: Database['public']['Enums']['exercise_relation_kind'];
          related_exercise_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_relations_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exercise_relations_related_exercise_id_fkey';
            columns: ['related_exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      exercise_translations: {
        Row: {
          alt_names: string[];
          common_mistakes: NonNullable<Json>;
          description: string;
          exercise_id: string;
          instructions: NonNullable<Json>;
          locale: Database['public']['Enums']['app_locale'];
          media_alt: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          alt_names?: string[];
          common_mistakes?: NonNullable<Json>;
          description: string;
          exercise_id: string;
          instructions?: NonNullable<Json>;
          locale: Database['public']['Enums']['app_locale'];
          media_alt: string;
          name: string;
        };
        Update: {
          alt_names?: string[];
          common_mistakes?: NonNullable<Json>;
          description?: string;
          exercise_id?: string;
          instructions?: NonNullable<Json>;
          locale?: Database['public']['Enums']['app_locale'];
          media_alt?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_translations_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      exercises: {
        Row: {
          category: Database['public']['Enums']['exercise_category'];
          created_at: string;
          difficulty: Database['public']['Enums']['difficulty_level'];
          equipment: Database['public']['Enums']['equipment_type'][];
          id: string;
          is_unilateral: boolean;
          media_key: string;
          muscle_groups: string[];
          pattern: Database['public']['Enums']['exercise_pattern'] | null;
          published: boolean;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          category: Database['public']['Enums']['exercise_category'];
          created_at?: string;
          difficulty: Database['public']['Enums']['difficulty_level'];
          equipment?: Database['public']['Enums']['equipment_type'][];
          id?: string;
          is_unilateral?: boolean;
          media_key: string;
          muscle_groups?: string[];
          pattern?: Database['public']['Enums']['exercise_pattern'] | null;
          published?: boolean;
          slug: string;
        };
        Update: {
          category?: Database['public']['Enums']['exercise_category'];
          created_at?: string;
          difficulty?: Database['public']['Enums']['difficulty_level'];
          equipment?: Database['public']['Enums']['equipment_type'][];
          id?: string;
          is_unilateral?: boolean;
          media_key?: string;
          muscle_groups?: string[];
          pattern?: Database['public']['Enums']['exercise_pattern'] | null;
          published?: boolean;
          slug?: string;
        };
        Relationships: [];
      };
      programme_days: {
        Row: {
          day_of_week: number;
          id: string;
          programme_week_id: string;
          session_template_id: string;
        };
        ComputedFields: never;
        Insert: {
          day_of_week: number;
          id?: string;
          programme_week_id: string;
          session_template_id: string;
        };
        Update: {
          day_of_week?: number;
          id?: string;
          programme_week_id?: string;
          session_template_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'programme_days_programme_week_id_fkey';
            columns: ['programme_week_id'];
            isOneToOne: false;
            referencedRelation: 'programme_weeks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'programme_days_session_template_id_fkey';
            columns: ['session_template_id'];
            isOneToOne: false;
            referencedRelation: 'session_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      programme_translations: {
        Row: {
          description: string;
          locale: Database['public']['Enums']['app_locale'];
          programme_id: string;
          safety_notes: NonNullable<Json>;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          description: string;
          locale: Database['public']['Enums']['app_locale'];
          programme_id: string;
          safety_notes?: NonNullable<Json>;
          title: string;
        };
        Update: {
          description?: string;
          locale?: Database['public']['Enums']['app_locale'];
          programme_id?: string;
          safety_notes?: NonNullable<Json>;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'programme_translations_programme_id_fkey';
            columns: ['programme_id'];
            isOneToOne: false;
            referencedRelation: 'programmes';
            referencedColumns: ['id'];
          },
        ];
      };
      programme_week_translations: {
        Row: {
          focus: string;
          label: string;
          locale: Database['public']['Enums']['app_locale'];
          programme_week_id: string;
        };
        ComputedFields: never;
        Insert: {
          focus: string;
          label: string;
          locale: Database['public']['Enums']['app_locale'];
          programme_week_id: string;
        };
        Update: {
          focus?: string;
          label?: string;
          locale?: Database['public']['Enums']['app_locale'];
          programme_week_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'programme_week_translations_programme_week_id_fkey';
            columns: ['programme_week_id'];
            isOneToOne: false;
            referencedRelation: 'programme_weeks';
            referencedColumns: ['id'];
          },
        ];
      };
      programme_weeks: {
        Row: {
          focus_key: string;
          id: string;
          long_run_ceiling_m: number | null;
          programme_id: string;
          volume_multiplier: number;
          week_number: number;
        };
        ComputedFields: never;
        Insert: {
          focus_key: string;
          id?: string;
          long_run_ceiling_m?: number | null;
          programme_id: string;
          volume_multiplier: number;
          week_number: number;
        };
        Update: {
          focus_key?: string;
          id?: string;
          long_run_ceiling_m?: number | null;
          programme_id?: string;
          volume_multiplier?: number;
          week_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'programme_weeks_programme_id_fkey';
            columns: ['programme_id'];
            isOneToOne: false;
            referencedRelation: 'programmes';
            referencedColumns: ['id'];
          },
        ];
      };
      programmes: {
        Row: {
          created_at: string;
          difficulty: Database['public']['Enums']['difficulty_level'];
          duration_weeks: number;
          id: string;
          objectives: string[];
          published: boolean;
          required_equipment: Database['public']['Enums']['equipment_type'][];
          slug: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          difficulty: Database['public']['Enums']['difficulty_level'];
          duration_weeks: number;
          id?: string;
          objectives?: string[];
          published?: boolean;
          required_equipment?: Database['public']['Enums']['equipment_type'][];
          slug: string;
          version: number;
        };
        Update: {
          created_at?: string;
          difficulty?: Database['public']['Enums']['difficulty_level'];
          duration_weeks?: number;
          id?: string;
          objectives?: string[];
          published?: boolean;
          required_equipment?: Database['public']['Enums']['equipment_type'][];
          slug?: string;
          version?: number;
        };
        Relationships: [];
      };
      session_template_translations: {
        Row: {
          guidance: NonNullable<Json>;
          locale: Database['public']['Enums']['app_locale'];
          purpose: string;
          session_template_id: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          guidance?: NonNullable<Json>;
          locale: Database['public']['Enums']['app_locale'];
          purpose: string;
          session_template_id: string;
          title: string;
        };
        Update: {
          guidance?: NonNullable<Json>;
          locale?: Database['public']['Enums']['app_locale'];
          purpose?: string;
          session_template_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_template_translations_session_template_id_fkey';
            columns: ['session_template_id'];
            isOneToOne: false;
            referencedRelation: 'session_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      session_templates: {
        Row: {
          body_focus: Database['public']['Enums']['body_focus'];
          counts_for_adherence: boolean;
          estimated_duration_min: number | null;
          id: string;
          programme_id: string;
          session_type: Database['public']['Enums']['session_type'];
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          body_focus: Database['public']['Enums']['body_focus'];
          counts_for_adherence: boolean;
          estimated_duration_min?: number | null;
          id?: string;
          programme_id: string;
          session_type: Database['public']['Enums']['session_type'];
          slug: string;
        };
        Update: {
          body_focus?: Database['public']['Enums']['body_focus'];
          counts_for_adherence?: boolean;
          estimated_duration_min?: number | null;
          id?: string;
          programme_id?: string;
          session_type?: Database['public']['Enums']['session_type'];
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_templates_programme_id_fkey';
            columns: ['programme_id'];
            isOneToOne: false;
            referencedRelation: 'programmes';
            referencedColumns: ['id'];
          },
        ];
      };
      template_exercises: {
        Row: {
          exercise_id: string;
          id: string;
          note_key: string | null;
          per_side: boolean;
          rest_s: number | null;
          sequence: number;
          session_template_id: string;
          target_distance_m: number | null;
          target_duration_s: number | null;
          target_reps: number | null;
          target_sets: number;
        };
        ComputedFields: never;
        Insert: {
          exercise_id: string;
          id?: string;
          note_key?: string | null;
          per_side?: boolean;
          rest_s?: number | null;
          sequence: number;
          session_template_id: string;
          target_distance_m?: number | null;
          target_duration_s?: number | null;
          target_reps?: number | null;
          target_sets: number;
        };
        Update: {
          exercise_id?: string;
          id?: string;
          note_key?: string | null;
          per_side?: boolean;
          rest_s?: number | null;
          sequence?: number;
          session_template_id?: string;
          target_distance_m?: number | null;
          target_duration_s?: number | null;
          target_reps?: number | null;
          target_sets?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'template_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'template_exercises_session_template_id_fkey';
            columns: ['session_template_id'];
            isOneToOne: false;
            referencedRelation: 'session_templates';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      app_locale: 'fr' | 'en';
      body_focus: 'upper' | 'lower' | 'full' | 'none';
      difficulty_level: 'beginner' | 'intermediate' | 'advanced';
      equipment_type:
        'bodyweight' | 'pull_up_bar' | 'dumbbells' | 'barbell' | 'bands' | 'gym' | 'other';
      exercise_category: 'upper' | 'lower' | 'core' | 'recovery' | 'mobility' | 'running';
      exercise_pattern: 'pull' | 'push';
      exercise_relation_kind: 'variation' | 'substitute';
      session_type: 'strength' | 'run' | 'recovery' | 'rest';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_locale: ['fr', 'en'],
      body_focus: ['upper', 'lower', 'full', 'none'],
      difficulty_level: ['beginner', 'intermediate', 'advanced'],
      equipment_type: [
        'bodyweight',
        'pull_up_bar',
        'dumbbells',
        'barbell',
        'bands',
        'gym',
        'other',
      ],
      exercise_category: ['upper', 'lower', 'core', 'recovery', 'mobility', 'running'],
      exercise_pattern: ['pull', 'push'],
      exercise_relation_kind: ['variation', 'substitute'],
      session_type: ['strength', 'run', 'recovery', 'rest'],
    },
  },
} as const;
