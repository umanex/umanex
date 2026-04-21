'use client';

import { useState } from 'react';
import { useHydrated, useMonths, useCashflowActions } from '../hooks/useCashflow';
import { useCashflowStore } from '../store/cashflow';
import { MonthCard } from '../components/cashflow/MonthCard';
import { CashflowDndContext } from '../components/cashflow/CashflowDndContext';
import { RecurringSidepanel } from '../components/cashflow/RecurringSidepanel';
import { ReservationSidepanel } from '../components/cashflow/ReservationSidepanel';
import { ReservationPaymentModal } from '../components/cashflow/ReservationPaymentModal';
import type { MonthKey } from '../lib/cashflow/types';

function StartBalanceInput() {
  const startBalance = useCashflowStore((s) => s.startBalance);
  const { setStartBalance } = useCashflowActions();
  const [value, setValue] = useState(String(startBalance));

  function handleBlur() {
    const parsed = parseFloat(value.replace(',', '.'));
    if (!isNaN(parsed)) setStartBalance(parsed);
    else setValue(String(startBalance));
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Huidig saldo:</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        className="w-32 h-8 px-3 rounded-md border border-input bg-background text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Huidig saldo"
      />
    </div>
  );
}

export default function Page() {
  const hydrated = useHydrated();
  const months = useMonths(3);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState(false);
  const [paymentMonth, setPaymentMonth] = useState<MonthKey | null>(null);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-muted-foreground text-sm">Laden…</span>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Cashflow prognose</h1>
          <StartBalanceInput />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setRecurringOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors"
          >
            Vaste uitgaven
          </button>
          <button
            onClick={() => setReservationOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors"
          >
            Spaarpotten
          </button>
        </div>
      </header>

      <section>
        <CashflowDndContext>
          <div className="flex gap-5 overflow-x-auto pb-4">
            {months.map((month) => (
              <MonthCard
                key={month.monthKey}
                monthData={month}
                onRegisterPayment={() => setPaymentMonth(month.monthKey)}
              />
            ))}
          </div>
        </CashflowDndContext>
      </section>

      <RecurringSidepanel open={recurringOpen} onClose={() => setRecurringOpen(false)} />
      <ReservationSidepanel open={reservationOpen} onClose={() => setReservationOpen(false)} />
      {paymentMonth && (
        <ReservationPaymentModal
          monthKey={paymentMonth}
          onClose={() => setPaymentMonth(null)}
        />
      )}
    </main>
  );
}
