'use client';

import { useHydrated, useMonths } from '../hooks/useCashflow';
import { CashflowDndContext } from '../components/cashflow/CashflowDndContext';
import { MonthCard } from '../components/cashflow/MonthCard';
import { AddItemForm } from '../components/cashflow/AddItemForm';
import { AddBtwForm } from '../components/cashflow/AddBtwForm';
import { StartBalanceInput } from '../components/cashflow/StartBalanceInput';
import { ItemList } from '../components/cashflow/ItemList';
import { BtwList } from '../components/cashflow/BtwList';

export default function Page() {
  const hydrated = useHydrated();
  const months = useMonths(12);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-muted-foreground text-sm">Laden…</span>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Cashflow prognose</h1>
        <StartBalanceInput />
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Terugkerende posten</h2>
        <ItemList />
        <AddItemForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">BTW betalingen</h2>
        <BtwList />
        <AddBtwForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Maandoverzicht</h2>
        <CashflowDndContext>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {months.map((month) => (
              <MonthCard key={month.monthKey} month={month} />
            ))}
          </div>
        </CashflowDndContext>
      </section>
    </main>
  );
}
