'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { updatePasswordAction } from '@/app/(app)/update-password/actions';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { FormField } from '@/components/ui/form-field';
import { HOME_PATH } from '@/lib/auth/paths';
import {
  PASSWORD_MIN_LENGTH,
  type UpdatePasswordInput,
  updatePasswordSchema,
  type ValidationErrorKey,
} from '@/lib/validation/auth';
import type { AuthErrorKey } from '@/server/services/auth-errors';

export function UpdatePasswordForm() {
  const t = useTranslations('Auth');
  const [serverError, setServerError] = useState<AuthErrorKey>();
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: '' },
  });

  if (done) {
    return (
      <section aria-live="polite" className="flex flex-col items-start gap-3">
        <h2 className="text-xl font-semibold">{t('updatePassword.doneTitle')}</h2>
        <p>{t('updatePassword.doneBody')}</p>
        <Link href={HOME_PATH} className="text-accent font-medium underline underline-offset-4">
          {t('updatePassword.continue')}
        </Link>
      </section>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await updatePasswordAction(values);
    if (result.ok) setDone(true);
    else setServerError(result.error);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {serverError ? <FormAlert>{t(`errors.${serverError}`)}</FormAlert> : null}
      <FormField
        label={t('fields.newPassword')}
        type="password"
        autoComplete="new-password"
        hint={t('signUp.passwordHint', { min: PASSWORD_MIN_LENGTH })}
        error={
          errors.password?.message
            ? t(`errors.${errors.password.message as ValidationErrorKey}`)
            : undefined
        }
        {...register('password')}
      />
      <Button type="submit" width="full" disabled={isSubmitting}>
        {isSubmitting ? t('pending') : t('updatePassword.submit')}
      </Button>
    </form>
  );
}
