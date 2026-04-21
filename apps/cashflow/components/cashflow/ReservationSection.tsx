'use client';

import { useState, useEffect } from 'react';
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
  onMovePayment: (id: string, newMonthKey: MonthKey) => void;
  onRemoveReservationDefer: (deferId: string) => void;
  onSettleReservation: (reservationId: string, effectiveAmount: number) => void;
  onRemoveReservationSettlement: (reservationId: string) => void;
}

function nextMonthKey(monthKey: MonthKey): MonthKey {
  const parts = monthKey.split('-').map(Number);
  const year = parts[0] ?? 2000;
  const month = parts[1] ?? 1;
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`;
}

function DraggablePayment({
  payment,
  currentMonthKey,
  onRemove,
  onMove,
}: {
  payment: ReservationPayment;
  currentMonthKey: MonthKey;
  onRemove: (id: string) => void;
  onMove: (id: string, newMonthKey: MonthKey) => void;
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
      className={`flex items-center gap-1.5 text-xs text-muted-foreground ${isDragging ? 'opacity-30' : ''}`}
    >
      <button
        {...listeners}
        {...attributes}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing text-sm leading-none select-none flex-shrink-0"
        aria-label="Versleep betaling"
      >
        ⠿
      </button>
      <span className="flex-1 truncate font-medium text-foreground">{payment.label}</span>
      <button
        onClick={() => onMove(payment.id, nextMonthKey(currentMonthKey))}
        onPointerDown={(e) => e.stopPropagation()}
        className="text-muted-foreground hover:text-primary transition-colors leading-none"
        title="Verplaats naar volgende maand"
        aria-label="Verplaats naar volgende maand"
      >
        →
      </button>
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
  onMovePayment,
  onSettle,
  onRemoveSettlement,
}: {
  pot: ReservationPotBalance;
  monthKey: MonthKey;
  onRemovePayment: (id: string) => void;
  onMovePayment: (id: string, newMonthKey: MonthKey) => void;
  onSettle: (reservationId: string, effectiveAmount: number) => void;
  onRemoveSettlement: (reservationId: string) => void;
}) {
  const [localAmount, setLocalAmount] = useState(String(pot.effectiveAmount));

  useEffect(() => {
    setLocalAmount(String(pot.effectiveAmount));
  }, [pot.effectiveAmount]);

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

  function handleAmountBlur() {
    const amt = parseFloat(localAmount.replace(',', '.'));
    if (isNaN(amt) || amt < 0) {
      setLocalAmount(String(pot.monthlyAmount));
      onRemoveSettlement(pot.reservationId);
      return;
    }
    if (Math.abs(amt - pot.monthlyAmount) < 0.01) {
      onRemoveSettlement(pot.reservationId);
    } else {
      onSettle(pot.reservationId, amt);
    }
  }

  return (
    <div ref={setNodeRef} className={`space-y-1 ${isDragging ? 'opacity-30' : ''}`}>
      {/* Rij 1: label + effectief stortingsbedrag */}
      <div className="flex items-center gap-2">
        <button
          {...listeners}
          {...attributes}
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing text-base leading-none select-none flex-shrink-0"
          aria-label="Versleep spaarpot bijdrage"
        >
          ⠿
        </button>
        <span className="flex-1 text-sm font-medium truncate">{pot.label}</span>
        <input
          type="text"
          inputMode="decimal"
          value={localAmount}
          onChange={(e) => setLocalAmount(e.target.value)}
          onBlur={handleAmountBlur}
          onPointerDown={(e) => e.stopPropagation()}
          className={`w-20 h-6 px-1.5 text-xs text-right tabular-nums rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring ${
            pot.hasSettlement ? 'text-amber-600 font-medium' : 'text-amber-600'
          }`}
          aria-label="Stortingsbedrag"
        />
        <span className="text-xs text-muted-foreground flex-shrink-0">/m</span>
        {pot.hasSettlement && (
          <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0" title="Begroot bedrag">
            ({formatCurrency(pot.monthlyAmount)})
          </span>
        )}
      </div>

      {/* Rij 2: provisie saldo */}
      <div className="pl-5 flex items-center gap-1">
        <span className="text-xs text-muted-foreground">Provisie:</span>
        <span
          className={`text-xs font-medium tabular-nums ${
            pot.potBalance < 0 ? 'text-destructive' : 'text-emerald-600'
          }`}
        >
          {formatCurrency(pot.potBalance)}
          {pot.potBalance < 0 && ' ⚠'}
        </span>
      </div>

      {/* Betalingen deze maand */}
      {pot.paymentsThisMonth.map((payment) => (
        <div key={payment.id} className="pl-5 space-y-0.5">
          <DraggablePayment
            payment={payment}
            currentMonthKey={monthKey}
            onRemove={onRemovePayment}
            onMove={onMovePayment}
          />
          <div className="pl-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Betaald:{' '}
              <span className="tabular-nums">{formatCurrency(payment.invoiceAmount)}</span>
            </span>
            {payment.fromReservation > 0 && (
              <span>
                Uit pot:{' '}
                <span className="tabular-nums text-emerald-600">
                  {formatCurrency(payment.fromReservation)}
                </span>
              </span>
            )}
            {payment.fromCash > 0 && (
              <span>
                Uit cash:{' '}
                <span className="tabular-nums text-destructive">
                  {formatCurrency(payment.fromCash)}
                </span>
              </span>
            )}
          </div>
        </div>
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
  onMovePayment,
  onRemoveReservationDefer,
  onSettleReservation,
  onRemoveReservationSettlement,
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
          onMovePayment={onMovePayment}
          onSettle={onSettleReservation}
          onRemoveSettlement={onRemoveReservationSettlement}
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
