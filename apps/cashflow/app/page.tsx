'use client';

import { useState } from 'react';
import { useMonths } from '../hooks/useCashflow';
import { MonthCard } from '../components/cashflow/MonthCard';
import { CashflowDndContext } from '../components/cashflow/CashflowDndContext';
import { RecurringSidepanel } from '../components/cashflow/RecurringSidepanel';
import { ReservationSidepanel } from '../components/cashflow/ReservationSidepanel';
import { ReservationPaymentModal } from '../components/cashflow/ReservationPaymentModal';
import type { MonthKey } from '../lib/cashflow/types';

export default function Page() {
  const months = useMonths(3);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState(false);
  const [paymentMonth, setPaymentMonth] = useState<MonthKey | null>(null);

  return (
    <main className="min-h-screen bg-background px-4 py-8 space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Cashflow prognose</h1>
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
          <div className="grid grid-cols-3 gap-5">
            {months.map((month, index) => (
              <MonthCard
                key={month.monthKey}
                monthData={month}
                isFirst={index === 0}
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
