'use client';

import { useState } from 'react';
import { useHydrated, useMonths } from '../hooks/useCashflow';
import { MonthCard } from '../components/cashflow/MonthCard';
import { AddBtwForm } from '../components/cashflow/AddBtwForm';
import { StartBalanceInput } from '../components/cashflow/StartBalanceInput';
import { BtwList } from '../components/cashflow/BtwList';
import { RecurringSidepanel } from '../components/cashflow/RecurringSidepanel';
import { RecurringTriggerButton } from '../components/cashflow/RecurringTriggerButton';
import { ReservationSidepanel } from '../components/cashflow/ReservationSidepanel';
import { ReservationTriggerButton } from '../components/cashflow/ReservationTriggerButton';

export default function Page() {
  const hydrated = useHydrated();
  const months = useMonths(12);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState(false);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-muted-foreground text-sm">Laden…</span>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Cashflow prognose</h1>
          <StartBalanceInput />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <RecurringTriggerButton onClick={() => setRecurringOpen(true)} />
          <ReservationTriggerButton onClick={() => setReservationOpen(true)} />
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">BTW betalingen</h2>
        <BtwList />
        <AddBtwForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Maandoverzicht</h2>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {months.map((month) => (
            <MonthCard key={month.monthKey} month={month} />
          ))}
        </div>
      </section>

      <RecurringSidepanel
        open={recurringOpen}
        onClose={() => setRecurringOpen(false)}
      />
      <ReservationSidepanel
        open={reservationOpen}
        onClose={() => setReservationOpen(false)}
      />
    </main>
  );
}
