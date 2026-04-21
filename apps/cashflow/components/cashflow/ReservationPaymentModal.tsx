'use client';

import { useState } from 'react';
import { useCashflowStore } from '../../store/cashflow';
import { useReservationActions } from '../../hooks/useCashflow';
import { calcPotBalance } from '../../lib/cashflow/calculator';
import { generateId, formatCurrency } from '../../lib/cashflow/recurring';
import type { MonthKey } from '../../lib/cashflow/types';

interface ReservationPaymentModalProps {
  monthKey: MonthKey;
  onClose: () => void;
}

export function ReservationPaymentModal({ monthKey, onClose }: ReservationPaymentModalProps) {
  const reservations = useCashflowStore((s) => s.reservations);
  const reservationPayments = useCashflowStore((s) => s.reservationPayments);
  const reservationSettlements = useCashflowStore((s) => s.reservationSettlements);
  const { addReservationPayment } = useReservationActions();

  const activeReservations = reservations.filter((r) => r.startMonth <= monthKey);

  const [reservationId, setReservationId] = useState(activeReservations[0]?.id ?? '');
  const [label, setLabel] = useState('');
  const [invoiceStr, setInvoiceStr] = useState('');
  const [fromResStr, setFromResStr] = useState('');
  const [fromCashStr, setFromCashStr] = useState('');
  const [error, setError] = useState('');

  const selectedReservation = reservations.find((r) => r.id === reservationId);
  const availableSaldo = selectedReservation
    ? calcPotBalance(selectedReservation, reservationPayments, reservationSettlements, monthKey)
    : 0;

  function syncFromReservation(value: string) {
    setFromResStr(value);
    setError('');
    const inv = parseFloat(invoiceStr.replace(',', '.')) || 0;
    const res = parseFloat(value.replace(',', '.')) || 0;
    setFromCashStr(String(Math.max(0, inv - res)));
  }

  function syncFromCash(value: string) {
    setFromCashStr(value);
    setError('');
    const inv = parseFloat(invoiceStr.replace(',', '.')) || 0;
    const cash = parseFloat(value.replace(',', '.')) || 0;
    setFromResStr(String(Math.max(0, inv - cash)));
  }

  function syncInvoice(value: string) {
    setInvoiceStr(value);
    setError('');
    const inv = parseFloat(value.replace(',', '.')) || 0;
    const fromPot = Math.min(inv, availableSaldo);
    setFromResStr(String(fromPot));
    setFromCashStr(String(Math.max(0, inv - fromPot)));
  }

  function handleSave() {
    if (!reservationId) { setError('Kies een spaarpot.'); return; }
    const inv = parseFloat(invoiceStr.replace(',', '.'));
    const res = parseFloat(fromResStr.replace(',', '.')) || 0;
    const cash = parseFloat(fromCashStr.replace(',', '.')) || 0;

    if (isNaN(inv) || inv <= 0) { setError('Geldig factuurbedrag vereist.'); return; }
    if (Math.abs(res + cash - inv) > 0.01) {
      setError(
        `Uit pot (${formatCurrency(res)}) + cash (${formatCurrency(cash)}) ≠ factuur (${formatCurrency(inv)})`,
      );
      return;
    }

    addReservationPayment({
      id: generateId(),
      reservationId,
      monthKey,
      label: label.trim() || 'Betaling',
      invoiceAmount: inv,
      fromReservation: res,
      fromCash: cash,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-label="Betaling registreren"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content — boven de backdrop */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Betaling registreren</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors"
            aria-label="Sluiten"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Spaarpot</label>
            {activeReservations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Geen actieve spaarpotten voor {monthKey}.</p>
            ) : (
              <select
                value={reservationId}
                onChange={(e) => { setReservationId(e.target.value); setError(''); }}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {activeReservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label || 'Naamloos'} — beschikbaar {formatCurrency(
                      calcPotBalance(r, reservationPayments, reservationSettlements, monthKey),
                    )}
                  </option>
                ))}
              </select>
            )}
            {selectedReservation && (
              <p className="text-xs text-muted-foreground">
                Beschikbaar saldo: <span className="font-medium tabular-nums">{formatCurrency(availableSaldo)}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Omschrijving</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Factuur..."
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Factuurbedrag</label>
              <input
                type="text"
                inputMode="decimal"
                value={invoiceStr}
                onChange={(e) => syncInvoice(e.target.value)}
                placeholder="0"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Uit pot</label>
              <input
                type="text"
                inputMode="decimal"
                value={fromResStr}
                onChange={(e) => syncFromReservation(e.target.value)}
                placeholder="0"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Uit cash</label>
              <input
                type="text"
                inputMode="decimal"
                value={fromCashStr}
                onChange={(e) => syncFromCash(e.target.value)}
                placeholder="0"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-md border border-input text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={activeReservations.length === 0}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}
