'use client';

import { useCashflowStore } from '../../store/cashflow';
import { useReservationActions } from '../../hooks/useCashflow';
import { generateId, getCurrentMonthKey, formatCurrency } from '../../lib/cashflow/recurring';
import { calcPotBalance } from '../../lib/cashflow/calculator';
import type { ReservationItem, ReservationPayment } from '../../lib/cashflow/types';

interface ReservationSidepanelProps {
  open: boolean;
  onClose: () => void;
}

interface ReservationRowProps {
  reservation: ReservationItem;
  payments: ReservationPayment[];
  onUpdate: (patch: Partial<ReservationItem>) => void;
  onRemove: () => void;
  onRemovePayment: (id: string) => void;
}

function ReservationRow({
  reservation,
  payments,
  onUpdate,
  onRemove,
  onRemovePayment,
}: ReservationRowProps) {
  const currentBalance = calcPotBalance(reservation, payments, getCurrentMonthKey());
  const ownPayments = [...payments.filter((p) => p.reservationId === reservation.id)].sort(
    (a, b) => a.monthKey.localeCompare(b.monthKey),
  );

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-muted/20">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={reservation.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Naam spaarpot"
          className="flex-1 h-8 px-2 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive text-sm px-1 shrink-0"
          aria-label={`Verwijder ${reservation.label}`}
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-muted-foreground">Per maand (€)</label>
          <input
            type="number"
            value={reservation.monthlyAmount === 0 ? '' : reservation.monthlyAmount}
            onChange={(e) => onUpdate({ monthlyAmount: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            min={0}
            step={0.01}
            className="w-28 h-8 px-2 rounded border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-muted-foreground">Vanaf</label>
          <input
            type="month"
            value={reservation.startMonth}
            onChange={(e) => onUpdate({ startMonth: e.target.value })}
            className="h-8 px-2 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-0.5 ml-auto text-right">
          <span className="text-xs text-muted-foreground">Saldo nu</span>
          <span
            className={`text-sm font-semibold tabular-nums ${currentBalance >= 0 ? 'text-teal-600' : 'text-destructive'}`}
          >
            {formatCurrency(currentBalance)}
          </span>
        </div>
      </div>

      {ownPayments.length > 0 && (
        <div className="flex flex-col gap-1 pt-1 border-t border-border">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Betalingen
          </span>
          {ownPayments.map((payment, idx) => {
            const balanceAfter = calcPotBalance(
              reservation,
              ownPayments.slice(0, idx + 1),
              payment.monthKey,
            );
            return (
              <div
                key={payment.id}
                className="flex items-start justify-between gap-2 text-xs group py-0.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">{payment.monthKey}</span>
                    <span className="font-medium truncate">{payment.label}</span>
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {formatCurrency(payment.invoiceAmount)}
                    {payment.fromReservation > 0 && (
                      <span> · pot: {formatCurrency(payment.fromReservation)}</span>
                    )}
                    {payment.fromCash > 0 && (
                      <span> · cash: {formatCurrency(payment.fromCash)}</span>
                    )}
                    <span
                      className={`ml-2 font-medium ${balanceAfter >= 0 ? 'text-teal-600' : 'text-destructive'}`}
                    >
                      → {formatCurrency(balanceAfter)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onRemovePayment(payment.id)}
                  className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                  aria-label={`Verwijder ${payment.label}`}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ReservationSidepanel({ open, onClose }: ReservationSidepanelProps) {
  const reservations = useCashflowStore((s) => s.reservations);
  const reservationPayments = useCashflowStore((s) => s.reservationPayments);
  const {
    addReservation,
    updateReservation,
    removeReservation,
    removeReservationPayment,
  } = useReservationActions();

  function handleAddReservation() {
    addReservation({
      id: generateId(),
      label: '',
      monthlyAmount: 0,
      startMonth: getCurrentMonthKey(),
    });
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Spaarpotten beheren"
        className={`fixed top-0 right-0 h-full w-full sm:w-[460px] bg-background border-l border-border shadow-xl z-50 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold">Spaarpotten</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors"
            aria-label="Sluiten"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          {reservations.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nog geen spaarpotten. Voeg er een toe om maandelijks te reserveren.
            </p>
          )}

          {[...reservations].reverse().map((reservation) => (
            <ReservationRow
              key={reservation.id}
              reservation={reservation}
              payments={reservationPayments}
              onUpdate={(patch) => updateReservation(reservation.id, patch)}
              onRemove={() => removeReservation(reservation.id)}
              onRemovePayment={removeReservationPayment}
            />
          ))}

          <button
            onClick={handleAddReservation}
            className="self-start text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            + Nieuwe spaarpot
          </button>
        </div>
      </div>
    </>
  );
}
