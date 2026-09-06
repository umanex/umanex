import type { MonthData, MonthKey, MonthSnapshot } from './types';
import { bufferSummary } from './buffer';
// `netBurn` staat in ./burn omdat ook lib/cashflow/buffer.ts hem nodig heeft: die
// afleiding en deze module zouden elkaar anders circulair importeren.
import { netBurn } from './burn';

/** Onder dit aantal afgesloten maanden is een trend ruis, geen signaal. */
export const TREND_THRESHOLD = 3;

/** Rollend venster voor het gemiddelde: één maand is onbetrouwbaar bij wisselende facturen. */
const BURN_WINDOW = 6;

/** Bufferstand aan het einde van een maand: potstand plus vrij saldo. */
export interface BufferPoint {
  monthKey: MonthKey;
  buffer: number;
  /** Historie is afgesloten; prognose staat nog te gebeuren. */
  isForecast: boolean;
}

export interface RunwayResult {
  /**
   * Maanden die de bufferpot het gemiddelde netto tekort dekt. `null` wanneer er geen
   * tekort is — dan bouw je op en zegt een runway niets.
   */
  months: number | null;
  buffer: number;
  /** Gemiddeld netto tekort per maand over de afgesloten maanden. */
  netBurn: number;
  closedMonths: number;
  hasEnoughData: boolean;
}

/**
 * De bufferstand zoals het scherm hem noemt: de positie, niet de potstand. Een pot die
 * op €0 staat omdat hij een tekort niet meer kon dekken, laat dat tekort als negatief
 * vrij saldo achter — de runway en de grafiek moeten dat meenemen, anders melden ze
 * "€ 0,00" en "0 maanden" op het moment dat de maandfooter −€ 792,57 toont.
 */
function bufferBalance(data: MonthData): number {
  return bufferSummary(data).position;
}

/**
 * Runway op basis van de bufferpot en het gemiddelde netto tekort van de afgesloten
 * maanden. Bewust niet "hoelang overleef ik": je vrije saldo en je provisies blijven
 * erbuiten, dus dit antwoordt op "hoelang dekt mijn buffer het gat".
 */
export function computeRunway(
  snapshots: MonthSnapshot[],
  currentMonth: MonthData | undefined,
): RunwayResult {
  const closed = [...snapshots].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const window = closed.slice(-BURN_WINDOW);
  const buffer = currentMonth ? bufferBalance(currentMonth) : 0;

  if (window.length === 0) {
    return { months: null, buffer, netBurn: 0, closedMonths: 0, hasEnoughData: false };
  }

  const average = window.reduce((s, snap) => s + netBurn(snap.data), 0) / window.length;
  const hasEnoughData = closed.length >= TREND_THRESHOLD;

  return {
    months: average > 0 ? buffer / average : null,
    buffer,
    netBurn: average,
    closedMonths: closed.length,
    hasEnoughData,
  };
}

/**
 * Bufferstand per maand: eerst de afgesloten maanden als historie, daarna het venster
 * als prognose. De grens tussen beide is waar de grafiek van doorlopend naar gestippeld
 * gaat.
 */
export function bufferSeries(
  snapshots: MonthSnapshot[],
  forecast: MonthData[],
): BufferPoint[] {
  const history = [...snapshots]
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    // Bewust niet `snap.buffer`: dat bevroren veld is de potstand, en die is €0 in
    // precies de maanden waar de positie negatief staat. De volledige `MonthData` zit
    // in het snapshot, dus de positie is er af te leiden zonder de historie te
    // herschrijven — de bevroren waarden blijven onaangeroerd.
    .map<BufferPoint>((snap) => ({
      monthKey: snap.monthKey,
      buffer: bufferSummary(snap.data).position,
      isForecast: false,
    }));

  const closedKeys = new Set(history.map((h) => h.monthKey));
  const projected = forecast
    .filter((m) => !closedKeys.has(m.monthKey))
    .map<BufferPoint>((m) => ({
      monthKey: m.monthKey,
      buffer: bufferBalance(m),
      isForecast: true,
    }));

  return [...history, ...projected];
}
