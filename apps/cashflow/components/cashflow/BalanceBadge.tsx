'use client';

import { formatCurrency } from '../../lib/cashflow/recurring';

interface BalanceBadgeProps {
  amount: number;
  label?: string;
}

export function BalanceBadge({ amount, label }: BalanceBadgeProps) {
  const positive = amount >= 0;
  return (
    <div className="flex flex-col items-end gap-0.5">
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <span
        className={`text-sm font-semibold tabular-nums ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
      >
        {formatCurrency(amount)}
      </span>
    </div>
  );
}
