'use client';

import { useState } from 'react';
import { useCashflowStore } from '../../store/cashflow';
import { useReservationActions } from '../../hooks/useCashflow';
import { generateId, getCurrentMonthKey, formatCurrency } from '../../lib/cashflow/recurring';
import { calcPotBalance } from '../../lib/cashflow/calculator';
import type { ReservationItem, ReservationPayment } from '../../lib/cashflow/types';

interface ReservationSidepanelProps {
  open: boolean;
  onClose: () => void;
}

interface PaymentForm {
  monthKey: string;
  label: string;
  invoiceAmount: string;
  fromReservation: string;
  fromCash: string;
}

const emptyPaymentForm = (): PaymentForm => ({
  monthKey: getCurrentMonthKey(),
  label: '',
  invoiceAmount: '',
  fromReservation: '',
  fromCash: '',
});

interface ReservationRowProps {
  reservation: ReservationItem;
  payments: ReservationPayment[];
  onUpdate: (patch: Partial<ReservationItem>) => void;
  onRemove: () => void;
  onAddPayment: (payment: ReservationPayment) => void;
  onRemovePayment: (id: string) => void;
}

function ReservationRow({
  reservation,
  payments,
  onUpdate,
  onRemove,
  onAddPayment,
  onRemovePayment,
}: ReservationRowProps) {
  const currentBalance = calcPotBalance(reservation, payments, getCurrentMonthKey());
  const ownPayments = payments.filter((p) => p.reservationId === reservation.id);
  const [paymentsOpen, setPaymentsOpen] = useState(ownPayments.length > 0);
  const [form, setForm] = useState<PaymentForm | null>(null);
  const [formError, setFormError] = useState('');

  function openForm() {
    setForm(emptyPaymentForm());
    setFormError('');
    setPaymentsOpen(true);
  }

  function updateForm(patch: Partial<PaymentForm>) {
    setForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };

      // Auto-sync fromCash when fromReservation changes
      if ('fromReservation' in patch) {
        const inv = parseFloat(next.invoiceAmount.replace(',', '.')) || 0;
        const res = parseFloat(next.fromReservation.replace(',', '.')) || 0;
        next.fromCash = String(Math.max(0, inv - res));
      }
      // Auto-sync fromReservation when fromCash changes
      if ('fromCash' in patch) {
        const inv = parseFloat(next.invoiceAmount.replace(',', '.')) || 0;
        const cash = parseFloat(next.fromCash.replace(',', '.')) || 0;
        next.fromReservation = String(Math.max(0, inv - cash));
      }
      // When invoice changes, update fromCash keeping fromReservation fixed
      if ('invoiceAmount' in patch) {
        const inv = parseFloat(next.invoiceAmount.replace(',', '.')) || 0;
        const res = parseFloat(next.fromReservation.replace(',', '.')) || 0;
        next.fromCash = String(Math.max(0, inv - res));
      }
      return next;
    });
    setFormError('');
  }

  function handleSavePayment() {
    if (!form) return;
    const inv = parseFloat(form.invoiceAmount.replace(',', '.'));
    const res = parseFloat(form.fromReservation.replace(',', '.')) || 0;
    const cash = parseFloat(form.fromCash.replace(',', '.')) || 0;

    if (!form.monthKey) { setFormError('Kies een maand.'); return; }
    if (isNaN(inv) || inv <= 0) { setFormError('Geldig factuurbedrag vereist.'); return; }
    if (Math.abs(res + cash - inv) > 0.01) {
      setFormError(`Uit pot (${formatCurrency(res)}) + Uit cash (${formatCurrency(cash)}) moet gelijk zijn aan factuurbedrag (${formatCurrency(inv)}).`);
      return;
    }

    onAddPayment({
      id: generateId(),
      reservationId: reservation.id,
      monthKey: form.monthKey,
      invoiceAmount: inv,
      fromReservation: res,
      fromCash: cash,
      label: form.label.trim() || 'Betaling',
    });
    setForm(null);
    setFormError('');
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-muted/20">
      {/* Reservation header */}
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

      {/* Amount + start month */}
      <div className="flex items-center gap-2 flex-wrap">
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
          <label className="text-xs text-muted-foreground">Vanaf maand</label>
          <input
            type="month"
            value={reservation.startMonth}
            onChange={(e) => onUpdate({ startMonth: e.target.value })}
            className="h-8 px-2 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-0.5 ml-auto text-right">
          <span className="text-xs text-muted-foreground">Huidig saldo</span>
          <span
            className={`text-sm font-semibold tabular-nums ${currentBalance >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-destructive'}`}
          >
            {formatCurrency(currentBalance)}
          </span>
        </div>
      </div>

      {/* Payments section */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setPaymentsOpen((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>{paymentsOpen ? '▾' : '▸'}</span>
          Betalingen ({ownPayments.length})
        </button>

        {paymentsOpen && (
          <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-border">
            {ownPayments.length === 0 && form === null && (
              <p className="text-xs text-muted-foreground">Nog geen betalingen.</p>
            )}

            {ownPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-xs group">
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate block">{p.label}</span>
                  <span className="text-muted-foreground">{p.monthKey} · {formatCurrency(p.invoiceAmount)}</span>
                  <span className="text-muted-foreground"> · pot: {formatCurrency(p.fromReservation)} · cash: {formatCurrency(p.fromCash)}</span>
                </div>
                <button
                  onClick={() => onRemovePayment(p.id)}
                  className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  aria-label={`Verwijder ${p.label}`}
                >
                  ✕
                </button>
              </div>
            ))}

            {form !== null ? (
              <div className="flex flex-col gap-2 p-2 rounded border border-border bg-background">
                <div className="flex gap-2 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-xs text-muted-foreground">Maand</label>
                    <input
                      type="month"
                      value={form.monthKey}
                      onChange={(e) => updateForm({ monthKey: e.target.value })}
                      className="h-8 px-2 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
                    <label className="text-xs text-muted-foreground">Omschrijving</label>
                    <input
                      type="text"
                      value={form.label}
                      onChange={(e) => updateForm({ label: e.target.value })}
                      placeholder="Factuur..."
                      className="h-8 px-2 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-xs text-muted-foreground">Factuurbedrag (€)</label>
                    <input
                      type="number"
                      value={form.invoiceAmount}
                      onChange={(e) => updateForm({ invoiceAmount: e.target.value })}
                      placeholder="0"
                      min={0}
                      step={0.01}
                      className="w-24 h-8 px-2 rounded border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-xs text-muted-foreground">Uit pot (€)</label>
                    <input
                      type="number"
                      value={form.fromReservation}
                      onChange={(e) => updateForm({ fromReservation: e.target.value })}
                      placeholder="0"
                      min={0}
                      step={0.01}
                      className="w-24 h-8 px-2 rounded border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-xs text-muted-foreground">Uit cash (€)</label>
                    <input
                      type="number"
                      value={form.fromCash}
                      onChange={(e) => updateForm({ fromCash: e.target.value })}
                      placeholder="0"
                      min={0}
                      step={0.01}
                      className="w-24 h-8 px-2 rounded border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                {formError && (
                  <p className="text-xs text-destructive">{formError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleSavePayment}
                    className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    Opslaan
                  </button>
                  <button
                    onClick={() => { setForm(null); setFormError(''); }}
                    className="h-8 px-3 rounded border border-input text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Annuleren
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={openForm}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
              >
                + Betaling toevoegen
              </button>
            )}
          </div>
        )}
      </div>
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
    addReservationPayment,
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
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-background border-l border-border shadow-xl z-50 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
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
              Nog geen spaarpotten. Voeg er een toe om maandelijks te reserveren voor een toekomstige kost.
            </p>
          )}

          {[...reservations].reverse().map((reservation) => (
            <ReservationRow
              key={reservation.id}
              reservation={reservation}
              payments={reservationPayments}
              onUpdate={(patch) => updateReservation(reservation.id, patch)}
              onRemove={() => removeReservation(reservation.id)}
              onAddPayment={addReservationPayment}
              onRemovePayment={removeReservationPayment}
            />
          ))}

          <button
            onClick={handleAddReservation}
            className="self-start text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 transition-colors"
          >
            + Nieuwe spaarpot
          </button>
        </div>
      </div>
    </>
  );
}
