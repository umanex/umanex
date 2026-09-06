import type { MonthData, ReservationPotBalance } from './types';

/**
 * Netto tekort van één maand: wat eruit ging min wat erin kwam.
 *
 * Bewust niet afgeleid uit `subtotals`. Die koppen antwoorden in de ankermaand op een
 * andere vraag — "wat moet er nog van je huidige banksaldo af" — en dragen daar de
 * volledige opgebouwde stand van elke provisiepot in plaats van de storting van die ene
 * maand. Elke afgesloten maand is per constructie zo'n ankermaand (`useAutoCloseMonth`
 * rekent één maand vanaf zijn eigen ankerstaat door), dus zou de runway systematisch een
 * tekort melden ter grootte van je opgebouwde provisies.
 *
 * Hier meten we daarom stromen: wat er deze maand aan kosten vertrekt, tegenover wat er
 * binnenkwam. De buffer blijft erbuiten — hij neemt per constructie op wat er overblijft
 * en vult aan wat er tekort is, dus zou elke maand op nul uitkomen als hij meetelde.
 * Precies die beweging is wat de runway moet verklaren.
 */
export function netBurn(data: MonthData): number {
  // Een budget telt volledig mee, ook onbesteed: het prudente model gaat ervan uit dat
  // het opgaat. Een provisie telt met de storting van deze maand, verminderd met wat een
  // finalisatie weer vrijgeeft.
  // Wat een pot niet kan dragen, komt van de rekening: een betaling boven het potsaldo is
  // een echte uitstroom en hoort dus in de burn. `subtotals.ts` boekt hem als `teveel`;
  // zonder deze term meldt een maand met zo'n betaling een te gunstige stroom, en dan
  // sluit de bufferstand van de vorige maand plus die stroom niet meer op de nieuwe stand.
  const teveel = (p: ReservationPotBalance): number =>
    Math.max(
      0,
      p.paymentsThisMonth.reduce((s, pay) => s + pay.fromReservation, 0) -
        (p.deferredFromPrevious + p.provisionThisMonth),
    );

  const potFlow = (p: ReservationPotBalance): number =>
    p.potType === 'maandelijks_budget'
      ? p.provisionThisMonth
      : p.provisionThisMonth - p.releasedThisMonth + teveel(p);

  const costs =
    data.totalRecurring +
    data.totalExpenses +
    data.totalReservationCashPayments +
    data.reservationPots.filter((p) => !p.isDeficitBuffer).reduce((s, p) => s + potFlow(p), 0) +
    data.deferredReservationAmount;

  return costs - data.totalIncome;
}
