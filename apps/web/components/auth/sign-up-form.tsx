'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { signUpAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { FormField } from '@/components/ui/form-field';
import { LOGIN_PATH } from '@/lib/auth/paths';
import {
  PASSWORD_MIN_LENGTH,
  type SignUpFormValues,
  signUpFormSchema,
  type ValidationErrorKey,
} from '@/lib/validation/auth';
import type { AuthErrorKey } from '@/server/services/auth-errors';
import { CheckInbox } from './check-inbox';

export function SignUpForm() {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const [serverError, setServerError] = useState<AuthErrorKey>();
  const [sentTo, setSentTo] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: { email: '', password: '' },
  });

  if (sentTo) return <CheckInbox email={sentTo} />;

  const fieldError = (message: string | undefined) =>
    message ? t(`errors.${message as ValidationErrorKey}`) : undefined;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    // D29: the profile starts with the browser's language and time zone.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const result = await signUpAction({ ...values, locale, timezone });
    if (result.ok) setSentTo(values.email);
    else setServerError(result.error);
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
        autoComplete="new-password"
        hint={t('signUp.passwordHint', { min: PASSWORD_MIN_LENGTH })}
        error={fieldError(errors.password?.message)}
        {...register('password')}
      />
      <Button type="submit" width="full" disabled={isSubmitting}>
        {isSubmitting ? t('pending') : t('signUp.submit')}
      </Button>
      <p className="text-muted text-sm">
        {t('signUp.haveAccount')}{' '}
        <Link href={LOGIN_PATH} className="text-accent font-medium underline underline-offset-4">
          {t('signUp.loginLink')}
        </Link>
      </p>
    </form>
  );
}
