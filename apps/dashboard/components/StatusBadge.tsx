import { Badge } from '@umanex/ui/components/ui/badge';
import type { AppStatus } from '@/lib/types';

type Props = {
  state: AppStatus['state'];
  owner: AppStatus['owner'];
  ownerLabel: string | null;
  port: number | null;
};

// De punt draagt de kleur, de tekst draagt de betekenis — kleur alleen zou de status
// onleesbaar maken voor wie hem niet ziet.
//
// 'extern' krijgt bewust dezelfde groentint als 'draait', alleen gedempt: het ís een
// gezonde server, hij is alleen niet van ons. Rood (bg-primary) stond hier eerst en
// las als een fout — gemeten op de render van 2026-09-07.
const STIP: Record<AppStatus['state'], string> = {
  laden: 'bg-muted-foreground/40',
  gestopt: 'bg-muted-foreground/40',
  startend: 'bg-warning',
  draait: 'bg-success',
  extern: 'bg-success/40',
  mislukt: 'bg-destructive',
};

function tekst(state: AppStatus['state'], owner: AppStatus['owner'], ownerLabel: string | null): string {
  if (state === 'laden') return 'meten…';
  if (state === 'extern') return owner === 'pm2' ? `draait · PM2 (${ownerLabel})` : 'draait · extern';
  if (state === 'startend') return 'startend';
  if (state === 'draait') return 'draait';
  if (state === 'mislukt') return 'start mislukt';
  return 'gestopt';
}

export const StatusBadge = ({ state, owner, ownerLabel, port }: Props) => (
  <Badge variant="outline" className="gap-1.5 font-normal">
    <span className={`h-2 w-2 shrink-0 rounded-full ${STIP[state]}`} aria-hidden="true" />
    {tekst(state, owner, ownerLabel)}
    {port !== null && state !== 'gestopt' && state !== 'laden' ? (
      <span className="text-muted-foreground">:{port}</span>
    ) : null}
  </Badge>
);
