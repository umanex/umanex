'use client';

import type { ReservationPotBalance } from '../../lib/cashflow/types';
import { formatCurrency } from '../../lib/cashflow/recurring';

interface ReservationPotCardProps {
  pot: ReservationPotBalance;
}

export function ReservationPotCard({ pot }: ReservationPotCardProps) {
  const positive = pot.potBalance >= 0;
  return (
    <div
      className={`flex items-center justify-between gap-2 py-1 px-2 rounded text-xs ${positive ? 'bg-teal-50 dark:bg-teal-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}
    >
      <span
        className={`flex-1 truncate font-medium ${positive ? 'text-teal-700 dark:text-teal-400' : 'text-destructive'}`}
      >
        {pot.label || <span className="italic text-muted-foreground">Naamloos</span>}
      </span>
      <div className="flex flex-col items-end shrink-0">
        <span
          className={`tabular-nums font-semibold ${positive ? 'text-teal-700 dark:text-teal-400' : 'text-destructive'}`}
        >
          {formatCurrency(pot.potBalance)}
        </span>
        <span className="text-muted-foreground">
          +{formatCurrency(pot.monthlyAmount)}/m
        </span>
      </div>
    </div>
  );
}
