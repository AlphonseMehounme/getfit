'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { requestPasswordResetAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { FormField } from '@/components/ui/form-field';
import { LOGIN_PATH } from '@/lib/auth/paths';
import {
  type ResetPasswordInput,
  resetPasswordSchema,
  type ValidationErrorKey,
} from '@/lib/validation/auth';
import type { AuthErrorKey } from '@/server/services/auth-errors';

export function ResetPasswordForm() {
  const t = useTranslations('Auth');
  const [serverError, setServerError] = useState<AuthErrorKey>();
  const [sentTo, setSentTo] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: '' },
  });

  const backToLogin = (
    <Link
      href={LOGIN_PATH}
      className="text-accent text-sm font-medium underline underline-offset-4"
    >
      {t('resetPassword.backToLogin')}
    </Link>
  );

  if (sentTo) {
    return (
      <section aria-live="polite" className="flex flex-col items-start gap-3">
        <h2 className="text-xl font-semibold">{t('resetPassword.sentTitle')}</h2>
        <p>{t('resetPassword.sentBody', { email: sentTo })}</p>
        {backToLogin}
      </section>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await requestPasswordResetAction(values);
    if (result.ok) setSentTo(values.email);
    else setServerError(result.error);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-muted">{t('resetPassword.intro')}</p>
      {serverError ? <FormAlert>{t(`errors.${serverError}`)}</FormAlert> : null}
      <FormField
        label={t('fields.email')}
        type="email"
        autoComplete="email"
        inputMode="email"
        error={
          errors.email?.message
            ? t(`errors.${errors.email.message as ValidationErrorKey}`)
            : undefined
        }
        {...register('email')}
      />
      <Button type="submit" width="full" disabled={isSubmitting}>
        {isSubmitting ? t('pending') : t('resetPassword.submit')}
      </Button>
      {backToLogin}
    </form>
  );
}
