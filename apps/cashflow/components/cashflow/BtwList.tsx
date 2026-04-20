'use client';

import { useCashflowStore } from '../../store/cashflow';
import { useCashflowActions } from '../../hooks/useCashflow';
import { formatCurrency } from '../../lib/cashflow/recurring';

export function BtwList() {
  const btwPayments = useCashflowStore((s) => s.btwPayments);
  const { removeBtwPayment, updateBtwPayment } = useCashflowActions();

  if (btwPayments.length === 0) return null;

  return (
    <div className="space-y-1">
      {btwPayments.map((payment) => (
        <div
          key={payment.id}
          className={`flex items-center justify-between gap-2 py-1 px-3 rounded text-sm group ${payment.paid ? 'opacity-50' : ''}`}
        >
          <span className="flex-1 truncate">BTW {payment.label}</span>
          <span className="text-xs text-muted-foreground shrink-0">{payment.dueMonth}</span>
          <span className="tabular-nums text-amber-600 dark:text-amber-400 shrink-0">
            -{formatCurrency(payment.amount)}
          </span>
          <button
            onClick={() => updateBtwPayment(payment.id, { paid: !payment.paid })}
            className="text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            {payment.paid ? '↩' : '✓'}
          </button>
          <button
            onClick={() => removeBtwPayment(payment.id)}
            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity text-xs shrink-0"
            aria-label={`Verwijder BTW ${payment.label}`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
