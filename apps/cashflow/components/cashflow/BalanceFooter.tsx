'use client';

import { formatAmount, formatSigned } from '../../lib/cashflow/recurring';

type BalanceFooterProps = {
  /** Beweging van de bufferstand deze maand: inkomsten min alle kosten vóór buffer. */
  movement: number;
  /** Waar je aan het einde van deze maand staat: potstand plus vrij saldo. */
  position: number;
  /**
   * Is er een bufferpot ingesteld? Gelijk voor alle drie de maanden — de footers moeten
   * op één lijn blijven staan, dus mag deze staat niet per kolom verschillen.
   */
  hasBuffer: boolean;
  /**
   * Is dit de ankerkolom (of een afgesloten maand, die per constructie zijn eigen anker
   * is)? Daar telt `Beginsaldo + Deze maand` niet op tot `Buffer`, en dat is geen fout:
   * het beginsaldo is je échte banksaldo, dus wat je al hebt afgevinkt is er al af,
   * terwijl de maandstroom die posten wél meetelt. Het verschil is exact het afgevinkte
   * bedrag. Zonder uitleg leest dat als een rekenfout in de enige kolom die je dagelijks
   * bekijkt.
   */
  isAnchor: boolean;
};

export function BalanceFooter({ movement, position, hasBuffer, isAnchor }: BalanceFooterProps) {
  if (!hasBuffer) {
    return (
      <div className="shrink-0 border-t border-accent px-4 py-3 flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Geen buffer</span>
        <span className="text-2xs leading-tight text-muted-foreground">
          Markeer een provisie als buffer om te zien waar je aan het einde van elke maand staat.
        </span>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-accent px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span
          className="text-sm text-muted-foreground"
          title={
            isAnchor
              ? 'Alles wat deze maand binnenkwam en vertrok. Je beginsaldo is het echte banksaldo, dus wat je al afvinkte is daar al af — daarom telt deze regel niet op van beginsaldo naar buffer.'
              : 'Alles wat deze maand binnenkwam en vertrok. Vorig saldo plus deze beweging is de bufferstand eronder.'
          }
        >
          Deze maand
        </span>
        <span
          className={`text-sm tabular-nums ${
            // Drie takken, niet twee. Zelfde drempel als `formatSigned`: onder een halve
            // cent schrijft die al "€ 0,00" zonder teken, en een maand waarin niets
            // beweegt is niet positief maar stil — groen zetten zou dat als goed nieuws
            // lezen, pal boven een stand die rood kan staan.
            Math.abs(movement) < 0.005
              ? 'text-muted-foreground'
              : movement > 0
                ? 'text-finance-positive'
                : 'text-finance-negative'
          }`}
        >
          {formatSigned(movement, 'in')}
        </span>
      </div>

      <div className="border-t border-border mt-1 pt-2" />

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Buffer</span>
        <span
          className={`text-lg font-bold tabular-nums ${
            position > -0.005 ? 'text-finance-positive' : 'text-finance-negative'
          }`}
        >
          {formatAmount(position)}
        </span>
      </div>
    </div>
  );
}
