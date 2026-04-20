'use client';

import type { ReservationPotBalance } from '../../lib/cashflow/types';
import { formatCurrency } from '../../lib/cashflow/recurring';

interface ReservationSectionProps {
  pots: ReservationPotBalance[];
  onRegisterPayment: () => void;
}

export function ReservationSection({ pots, onRegisterPayment }: ReservationSectionProps) {
  if (pots.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Spaarpotten
        </span>
        <button
          onClick={onRegisterPayment}
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          + Betaling
        </button>
      </div>

      {pots.map((pot) => (
        <div key={pot.reservationId} className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm truncate">{pot.label}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              saldo {formatCurrency(pot.potBalance)}
            </span>
            <span className="text-sm font-medium text-amber-600 tabular-nums">
              -{formatCurrency(pot.monthlyAmount)}
            </span>
          </div>

          {pot.paymentsThisMonth.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center gap-2 pl-3 py-0.5 text-xs text-muted-foreground"
            >
              <span className="flex-1 truncate">{payment.label}</span>
              {payment.fromReservation > 0 && (
                <span className="tabular-nums">pot: -{formatCurrency(payment.fromReservation)}</span>
              )}
              {payment.fromCash > 0 && (
                <span className="tabular-nums">cash: -{formatCurrency(payment.fromCash)}</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
