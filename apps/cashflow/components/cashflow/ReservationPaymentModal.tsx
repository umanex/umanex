'use client';

import { useState } from 'react';
import { Button } from '@umanex/ui/components/ui/button';
import { Input } from '@umanex/ui/components/ui/input';
import { Label } from '@umanex/ui/components/ui/label';
import { useCashflowStore } from '../../store/cashflow';
import { useMonths, useReservationActions } from '../../hooks/useCashflow';
import { useDismissOnEscape } from '../../hooks/useDismissOnEscape';
import { calcPotBalance } from '../../lib/cashflow/calculator';
import { generateId, formatAmount } from '../../lib/cashflow/recurring';
import type { MonthKey, ReservationPotType } from '../../lib/cashflow/types';

interface ReservationPaymentModalProps {
  monthKey: MonthKey;
  filterType?: ReservationPotType;
  onClose: () => void;
}

export function ReservationPaymentModal({ monthKey, filterType, onClose }: ReservationPaymentModalProps) {
  useDismissOnEscape(onClose);

  const reservations = useCashflowStore((s) => s.reservations);
  const reservationPayments = useCashflowStore((s) => s.reservationPayments);
  const reservationSettlements = useCashflowStore((s) => s.reservationSettlements);
  const reservationDefers = useCashflowStore((s) => s.reservationDefers);
  const { addReservationPayment } = useReservationActions();

  // De bufferpot staat er bewust niet tussen: hij dekt tekorten automatisch, dus een
  // factuur "uit de buffer" betalen zou hetzelfde geld twee keer inzetten.
  const activeReservations = reservations.filter(
    (r) => r.startMonth <= monthKey && !r.coversDeficit && (!filterType || r.type === filterType),
  );

  const [reservationId, setReservationId] = useState(activeReservations[0]?.id ?? '');
  const [label, setLabel] = useState('');
  const [invoiceStr, setInvoiceStr] = useState('');
  const [fromResStr, setFromResStr] = useState('');
  const [fromCashStr, setFromCashStr] = useState('');
  const [error, setError] = useState('');

  // Potstand uit dezelfde berekening als de maandkaart. Een bufferopname is afgeleid en
  // staat niet in de store, dus calcPotBalance zou hier te veel beschikbaar tonen —
  // enkel als terugval voor een maand buiten het venster.
  const months = useMonths(3);
  const selectedReservation = reservations.find((r) => r.id === reservationId);
  const simulatedPot = months
    .find((m) => m.monthKey === monthKey)
    ?.reservationPots.find((p) => p.reservationId === reservationId);
  const availableSaldo = simulatedPot
    ? simulatedPot.potBalance
    : selectedReservation
      ? calcPotBalance(selectedReservation, reservationPayments, reservationSettlements, monthKey, reservationDefers)
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
    const fromPot = Math.min(inv, Math.max(0, availableSaldo));
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
        `Uit pot (${formatAmount(res)}) + cash (${formatAmount(cash)}) ≠ factuur (${formatAmount(inv)})`,
      );
      return;
    }
    // Meer uit een pot halen dan erin zit, kan niet: de rekenkern zou dat teveel als
    // gewone uitgave moeten boeken en de potstand zou onder nul zakken. Hier tegenhouden
    // is duidelijker dan het achteraf stilzwijgend rechttrekken.
    if (res > Math.max(0, availableSaldo) + 0.01) {
      setError(
        `Uit pot (${formatAmount(res)}) is meer dan er in de pot zit (${formatAmount(Math.max(0, availableSaldo))}). Zet het verschil bij cash.`,
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
        className="absolute inset-0 bg-overlay-scrim"
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
            <Label>Spaarpot</Label>
            {activeReservations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Geen actieve spaarpotten voor {monthKey}.</p>
            ) : (
              <select
                value={reservationId}
                onChange={(e) => { setReservationId(e.target.value); setError(''); }}
                className="h-9"
              >
                {activeReservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label || 'Naamloos'} — beschikbaar {formatAmount(
                      calcPotBalance(r, reservationPayments, reservationSettlements, monthKey, reservationDefers),
                    )}
                  </option>
                ))}
              </select>
            )}
            {selectedReservation && (
              <p className="text-xs text-muted-foreground">
                Beschikbaar saldo: <span className="font-medium tabular-nums">{formatAmount(availableSaldo)}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Omschrijving</Label>
            <Input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Factuur..."
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Factuurbedrag</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={invoiceStr}
                onChange={(e) => syncInvoice(e.target.value)}
                placeholder="0"
                className="h-9 tabular-nums text-right"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Uit pot</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={fromResStr}
                onChange={(e) => syncFromReservation(e.target.value)}
                placeholder="0"
                className="h-9 tabular-nums text-right"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Uit cash</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={fromCashStr}
                onChange={(e) => syncFromCash(e.target.value)}
                placeholder="0"
                className="h-9 tabular-nums text-right"
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="px-4"
          >
            Annuleren
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={activeReservations.length === 0}
            className="px-4"
          >
            Opslaan
          </Button>
        </div>
      </div>
    </div>
  );
}
