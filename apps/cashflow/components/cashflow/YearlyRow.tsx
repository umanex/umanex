'use client';

import { formatCurrency } from '../../lib/cashflow/recurring';
import type { RecurringItem } from '../../lib/cashflow/types';

interface YearlyRowProps {
  item: RecurringItem;
}

export function YearlyRow({ item }: YearlyRowProps) {
  const monthly = item.amount / 12;
  return (
    <div className="flex items-center justify-between gap-2 py-1 px-2 rounded bg-violet-50 dark:bg-violet-950/30">
      <span className="text-sm text-violet-700 dark:text-violet-400 truncate">{item.label}</span>
      <span className="text-sm tabular-nums text-violet-700 dark:text-violet-400 shrink-0">
        -{formatCurrency(monthly)}/m
      </span>
    </div>
  );
}
