'use client';

import { useDraggable } from '@dnd-kit/core';
import type { ReservationPotBalance, ReservationPayment } from '../../lib/cashflow/types';
import { formatCurrency } from '../../lib/cashflow/recurring';

interface ReservationSectionProps {
  pots: ReservationPotBalance[];
  onRegisterPayment: () => void;
  onRemovePayment: (id: string) => void;
}

function DraggablePayment({
  payment,
  onRemove,
}: {
  payment: ReservationPayment;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `reservation-payment-${payment.id}`,
    data: {
      type: 'reservation-payment',
      id: payment.id,
      sourceMonth: payment.monthKey,
      label: payment.label,
      amount: payment.invoiceAmount,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-1.5 pl-1 py-0.5 text-xs text-muted-foreground ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <button
        {...listeners}
        {...attributes}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing text-sm leading-none select-none flex-shrink-0"
        aria-label="Versleep betaling"
      >
        ⠿
      </button>
      <span className="flex-1 truncate">{payment.label}</span>
      {payment.fromReservation > 0 && (
        <span className="tabular-nums flex-shrink-0">
          pot: -{formatCurrency(payment.fromReservation)}
        </span>
      )}
      {payment.fromCash > 0 && (
        <span className="tabular-nums flex-shrink-0">
          cash: -{formatCurrency(payment.fromCash)}
        </span>
      )}
      <button
        onClick={() => onRemove(payment.id)}
        className="text-muted-foreground hover:text-destructive transition-colors leading-none flex-shrink-0 ml-0.5"
        aria-label="Verwijder betaling"
      >
        ×
      </button>
    </div>
  );
}

export function ReservationSection({
  pots,
  onRegisterPayment,
  onRemovePayment,
}: ReservationSectionProps) {
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
            <span
              className={`text-xs tabular-nums ${
                pot.potBalance < 0 ? 'text-destructive font-medium' : 'text-muted-foreground'
              }`}
            >
              saldo {formatCurrency(pot.potBalance)}
              {pot.potBalance < 0 && ' ⚠'}
            </span>
            <span className="text-sm font-medium text-amber-600 tabular-nums">
              -{formatCurrency(pot.monthlyAmount)}
            </span>
          </div>

          {pot.paymentsThisMonth.map((payment) => (
            <DraggablePayment
              key={payment.id}
              payment={payment}
              onRemove={onRemovePayment}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
