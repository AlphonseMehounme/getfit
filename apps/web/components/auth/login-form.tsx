'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { signInAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { FormField } from '@/components/ui/form-field';
import { RESET_PASSWORD_PATH, SIGN_UP_PATH } from '@/lib/auth/paths';
import { type LoginInput, loginSchema, type ValidationErrorKey } from '@/lib/validation/auth';
import type { AuthErrorKey } from '@/server/services/auth-errors';

interface LoginFormProps {
  next?: string | undefined;
  /** Set when the user arrives from an expired or invalid email link. */
  initialError?: AuthErrorKey | undefined;
}

export function LoginForm({ next, initialError }: LoginFormProps) {
  const t = useTranslations('Auth');
  const [serverError, setServerError] = useState<AuthErrorKey | undefined>(initialError);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const fieldError = (message: string | undefined) =>
    message ? t(`errors.${message as ValidationErrorKey}`) : undefined;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await signInAction(values, next);
    if (result && !result.ok) setServerError(result.error);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {serverError ? <FormAlert>{t(`errors.${serverError}`)}</FormAlert> : null}
      <FormField
        label={t('fields.email')}
        type="email"
        autoComplete="email"
        inputMode="email"
        error={fieldError(errors.email?.message)}
        {...register('email')}
      />
      <FormField
        label={t('fields.password')}
        type="password"
        autoComplete="current-password"
        error={fieldError(errors.password?.message)}
        {...register('password')}
      />
      <Link
        href={RESET_PASSWORD_PATH}
        className="text-accent -my-2 self-start py-2 text-sm font-medium underline underline-offset-4"
      >
        {t('login.forgotPassword')}
      </Link>
      <Button type="submit" width="full" disabled={isSubmitting}>
        {isSubmitting ? t('pending') : t('login.submit')}
      </Button>
      <p className="text-muted text-sm">
        {t('login.noAccount')}{' '}
        <Link href={SIGN_UP_PATH} className="text-accent font-medium underline underline-offset-4">
          {t('login.signUpLink')}
        </Link>
      </p>
    </form>
  );
}
