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
   * is)? Dan blijft de regel leeg. Het beginsaldo is daar je échte banksaldo — met álle
   * potten erin en met de afgevinkte betalingen er al af — terwijl de maandstroom die
   * posten wél telt en de andere potten niet. `Beginsaldo + Deze maand` komt dus niet uit
   * op `Buffer`, en in elke ándere kolom doet het dat wél op de cent. Eén getal dat als
   * enige niet optelt in de kolom die je dagelijks bekijkt, leest als een rekenfout; er
   * bestaat geen variant die daar wél klopt (een saldoverschil op de ankerbasis wijkt af
   * met precies het afgevinkte bedrag). Dus: niets tonen in plaats van iets dat niet sluit.
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
              ? 'Deze maand is al deels voorbij: je beginsaldo is het echte banksaldo, waar de afgevinkte posten al af zijn en de andere potten nog in zitten. Een maandbeweging is daar niet te nemen zonder dat de kolom niet meer optelt.'
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
            isAnchor || Math.abs(movement) < 0.005
              ? 'text-muted-foreground'
              : movement > 0
                ? 'text-finance-positive'
                : 'text-finance-negative'
          }`}
        >
          {/* Em-streepje, geen leeg element: de regel houdt zo zijn hoogte én zegt
              "niet van toepassing" in plaats van "nul". */}
          {isAnchor ? '—' : formatSigned(movement, 'in')}
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
