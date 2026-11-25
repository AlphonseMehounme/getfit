export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      body_measurements: {
        Row: {
          body_fat_pct: number | null;
          client_updated_at: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_baseline: boolean;
          measured_at: string;
          notes: string | null;
          user_id: string;
          weight_kg: number | null;
        };
        ComputedFields: never;
        Insert: {
          body_fat_pct?: number | null;
          client_updated_at: string;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          is_baseline?: boolean;
          measured_at: string;
          notes?: string | null;
          user_id: string;
          weight_kg?: number | null;
        };
        Update: {
          body_fat_pct?: number | null;
          client_updated_at?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_baseline?: boolean;
          measured_at?: string;
          notes?: string | null;
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'body_measurements_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
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
      fitness_tests: {
        Row: {
          client_updated_at: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_baseline: boolean;
          test_type: Database['public']['Enums']['fitness_test_type'];
          tested_at: string;
          user_id: string;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          client_updated_at: string;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          is_baseline?: boolean;
          test_type: Database['public']['Enums']['fitness_test_type'];
          tested_at: string;
          user_id: string;
          value: number;
        };
        Update: {
          client_updated_at?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_baseline?: boolean;
          test_type?: Database['public']['Enums']['fitness_test_type'];
          tested_at?: string;
          user_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'fitness_tests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      prescription_overrides: {
        Row: {
          accepted_at: string;
          created_at: string;
          from_week: number;
          id: string;
          target_distance_m: number | null;
          target_duration_s: number | null;
          target_reps: number | null;
          template_exercise_id: string;
          user_programme_id: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string;
          created_at?: string;
          from_week: number;
          id?: string;
          target_distance_m?: number | null;
          target_duration_s?: number | null;
          target_reps?: number | null;
          template_exercise_id: string;
          user_programme_id: string;
        };
        Update: {
          accepted_at?: string;
          created_at?: string;
          from_week?: number;
          id?: string;
          target_distance_m?: number | null;
          target_duration_s?: number | null;
          target_reps?: number | null;
          template_exercise_id?: string;
          user_programme_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'prescription_overrides_template_exercise_id_fkey';
            columns: ['template_exercise_id'];
            isOneToOne: false;
            referencedRelation: 'template_exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prescription_overrides_user_programme_id_fkey';
            columns: ['user_programme_id'];
            isOneToOne: false;
            referencedRelation: 'user_programmes';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          birth_year: number | null;
          created_at: string;
          experience_level: Database['public']['Enums']['experience_level'] | null;
          first_name: string | null;
          height_cm: number | null;
          id: string;
          locale: Database['public']['Enums']['app_locale'];
          onboarding_completed_at: string | null;
          preferred_duration_min: number | null;
          preferred_units: Database['public']['Enums']['unit_system'];
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          birth_year?: number | null;
          created_at?: string;
          experience_level?: Database['public']['Enums']['experience_level'] | null;
          first_name?: string | null;
          height_cm?: number | null;
          id: string;
          locale?: Database['public']['Enums']['app_locale'];
          onboarding_completed_at?: string | null;
          preferred_duration_min?: number | null;
          preferred_units?: Database['public']['Enums']['unit_system'];
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          birth_year?: number | null;
          created_at?: string;
          experience_level?: Database['public']['Enums']['experience_level'] | null;
          first_name?: string | null;
          height_cm?: number | null;
          id?: string;
          locale?: Database['public']['Enums']['app_locale'];
          onboarding_completed_at?: string | null;
          preferred_duration_min?: number | null;
          preferred_units?: Database['public']['Enums']['unit_system'];
          timezone?: string;
          updated_at?: string;
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
      rate_limits: {
        Row: {
          hits: number;
          key: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          hits: number;
          key: string;
          window_start: string;
        };
        Update: {
          hits?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      running_sessions: {
        Row: {
          client_updated_at: string;
          created_at: string;
          deleted_at: string | null;
          distance_m: number;
          duration_s: number;
          id: string;
          is_baseline: boolean;
          local_date: string;
          notes: string | null;
          programme_day_id: string | null;
          route_name: string | null;
          rpe: number | null;
          scheduled_date: string | null;
          source: Database['public']['Enums']['run_source'];
          started_at: string;
          updated_at: string;
          user_id: string;
          user_programme_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          client_updated_at: string;
          created_at?: string;
          deleted_at?: string | null;
          distance_m: number;
          duration_s: number;
          id: string;
          is_baseline?: boolean;
          local_date: string;
          notes?: string | null;
          programme_day_id?: string | null;
          route_name?: string | null;
          rpe?: number | null;
          scheduled_date?: string | null;
          source?: Database['public']['Enums']['run_source'];
          started_at: string;
          updated_at?: string;
          user_id: string;
          user_programme_id?: string | null;
        };
        Update: {
          client_updated_at?: string;
          created_at?: string;
          deleted_at?: string | null;
          distance_m?: number;
          duration_s?: number;
          id?: string;
          is_baseline?: boolean;
          local_date?: string;
          notes?: string | null;
          programme_day_id?: string | null;
          route_name?: string | null;
          rpe?: number | null;
          scheduled_date?: string | null;
          source?: Database['public']['Enums']['run_source'];
          started_at?: string;
          updated_at?: string;
          user_id?: string;
          user_programme_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'running_sessions_programme_day_id_fkey';
            columns: ['programme_day_id'];
            isOneToOne: false;
            referencedRelation: 'programme_days';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'running_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'running_sessions_user_programme_id_user_id_fkey';
            columns: ['user_programme_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'user_programmes';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      schedule_overrides: {
        Row: {
          action: Database['public']['Enums']['override_action'];
          created_at: string;
          id: string;
          new_date: string | null;
          original_date: string;
          programme_day_id: string;
          reason: string | null;
          user_programme_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: Database['public']['Enums']['override_action'];
          created_at?: string;
          id?: string;
          new_date?: string | null;
          original_date: string;
          programme_day_id: string;
          reason?: string | null;
          user_programme_id: string;
        };
        Update: {
          action?: Database['public']['Enums']['override_action'];
          created_at?: string;
          id?: string;
          new_date?: string | null;
          original_date?: string;
          programme_day_id?: string;
          reason?: string | null;
          user_programme_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'schedule_overrides_programme_day_id_fkey';
            columns: ['programme_day_id'];
            isOneToOne: false;
            referencedRelation: 'programme_days';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'schedule_overrides_user_programme_id_fkey';
            columns: ['user_programme_id'];
            isOneToOne: false;
            referencedRelation: 'user_programmes';
            referencedColumns: ['id'];
          },
        ];
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
      user_availability: {
        Row: {
          day_of_week: number;
          kind: Database['public']['Enums']['availability_kind'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          day_of_week: number;
          kind: Database['public']['Enums']['availability_kind'];
          user_id: string;
        };
        Update: {
          day_of_week?: number;
          kind?: Database['public']['Enums']['availability_kind'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_availability_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_equipment: {
        Row: {
          equipment: Database['public']['Enums']['equipment_type'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          equipment: Database['public']['Enums']['equipment_type'];
          user_id: string;
        };
        Update: {
          equipment?: Database['public']['Enums']['equipment_type'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_equipment_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_goals: {
        Row: {
          created_at: string;
          goal_type: Database['public']['Enums']['goal_type'];
          id: string;
          status: Database['public']['Enums']['goal_status'];
          target_date: string | null;
          target_unit: string | null;
          target_value: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          goal_type: Database['public']['Enums']['goal_type'];
          id?: string;
          status?: Database['public']['Enums']['goal_status'];
          target_date?: string | null;
          target_unit?: string | null;
          target_value?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          goal_type?: Database['public']['Enums']['goal_type'];
          id?: string;
          status?: Database['public']['Enums']['goal_status'];
          target_date?: string | null;
          target_unit?: string | null;
          target_value?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_goals_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_programmes: {
        Row: {
          created_at: string;
          ended_at: string | null;
          id: string;
          programme_id: string;
          programme_version: number;
          start_date: string;
          start_mode: Database['public']['Enums']['start_mode'];
          status: Database['public']['Enums']['enrolment_status'];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          programme_id: string;
          programme_version: number;
          start_date: string;
          start_mode: Database['public']['Enums']['start_mode'];
          status?: Database['public']['Enums']['enrolment_status'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          programme_id?: string;
          programme_version?: number;
          start_date?: string;
          start_mode?: Database['public']['Enums']['start_mode'];
          status?: Database['public']['Enums']['enrolment_status'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_programmes_programme_id_programme_version_fkey';
            columns: ['programme_id', 'programme_version'];
            isOneToOne: false;
            referencedRelation: 'programmes';
            referencedColumns: ['id', 'version'];
          },
          {
            foreignKeyName: 'user_programmes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      weekly_reviews: {
        Row: {
          body_measurement_id: string | null;
          client_updated_at: string;
          created_at: string;
          fatigue: number | null;
          id: string;
          motivation: number | null;
          notes: string | null;
          pain: boolean;
          pain_location: string | null;
          pain_notes: string | null;
          recommendation_key: string | null;
          sleep_quality: number | null;
          soreness: number | null;
          suggestion: Json | null;
          suggestion_decision: string | null;
          updated_at: string;
          user_id: string;
          user_programme_id: string | null;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          body_measurement_id?: string | null;
          client_updated_at: string;
          created_at?: string;
          fatigue?: number | null;
          id: string;
          motivation?: number | null;
          notes?: string | null;
          pain?: boolean;
          pain_location?: string | null;
          pain_notes?: string | null;
          recommendation_key?: string | null;
          sleep_quality?: number | null;
          soreness?: number | null;
          suggestion?: Json | null;
          suggestion_decision?: string | null;
          updated_at?: string;
          user_id: string;
          user_programme_id?: string | null;
          week_start: string;
        };
        Update: {
          body_measurement_id?: string | null;
          client_updated_at?: string;
          created_at?: string;
          fatigue?: number | null;
          id?: string;
          motivation?: number | null;
          notes?: string | null;
          pain?: boolean;
          pain_location?: string | null;
          pain_notes?: string | null;
          recommendation_key?: string | null;
          sleep_quality?: number | null;
          soreness?: number | null;
          suggestion?: Json | null;
          suggestion_decision?: string | null;
          updated_at?: string;
          user_id?: string;
          user_programme_id?: string | null;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'weekly_reviews_body_measurement_fkey';
            columns: ['body_measurement_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'body_measurements';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'weekly_reviews_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'weekly_reviews_user_programme_id_user_id_fkey';
            columns: ['user_programme_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'user_programmes';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      workout_sessions: {
        Row: {
          client_updated_at: string;
          completed_at: string | null;
          created_at: string;
          deleted_at: string | null;
          duration_s: number | null;
          id: string;
          notes: string | null;
          paused_at: string | null;
          paused_s: number;
          prescription_snapshot: Json | null;
          programme_day_id: string | null;
          rpe: number | null;
          scheduled_date: string | null;
          session_template_id: string | null;
          started_at: string;
          status: Database['public']['Enums']['workout_status'];
          updated_at: string;
          user_id: string;
          user_programme_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          client_updated_at: string;
          completed_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          duration_s?: number | null;
          id: string;
          notes?: string | null;
          paused_at?: string | null;
          paused_s?: number;
          prescription_snapshot?: Json | null;
          programme_day_id?: string | null;
          rpe?: number | null;
          scheduled_date?: string | null;
          session_template_id?: string | null;
          started_at: string;
          status?: Database['public']['Enums']['workout_status'];
          updated_at?: string;
          user_id: string;
          user_programme_id?: string | null;
        };
        Update: {
          client_updated_at?: string;
          completed_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          duration_s?: number | null;
          id?: string;
          notes?: string | null;
          paused_at?: string | null;
          paused_s?: number;
          prescription_snapshot?: Json | null;
          programme_day_id?: string | null;
          rpe?: number | null;
          scheduled_date?: string | null;
          session_template_id?: string | null;
          started_at?: string;
          status?: Database['public']['Enums']['workout_status'];
          updated_at?: string;
          user_id?: string;
          user_programme_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_sessions_programme_day_id_fkey';
            columns: ['programme_day_id'];
            isOneToOne: false;
            referencedRelation: 'programme_days';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_sessions_session_template_id_fkey';
            columns: ['session_template_id'];
            isOneToOne: false;
            referencedRelation: 'session_templates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_sessions_user_programme_id_user_id_fkey';
            columns: ['user_programme_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'user_programmes';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      workout_sets: {
        Row: {
          actual_duration_s: number | null;
          actual_reps: number | null;
          client_updated_at: string;
          completed: boolean;
          created_at: string;
          exercise_id: string;
          id: string;
          load_kg: number | null;
          logged_at: string;
          rir: number | null;
          set_number: number;
          side: Database['public']['Enums']['set_side'];
          substituted_for_exercise_id: string | null;
          updated_at: string;
          workout_session_id: string;
        };
        ComputedFields: never;
        Insert: {
          actual_duration_s?: number | null;
          actual_reps?: number | null;
          client_updated_at: string;
          completed?: boolean;
          created_at?: string;
          exercise_id: string;
          id: string;
          load_kg?: number | null;
          logged_at: string;
          rir?: number | null;
          set_number: number;
          side?: Database['public']['Enums']['set_side'];
          substituted_for_exercise_id?: string | null;
          updated_at?: string;
          workout_session_id: string;
        };
        Update: {
          actual_duration_s?: number | null;
          actual_reps?: number | null;
          client_updated_at?: string;
          completed?: boolean;
          created_at?: string;
          exercise_id?: string;
          id?: string;
          load_kg?: number | null;
          logged_at?: string;
          rir?: number | null;
          set_number?: number;
          side?: Database['public']['Enums']['set_side'];
          substituted_for_exercise_id?: string | null;
          updated_at?: string;
          workout_session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_sets_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_sets_substituted_for_exercise_id_fkey';
            columns: ['substituted_for_exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_sets_workout_session_id_fkey';
            columns: ['workout_session_id'];
            isOneToOne: false;
            referencedRelation: 'workout_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      hit_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_s: number };
        Returns: boolean;
      };
      is_known_time_zone: { Args: { tz: string }; Returns: boolean };
      owns_user_programme: { Args: { target: string }; Returns: boolean };
      owns_workout_session: { Args: { target: string }; Returns: boolean };
    };
    Enums: {
      app_locale: 'fr' | 'en';
      availability_kind: 'training' | 'running' | 'rest';
      body_focus: 'upper' | 'lower' | 'full' | 'none';
      difficulty_level: 'beginner' | 'intermediate' | 'advanced';
      enrolment_status: 'active' | 'completed' | 'abandoned';
      equipment_type:
        'bodyweight' | 'pull_up_bar' | 'dumbbells' | 'barbell' | 'bands' | 'gym' | 'other';
      exercise_category: 'upper' | 'lower' | 'core' | 'recovery' | 'mobility' | 'running';
      exercise_pattern: 'pull' | 'push';
      exercise_relation_kind: 'variation' | 'substitute';
      experience_level: 'beginner' | 'intermediate' | 'advanced';
      fitness_test_type: 'max_pull_ups' | 'max_push_ups' | 'max_squats';
      goal_status: 'active' | 'achieved' | 'abandoned';
      goal_type:
        | 'build_muscle'
        | 'increase_strength'
        | 'improve_endurance'
        | 'improve_running'
        | 'general_fitness'
        | 'maintain';
      override_action: 'moved' | 'skipped';
      run_source: 'manual' | 'gps' | 'import';
      session_type: 'strength' | 'run' | 'recovery' | 'rest';
      set_side: 'left' | 'right' | 'both';
      start_mode: 'next_monday' | 'this_week';
      unit_system: 'metric' | 'imperial';
      workout_status: 'in_progress' | 'partial' | 'completed' | 'abandoned';
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
      availability_kind: ['training', 'running', 'rest'],
      body_focus: ['upper', 'lower', 'full', 'none'],
      difficulty_level: ['beginner', 'intermediate', 'advanced'],
      enrolment_status: ['active', 'completed', 'abandoned'],
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
      experience_level: ['beginner', 'intermediate', 'advanced'],
      fitness_test_type: ['max_pull_ups', 'max_push_ups', 'max_squats'],
      goal_status: ['active', 'achieved', 'abandoned'],
      goal_type: [
        'build_muscle',
        'increase_strength',
        'improve_endurance',
        'improve_running',
        'general_fitness',
        'maintain',
      ],
      override_action: ['moved', 'skipped'],
      run_source: ['manual', 'gps', 'import'],
      session_type: ['strength', 'run', 'recovery', 'rest'],
      set_side: ['left', 'right', 'both'],
      start_mode: ['next_monday', 'this_week'],
      unit_system: ['metric', 'imperial'],
      workout_status: ['in_progress', 'partial', 'completed', 'abandoned'],
    },
  },
} as const;
