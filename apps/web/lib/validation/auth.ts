import { z } from 'zod';
import { locales } from '@/lib/i18n/config';

// Shared by the forms (React Hook Form) and the server (AGENTS §2). Messages are keys under `Auth.errors`.
export const PASSWORD_MIN_LENGTH = 8; // matches supabase/config.toml minimum_password_length
export const PASSWORD_MAX_LENGTH = 72; // Supabase Auth hashes passwords with bcrypt, which reads 72 bytes

export const VALIDATION_ERROR_KEYS = [
  'emailInvalid',
  'passwordRequired',
  'passwordTooShort',
  'passwordTooLong',
] as const;
export type ValidationErrorKey = (typeof VALIDATION_ERROR_KEYS)[number];

const email = z.string().trim().toLowerCase().pipe(z.email('emailInvalid'));

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, 'passwordTooShort')
  .max(PASSWORD_MAX_LENGTH, 'passwordTooLong');

export const signUpFormSchema = z.object({ email, password: newPassword });

// D29: the browser's language and time zone seed the profile; the database falls back to fr / UTC.
export const signUpSchema = signUpFormSchema.extend({
  locale: z.enum(locales).optional(),
  timezone: z.string().min(1).max(64).optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'passwordRequired').max(PASSWORD_MAX_LENGTH, 'passwordTooLong'),
});

export const resetPasswordSchema = z.object({ email });

export const updatePasswordSchema = z.object({ password: newPassword });

export type SignUpFormValues = z.input<typeof signUpFormSchema>;
export type SignUpInput = z.input<typeof signUpSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
export type UpdatePasswordInput = z.input<typeof updatePasswordSchema>;
