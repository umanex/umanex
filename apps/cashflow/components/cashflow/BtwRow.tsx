'use client';

import { formatCurrency } from '../../lib/cashflow/recurring';
import type { BtwPayment } from '../../lib/cashflow/types';

interface BtwRowProps {
  payment: BtwPayment;
  onMarkPaid?: (id: string) => void;
}

export function BtwRow({ payment, onMarkPaid }: BtwRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 px-2 rounded bg-amber-50 dark:bg-amber-950/30">
      <span className="text-sm text-amber-700 dark:text-amber-400 font-medium truncate">
        BTW {payment.label}
      </span>
      <span className="text-sm tabular-nums text-amber-700 dark:text-amber-400 shrink-0">
        -{formatCurrency(payment.amount)}
      </span>
      {onMarkPaid && (
        <button
          onClick={() => onMarkPaid(payment.id)}
          className="text-xs text-amber-600 hover:text-amber-900 dark:hover:text-amber-200 shrink-0 underline"
        >
          betaald
        </button>
      )}
    </div>
  );
}
