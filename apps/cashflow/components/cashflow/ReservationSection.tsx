'use client';

import { useDraggable } from '@dnd-kit/core';
import type { ReservationPotBalance, ReservationPayment, MonthKey } from '../../lib/cashflow/types';
import { formatCurrency, getMonthLabel } from '../../lib/cashflow/recurring';

interface DeferredReservationDisplayItem {
  deferId: string;
  reservationId: string;
  label: string;
  amount: number;
  fromMonth: MonthKey;
}

interface ReservationSectionProps {
  monthKey: MonthKey;
  pots: ReservationPotBalance[];
  deferredReservationItems: DeferredReservationDisplayItem[];
  onRegisterPayment: () => void;
  onRemovePayment: (id: string) => void;
  onRemoveReservationDefer: (deferId: string) => void;
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
      className={`flex items-center gap-1.5 pl-5 py-0.5 text-xs text-muted-foreground ${
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
        onPointerDown={(e) => e.stopPropagation()}
        className="text-muted-foreground hover:text-destructive transition-colors leading-none flex-shrink-0 ml-0.5"
        aria-label="Verwijder betaling"
      >
        ×
      </button>
    </div>
  );
}

function DraggablePotRow({
  pot,
  monthKey,
  onRemovePayment,
}: {
  pot: ReservationPotBalance;
  monthKey: MonthKey;
  onRemovePayment: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `reservation-pot-${pot.reservationId}-${monthKey}`,
    data: {
      type: 'reservation-pot',
      id: pot.reservationId,
      sourceMonth: monthKey,
      label: pot.label,
      amount: pot.monthlyAmount,
    },
  });

  return (
    <div ref={setNodeRef} className={`space-y-0.5 ${isDragging ? 'opacity-30' : ''}`}>
      <div className="flex items-center gap-2">
        <button
          {...listeners}
          {...attributes}
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing text-base leading-none select-none flex-shrink-0"
          aria-label="Versleep spaarpot bijdrage"
        >
          ⠿
        </button>
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
          -{formatCurrency(pot.monthlyAmount)}/m
        </span>
      </div>
      {pot.paymentsThisMonth.map((payment) => (
        <DraggablePayment key={payment.id} payment={payment} onRemove={onRemovePayment} />
      ))}
    </div>
  );
}

export function ReservationSection({
  monthKey,
  pots,
  deferredReservationItems,
  onRegisterPayment,
  onRemovePayment,
  onRemoveReservationDefer,
}: ReservationSectionProps) {
  if (pots.length === 0 && deferredReservationItems.length === 0) return null;

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
        <DraggablePotRow
          key={pot.reservationId}
          pot={pot}
          monthKey={monthKey}
          onRemovePayment={onRemovePayment}
        />
      ))}

      {deferredReservationItems.map((d) => (
        <div key={d.deferId} className="flex items-center gap-2 py-0.5">
          <span className="flex-1 text-sm truncate">
            <span className="text-amber-600">{d.label}</span>
            {' '}
            <span className="text-xs text-amber-500">
              (uitgesteld van {getMonthLabel(d.fromMonth)})
            </span>
          </span>
          <span className="text-sm font-medium text-amber-600 tabular-nums flex-shrink-0">
            -{formatCurrency(d.amount)}/m
          </span>
          <button
            onClick={() => onRemoveReservationDefer(d.deferId)}
            className="text-amber-500 hover:text-amber-700 transition-colors text-sm leading-none flex-shrink-0"
            aria-label="Uitstelling ongedaan maken"
            title="Ongedaan maken"
          >
            ↩
          </button>
        </div>
      ))}
    </div>
  );
}
