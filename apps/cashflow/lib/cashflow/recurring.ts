import { format, addMonths } from 'date-fns';
import type { MonthKey } from './types';

export function getCurrentMonthKey(): MonthKey {
  return format(new Date(), 'yyyy-MM');
}

export function getMonthLabel(monthKey: MonthKey): string {
  const parts = monthKey.split('-');
  const date = new Date(parseInt(parts[0]!, 10), parseInt(parts[1]!, 10) - 1, 1);
  const label = date.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function addMonth(monthKey: MonthKey, count = 1): MonthKey {
  const base = new Date(`${monthKey}-01`);
  return format(addMonths(base, count), 'yyyy-MM');
}

/**
 * Eén notatie voor een negatief bedrag in de hele app: een echt minteken (U+2212) vóór
 * het euroteken, zoals `formatSigned` het al schreef. `Intl` zet er zelf een
 * ASCII-koppelteken ná het symbool (`€ -780,25`), en sinds de bufferregel een negatieve
 * stand kan tonen staan die twee schrijfwijzen pal onder elkaar in dezelfde footer —
 * hetzelfde teken in twee vormen leest als twee dingen.
 *
 * Het teken volgt de **getoonde** magnitude, niet de rauwe waarde. Een bedrag dat als
 * "€ 0,00" op het scherm komt is nul en krijgt geen teken; een bedrag dat naar "€ 1"
 * wegrondt is dat niet en krijgt hem wél. Met een eigen afrondingsdrempel liep dat mis op
 * precies een halve eenheid: `Math.round` rondt daar naar nul en `Intl` ervan weg, dus
 * −0,50 werd "€ 1" — de magnitude van een negatief bedrag met een positief teken.
 */
function metTeken(amount: number, tekst: string): string {
  return amount < 0 && /[1-9]/.test(tekst) ? `−${tekst}` : tekst;
}

/** Overzichtsgetal zonder centen — KPI's en chart-labels. */
export function formatCurrency(amount: number): string {
  return metTeken(amount, new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Math.abs(amount)));
}

/**
 * Bedrag mét centen — ledgerregels, detailregels en de saldo-footer. Daar moeten de
 * getoonde getallen exact optellen tot het getoonde totaal; afronden per regel zou de
 * som zichtbaar een euro doen missen.
 */
export function formatAmount(amount: number): string {
  return metTeken(amount, new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount)));
}

/** Richting van een bedrag in de ledger. `neutral` is een saldo, geen mutatie. */
export type AmountDirection = 'in' | 'out' | 'neutral';

/**
 * Bedrag met een expliciet teken vóór het symbool. Kleur mag nooit de enige drager van
 * betekenis zijn (WCAG 1.4.1) — het teken is de tweede codering. Een bedrag dat tegen
 * zijn richting in gaat (een bufferopname op een uitgavenregel) draait mee: dat is geld
 * dat terugkomt, en dat hoort ook zo te lezen.
 */
export function formatSigned(amount: number, direction: AmountDirection): string {
  // Nul beweegt niet: daar zou een teken suggereren dat er iets gebeurt.
  if (direction === 'neutral' || Math.abs(amount) < 0.005) return formatAmount(Math.abs(amount));
  const inflow = direction === 'in' ? amount >= 0 : amount < 0;
  return `${inflow ? '+' : '−'}${formatAmount(Math.abs(amount))}`;
}

/** Loopt dit bedrag als geld naar binnen? Bepaalt teken én kleur. */
export function isInflow(amount: number, direction: AmountDirection): boolean {
  return direction === 'in' ? amount >= 0 : amount < 0;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function limitDecimals(value: string): string {
  const sepIdx = value.search(/[,.]/);
  if (sepIdx === -1) return value;
  return value.slice(0, sepIdx + 1) + value.slice(sepIdx + 1).replace(/[,.]/g, '').slice(0, 2);
}
