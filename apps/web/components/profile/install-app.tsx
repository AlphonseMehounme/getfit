'use client';

import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useHydrated } from '@/lib/hooks/use-hydrated';

// D95 / PRD §12: "Install the app" in Profile. Shown only when the browser offers installation, or on iOS Safari (which
// has no prompt) as its "Add to Home Screen" steps; hidden once installed, so there's never a dead button (AGENTS §9).

/** Chromium's install event (not in the DOM types). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** What the browser has offered: nothing yet, its install prompt, or the app is now installed. */
type Offer =
  { kind: 'none' } | { kind: 'prompt'; event: BeforeInstallPromptEvent } | { kind: 'installed' };

const installed = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const iosSafari = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);

export function InstallApp() {
  const t = useTranslations('Profile.install');
  const hydrated = useHydrated();
  const [offer, setOffer] = useState<Offer>({ kind: 'none' });

  useEffect(() => {
    const prompt = (event: Event) => {
      event.preventDefault();
      setOffer({ kind: 'prompt', event: event as BeforeInstallPromptEvent });
    };
    const done = () => setOffer({ kind: 'installed' });
    window.addEventListener('beforeinstallprompt', prompt);
    window.addEventListener('appinstalled', done);
    return () => {
      window.removeEventListener('beforeinstallprompt', prompt);
      window.removeEventListener('appinstalled', done);
    };
  }, []);

  // Read in the browser only, after hydration: nothing is shown on the server.
  if (!hydrated || offer.kind === 'installed' || installed()) return null;
  if (offer.kind === 'none' && !iosSafari()) return null;
  const install = async (event: BeforeInstallPromptEvent) => {
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') setOffer({ kind: 'installed' });
  };

  return (
    <section
      aria-labelledby="install-app"
      className="rounded-card border-border flex flex-col gap-3 border p-4"
    >
      <h2 id="install-app" className="flex items-center gap-2 text-lg font-semibold">
        <Download aria-hidden="true" className="size-5" />
        {t('title')}
      </h2>
      <p className="text-muted">{t('body')}</p>
      {offer.kind === 'prompt' ? (
        <Button onClick={() => install(offer.event)} className="self-start">
          {t('action')}
        </Button>
      ) : (
        <p>{t('ios')}</p>
      )}
    </section>
  );
}
