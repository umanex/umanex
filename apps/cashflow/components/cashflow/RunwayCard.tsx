'use client';

import { formatCurrency } from '../../lib/cashflow/recurring';
import { TREND_THRESHOLD, type RunwayResult } from '../../lib/cashflow/analysis';

type RunwayCardProps = {
  runway: RunwayResult;
};

/** Bovengrens van de balk. Verder dan een jaar vooruit zegt het getal weinig meer. */
const BAR_MAX_MONTHS = 12;

/**
 * Runway als getal met een lineaire balk. Bewust geen cirkelvormige gauge — die kost veel
 * ruimte om weinig te zeggen en faalt bij vergelijken (Few); beide adviesrapporten raden
 * hem expliciet af.
 */
export function RunwayCard({ runway }: RunwayCardProps) {
  const { months, buffer, netBurn, closedMonths, hasEnoughData } = runway;

  if (!hasEnoughData) {
    const nog = TREND_THRESHOLD - closedMonths;
    return (
      <div className="rounded-xl border border-accent bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Runway</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Nog {nog} {nog === 1 ? 'afgesloten maand' : 'afgesloten maanden'} nodig voor dit
          iets zegt. Een gemiddelde over minder maanden zwabbert te hard bij wisselende
          facturen.
        </p>
      </div>
    );
  }

  // Een negatieve bufferstand is geen korte runway maar een pot die al leeg is én een
  // tekort dat doorrolt. Sinds 2026-09-06 leest `runway.buffer` de positie in plaats van
  // de potstand: die laatste is per constructie €0 zodra het tekort de pot overstijgt, en
  // dan meldde deze kaart "0 maanden" naast een footer die −€ 792,57 toonde. Zonder
  // ondergrens leverde dat bovendien een negatieve CSS-breedte op: de browser verwerpt
  // die, de balk valt terug op auto en vult het hele spoor — maximale runway tonen bij
  // een pot in het rood.
  // Dezelfde halve cent als de footer (`BalanceFooter`): de sweep laat een residu tot
  // EPSILON staan zonder het als tekort te boeken, dus zonder deze drempel meldt deze
  // kaart "staat negatief" bij −5,6e−17 terwijl de footer in dezelfde toestand groen
  // "€ 0,00" toont.
  const leeg = buffer < -0.005;
  const filled = months === null ? 1 : Math.min(Math.max(months / BAR_MAX_MONTHS, 0), 1);

  return (
    <div className="rounded-xl border border-accent bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">Runway</h2>
      <p className="text-sm text-muted-foreground">
        Hoelang je buffer het gemiddelde maandtekort dekt
      </p>

      <p className="mt-3 text-3xl font-bold tabular-nums text-foreground">
        {leeg ? (
          <span className="text-finance-negative">Buffer staat negatief</span>
        ) : months === null ? (
          <span className="text-finance-positive">Geen tekort</span>
        ) : (
          <>
            {months.toLocaleString('nl-BE', { maximumFractionDigits: 1 })}{' '}
            <span className="text-lg font-semibold text-muted-foreground">
              {months === 1 ? 'maand' : 'maanden'}
            </span>
          </>
        )}
      </p>

      <div
        className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden"
        role="img"
        aria-label={
          leeg
            ? 'Buffer staat negatief'
            : months === null
              ? 'Geen maandelijks tekort'
              : `Runway ${months.toFixed(1)} maanden van maximaal ${BAR_MAX_MONTHS}`
        }
      >
        <div
          className={`h-full rounded-full ${
            leeg
              ? 'bg-finance-negative-surface'
              : months === null
                ? 'bg-finance-positive'
                : 'bg-foreground'
          }`}
          style={{ width: `${(leeg ? 1 : filled) * 100}%` }}
        />
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Buffer</dt>
          <dd className="tabular-nums text-foreground">{formatCurrency(buffer)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">
            {netBurn > 0 ? 'Tekort per maand' : 'Overschot per maand'}
          </dt>
          <dd className="tabular-nums text-foreground">
            {formatCurrency(Math.abs(netBurn))}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Gemiddeld over</dt>
          <dd className="tabular-nums text-foreground">
            {Math.min(closedMonths, 6)} {closedMonths === 1 ? 'maand' : 'maanden'}
          </dd>
        </div>
      </dl>
    </div>
  );
}
