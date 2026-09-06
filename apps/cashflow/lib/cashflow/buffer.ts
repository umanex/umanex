import type { MonthData } from './types';
import { netBurn } from './burn';

/**
 * Wat de bufferpot in één maand doet. Eén afleiding voor de footer, de analyse en de
 * snapshots — anders zou elk van die drie zijn eigen optelling over `reservationPots`
 * maken en zouden ze uit de pas lopen zodra de pot ook betalingen of uitstel kent.
 */
export interface BufferSummary {
  /** Staat er een pot als buffer gemarkeerd in deze maand? */
  present: boolean;
  /**
   * Beweging van de pot deze maand: positief is opbouw, negatief een opname. Gemeten als
   * eindstand − beginstand, dus inclusief betalingen en toekomend uitstel — niet enkel de
   * afgeleide storting.
   */
  delta: number;
  /** Stand van de pot aan het einde van de maand. */
  total: number;
  /** Tekort dat de pot deze maand niet meer kon dekken. */
  uncovered: number;
  /**
   * Waar je staat aan het einde van de maand: potstand plus vrij saldo.
   *
   * `total` alleen volstaat niet. De opname is begrensd tot wat er in de pot zit
   * (`calculator.ts`), dus zodra een tekort de pot overstijgt landt `total` op €0 en rolt
   * het restant door als negatief vrij saldo. De pot melden was daardoor "€ 0,00" in
   * precies de maand waarin je er het slechtst voor staat. Omdat de opname per constructie
   * exact het potsaldo is, viel `delta` dan bovendien samen met de bufferstand van de
   * maand ervoor — waardoor de footer eruitzag alsof hij die stand doorschoof.
   *
   * Ook zonder bufferpot in déze maand is dit de juiste waarde: dan is er nog geen pot en
   * is het vrije saldo de hele positie. Nul teruggeven zou geld laten verdwijnen uit een
   * kolom die de footer wél toont — `hasBuffer` is vensterbreed (`app/page.tsx`), dus een
   * maand vóór de startmaand van de pot rendert hem gewoon mee.
   */
  position: number;
  /**
   * Beweging van die positie over de maand: inkomsten min alle kosten vóór buffer.
   *
   * Bewust `netBurn` en niet `position(t) − position(t−1)`. Dat verschil is in een latere
   * maand gelijk, maar in de ankermaand niet te nemen: daar is `startBalance` het
   * banksaldo — inclusief alles wat er in de potten zit — en zijn de reeds afgevinkte
   * betalingen er al af, dus is er geen vorige positie om van af te trekken.
   */
  movement: number;
}

export function bufferSummary(data: MonthData): BufferSummary {
  const pots = data.reservationPots.filter((p) => p.isDeficitBuffer);
  const present = pots.length > 0;
  const total = pots.reduce((s, p) => s + p.potBalance, 0);

  return {
    present,
    delta: pots.reduce((s, p) => s + (p.potBalance - p.deferredFromPrevious), 0),
    total,
    uncovered: pots.reduce((s, p) => s + p.deficitUncovered, 0),
    position: total + data.endBalance,
    movement: -netBurn(data),
  };
}
