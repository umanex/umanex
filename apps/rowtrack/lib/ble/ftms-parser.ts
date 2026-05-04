import { base64ToBytes } from './base64';
import type { RowerMetrics } from './types';

const log: (...args: unknown[]) => void = __DEV__
  ? (...args: unknown[]) => console.log('[BLE]', ...args)
  : () => {};

/**
 * Parse a base64-encoded FTMS Rower Data characteristic (0x2ACC) value.
 *
 * Spec: Bluetooth FTMS v1.0, section 4.9 "Rower Data"
 * Flags (uint16 LE) determine which fields are present.
 * Fields appear in fixed order; only flagged fields are included.
 *
 * Bit 0  "More Data"        — INVERTED: 0 = Stroke Rate + Count present
 * Bit 1  Average Stroke Rate   (uint8, 0.5 spm resolution)
 * Bit 2  Total Distance        (uint24 LE, meters)
 * Bit 3  Instantaneous Pace    (uint16 LE, seconds per 500m)
 * Bit 4  Average Pace          (uint16 LE, seconds per 500m)
 * Bit 5  Instantaneous Power   (sint16 LE, watts)
 * Bit 6  Average Power         (sint16 LE, watts)
 * Bit 7  Resistance Level      (sint16 LE)
 * Bit 8  Expended Energy       (uint16 total + uint16/h + uint8/min)
 * Bit 9  Heart Rate            (uint8, bpm)
 * Bit 10 Metabolic Equivalent  (uint8, 0.1 resolution)
 * Bit 11 Elapsed Time          (uint16 LE, seconds)
 * Bit 12 Remaining Time        (uint16 LE, seconds)
 */
export function parseRowerData(base64Value: string): RowerMetrics {
  const data = base64ToBytes(base64Value);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const result = emptyMetrics();

  if (data.length < 2) {
    log(' rower data too short:', data.length);
    return result;
  }

  let offset = 0;
  const flags = view.getUint16(offset, true);
  offset += 2;

  if (__DEV__) {
    log(' raw:', Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' '));
    log(' flags:', flags.toString(2).padStart(16, '0'), 'hr bit9:', (flags >> 9) & 1);
  }

  // Bit 0: "More Data" — inverted: 0 means stroke rate + count present
  if (!(flags & (1 << 0))) {
    if (offset + 3 > data.length) return logResult(result);
    result.strokeRate = view.getUint8(offset) / 2;
    offset += 1;
    result.strokeCount = view.getUint16(offset, true);
    offset += 2;
  }

  // Bit 1: Average Stroke Rate (uint8, 0.5/min resolution)
  if (flags & (1 << 1)) {
    if (offset + 1 > data.length) return logResult(result);
    // If strokeRate not set by bit 0, use this as primary spm source
    const avgSpm = view.getUint8(offset) * 0.5;
    if (result.strokeRate === null) result.strokeRate = avgSpm;
    offset += 1;
  }

  // Bit 2: Total Distance (uint24, 3 bytes LE, meters)
  if (flags & (1 << 2)) {
    if (offset + 3 > data.length) return logResult(result);
    result.totalDistance =
      view.getUint8(offset) |
      (view.getUint8(offset + 1) << 8) |
      (view.getUint8(offset + 2) << 16);
    offset += 3;
  }

  // Bit 3: Instantaneous Pace (uint16 LE, seconds per 500m)
  if (flags & (1 << 3)) {
    if (offset + 2 > data.length) return logResult(result);
    result.instantaneousPace = view.getUint16(offset, true);
    offset += 2;
  }

  // Bit 4: Average Pace (uint16 LE, seconds per 500m)
  if (flags & (1 << 4)) {
    if (offset + 2 > data.length) return logResult(result);
    result.averagePace = view.getUint16(offset, true);
    offset += 2;
  }

  // Bit 5: Instantaneous Power (sint16 LE, watts)
  if (flags & (1 << 5)) {
    if (offset + 2 > data.length) return logResult(result);
    result.instantaneousPower = view.getInt16(offset, true);
    offset += 2;
  }

  // Bit 6: Average Power (sint16 LE, watts)
  if (flags & (1 << 6)) {
    if (offset + 2 > data.length) return logResult(result);
    result.averagePower = view.getInt16(offset, true);
    offset += 2;
  }

  // Bit 7: Resistance Level (sint16 LE)
  if (flags & (1 << 7)) {
    if (offset + 2 > data.length) return logResult(result);
    result.resistanceLevel = view.getInt16(offset, true);
    offset += 2;
  }

  // Bit 8: Expended Energy (total uint16 kcal + per hour uint16 + per min uint8)
  // Skipped — calories are calculated app-side via lib/calories.ts
  if (flags & (1 << 8)) {
    if (offset + 5 > data.length) return logResult(result);
    offset += 5;
  }

  // Bit 9: Heart Rate (uint8, bpm)
  if (flags & (1 << 9)) {
    if (offset + 1 > data.length) return logResult(result);
    if (__DEV__) log(' offset at HR read:', offset, 'byte value:', data[offset]);
    result.heartRate = view.getUint8(offset);
    offset += 1;
  }

  // Bit 10: Metabolic Equivalent (uint8, 0.1 resolution)
  if (flags & (1 << 10)) {
    if (offset + 1 > data.length) return logResult(result);
    result.metabolicEquivalent = view.getUint8(offset) / 10;
    offset += 1;
  }

  // Bit 11: Elapsed Time (uint16 LE, seconds)
  if (flags & (1 << 11)) {
    if (offset + 2 > data.length) return logResult(result);
    result.elapsedTime = view.getUint16(offset, true);
    offset += 2;
  }

  // Bit 12: Remaining Time (uint16 LE, seconds)
  if (flags & (1 << 12)) {
    if (offset + 2 > data.length) return logResult(result);
    result.remainingTime = view.getUint16(offset, true);
    offset += 2;
  }

  return logResult(result);
}

function logResult(r: RowerMetrics): RowerMetrics {
  log(' stroke data:', {
    spm: r.strokeRate,
    distance: r.totalDistance,
    split: r.instantaneousPace,
    watts: r.instantaneousPower,
    elapsed: r.elapsedTime,
    hr: r.heartRate,
  });
  return r;
}

function emptyMetrics(): RowerMetrics {
  return {
    strokeRate: null,
    strokeCount: null,
    totalDistance: null,
    instantaneousPace: null,
    averagePace: null,
    instantaneousPower: null,
    averagePower: null,
    resistanceLevel: null,
    heartRate: null,
    metabolicEquivalent: null,
    elapsedTime: null,
    remainingTime: null,
  };
}
