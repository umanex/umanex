'use client';

import { ExternalLink, Play, Square, Terminal } from 'lucide-react';
import { Badge } from '@umanex/ui/components/ui/badge';
import { Button } from '@umanex/ui/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@umanex/ui/components/ui/card';
import { ScriptMenu } from '@/components/ScriptMenu';
import { StatusBadge } from '@/components/StatusBadge';
import type { AppStatus } from '@/lib/types';

type Props = {
  app: AppStatus;
  bezig: boolean;
  melding: { ok: boolean; tekst: string } | null;
  onStart: () => void;
  onStop: () => void;
  onScript: (naam: string) => void;
};

export const AppCard = ({ app, bezig, melding, onStart, onStop, onScript }: Props) => {
  // Stoppen mag alleen wat dit dashboard zelf startte. PM2 en een extern gestarte
  // dev-server horen hier geen knop te krijgen — die bezitten hun eigen proces.
  const magStoppen = app.owner === 'dashboard' && (app.state === 'draait' || app.state === 'startend');
  const magStarten = app.state === 'gestopt' || app.state === 'mislukt';
  const toontLokaleUrl = app.state !== 'gestopt' && app.localUrl !== null;
  const heeftLinks = toontLokaleUrl || app.links.length > 0;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">{app.label}</CardTitle>
          <p className="mt-1 font-mono text-xs text-muted-foreground">apps/{app.id}</p>
        </div>
        <StatusBadge state={app.state} owner={app.owner} ownerLabel={app.ownerLabel} port={app.port} />
      </CardHeader>

      <CardContent className="flex-1 space-y-3 text-sm">
        {/* Niet renderen als er niets in staat: een lege flex-rij neemt anders de
            space-y-3 mee en laat een gat achter op kaarten zonder badge of link. */}
        {app.mode === 'terminal' || app.git.gewijzigd > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {app.mode === 'terminal' ? (
            <Badge variant="secondary" className="gap-1 font-normal">
              <Terminal className="h-3 w-3" aria-hidden="true" />
              Terminal-tab
            </Badge>
          ) : null}
          {app.git.gewijzigd > 0 ? (
            <Badge variant="secondary" className="font-normal">
              {app.git.gewijzigd} gewijzigd
            </Badge>
          ) : null}
        </div>
        ) : null}

        {heeftLinks ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {toontLokaleUrl && app.localUrl ? (
            <a
              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href={app.localUrl}
              target="_blank"
              rel="noreferrer"
            >
              {app.localUrl.replace('http://', '')}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : null}
          {app.links.map((l) => (
            <a
              key={l.href}
              className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href={l.href}
              target="_blank"
              rel="noreferrer"
            >
              {l.label}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ))}
        </div>
        ) : null}

        {app.startGeblokkeerd ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
            {app.startGeblokkeerd}
          </p>
        ) : null}

        {app.state === 'mislukt' ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-foreground">
            Laatste start eindigde met exit {app.laatsteExit}.
            {app.logPad ? <> Output staat in <span className="font-mono">{app.logPad}</span>.</> : null}
          </p>
        ) : null}

        {melding ? (
          <p
            role="status"
            className={`text-xs ${melding.ok ? 'text-muted-foreground' : 'text-destructive'}`}
          >
            {melding.tekst}
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="gap-2">
        {magStoppen ? (
          <Button size="sm" variant="secondary" onClick={onStop} disabled={bezig}>
            <Square className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onStart}
            disabled={bezig || !magStarten || app.startGeblokkeerd !== null}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Start
          </Button>
        )}
        <div className="ml-auto">
          <ScriptMenu scripts={app.scripts} onRun={onScript} />
        </div>
      </CardFooter>
    </Card>
  );
};
