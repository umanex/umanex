'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { AppCard } from '@/components/AppCard';
import { RepoBar } from '@/components/RepoBar';
import { APPS } from '@/lib/appsConfig';
import type { AppStatus, StatusPayload } from '@/lib/types';

const POLL_MS = 2000;

type Melding = { ok: boolean; tekst: string };

/** De skelet-kaartlijst vóór de eerste poll: labels staan al vast, de status niet. */
const SKELET: AppStatus[] = APPS.map((a) => ({
  id: a.id,
  label: a.label,
  mode: a.mode,
  port: a.port,
  localUrl: a.localUrl,
  links: a.links,
  state: 'laden',
  owner: null,
  ownerLabel: null,
  pid: null,
  scripts: [],
  startGeblokkeerd: null,
  git: { gewijzigd: 0 },
  laatsteExit: null,
  logPad: null,
}));

export const DashboardGrid = () => {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState<string | null>(null);
  const [meldingen, setMeldingen] = useState<Record<string, Melding>>({});
  // useRef, niet state: het poll-interval mag niet herstarten omdat er een melding bijkomt.
  const gemonteerd = useRef(true);

  const haalStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as StatusPayload;
      if (gemonteerd.current) {
        setData(json);
        setFout(null);
      }
    } catch (e) {
      if (gemonteerd.current) setFout(e instanceof Error ? e.message : 'onbekende fout');
    }
  }, []);

  useEffect(() => {
    gemonteerd.current = true;
    void haalStatus();
    const id = setInterval(() => void haalStatus(), POLL_MS);
    return () => {
      gemonteerd.current = false;
      clearInterval(id);
    };
  }, [haalStatus]);

  const doe = useCallback(
    async (pad: string, body: Record<string, string>, sleutel: string) => {
      setBezig(sleutel);
      try {
        const res = await fetch(pad, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { ok: boolean; bericht: string };
        setMeldingen((m) => ({ ...m, [sleutel]: { ok: json.ok, tekst: json.bericht } }));
      } catch (e) {
        setMeldingen((m) => ({
          ...m,
          [sleutel]: { ok: false, tekst: e instanceof Error ? e.message : 'aanvraag mislukt' },
        }));
      } finally {
        setBezig(null);
        void haalStatus();
      }
    },
    [haalStatus]
  );

  const apps = data?.apps ?? SKELET;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <RepoBar repo={data?.repo ?? null} gemetenOp={data?.gemetenOp ?? null} />

      {fout ? (
        <p
          role="alert"
          className="mb-6 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <span>
            De statusmeting faalt ({fout}). De kaarten hieronder tonen de laatste geslaagde meting —
            niet de huidige stand.
          </span>
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            bezig={bezig === app.id}
            melding={meldingen[app.id] ?? null}
            onStart={() => void doe('/api/start', { app: app.id }, app.id)}
            onStop={() => void doe('/api/stop', { app: app.id }, app.id)}
            onScript={(naam) => void doe('/api/script', { app: app.id, script: naam }, app.id)}
          />
        ))}
      </div>
    </main>
  );
};
