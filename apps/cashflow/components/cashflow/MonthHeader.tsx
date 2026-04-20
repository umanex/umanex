'use client';

import { getMonthLabel, formatCurrency } from '../../lib/cashflow/recurring';
import type { MonthKey } from '../../lib/cashflow/types';

interface MonthHeaderProps {
  monthKey: MonthKey;
  endBalance: number;
}

export function MonthHeader({ monthKey, endBalance }: MonthHeaderProps) {
  const positive = endBalance >= 0;
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-t-lg border-b border-border">
      <span className="text-sm font-medium capitalize">{getMonthLabel(monthKey)}</span>
      <span
        className={`text-sm font-bold tabular-nums ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
      >
        {formatCurrency(endBalance)}
      </span>
    </div>
  );
}
