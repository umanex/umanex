import type { MonthKey } from './types';

/** Belgian BTW quarterly payment months (1-indexed): January, April, July, October */
const BTW_PAYMENT_MONTHS = [1, 4, 7, 10] as const;

function parseMonthKey(monthKey: MonthKey): [number, number] {
  const parts = monthKey.split('-');
  return [parseInt(parts[0]!, 10), parseInt(parts[1]!, 10)];
}

export function isBtwMonth(monthKey: MonthKey): boolean {
  const [, month] = parseMonthKey(monthKey);
  return (BTW_PAYMENT_MONTHS as readonly number[]).includes(month);
}

export function getBtwQuarterLabel(dueMonth: MonthKey): string {
  const [yearNum, month] = parseMonthKey(dueMonth);
  const quarterMap: Record<number, string> = { 1: 'Q4', 4: 'Q1', 7: 'Q2', 10: 'Q3' };
  const prevYear = month === 1 ? yearNum - 1 : yearNum;
  return `${quarterMap[month] ?? '?'} ${prevYear}`;
}

export function btwDueMonthsInRange(
  startMonth: MonthKey,
  endMonth: MonthKey,
): MonthKey[] {
  const result: MonthKey[] = [];
  const [startYear, startMo] = parseMonthKey(startMonth);
  const [endYear, endMo] = parseMonthKey(endMonth);

  let year = startYear;
  let mo = startMo;

  while (year < endYear || (year === endYear && mo <= endMo)) {
    const key: MonthKey = `${year}-${String(mo).padStart(2, '0')}`;
    if (isBtwMonth(key)) result.push(key);
    mo++;
    if (mo > 12) { mo = 1; year++; }
  }

  return result;
}
