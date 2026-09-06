'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMonths, useEarliestDataMonth, useCashflowActions, useAutoCloseMonth } from '../hooks/useCashflow';
import { useCashflowStore } from '../store/cashflow';
import { getCurrentMonthKey } from '../lib/cashflow/recurring';
import { buildSnapshot } from '../lib/cashflow/snapshot';
import { bufferSummary } from '../lib/cashflow/buffer';
import { MonthCard } from '../components/cashflow/MonthCard';
import { CashflowDndContext } from '../components/cashflow/CashflowDndContext';
import { RecurringSidepanel } from '../components/cashflow/RecurringSidepanel';
import { ReservationSidepanel } from '../components/cashflow/ReservationSidepanel';
import { ReservationPaymentModal } from '../components/cashflow/ReservationPaymentModal';
import { RepeatMonthModal } from '../components/cashflow/RepeatMonthModal';
import { MonthNavigator } from '../components/cashflow/MonthNavigator';
import { SyncStatus } from '../components/feedback/SyncStatus';
import { SignOutButton } from '../components/auth/SignOutButton';
import type { MonthKey, ReservationPotType } from '../lib/cashflow/types';

export default function Page() {
  // DataGate laat deze pagina pas monteren als de stand uit Supabase geladen is, dus
  // hier is er geen tussenstand meer waarin de cijfers nog nul zouden zijn.
  const months = useMonths(3);
  const anchorMonth = useCashflowStore((s) => s.anchorMonth);
  const { setAnchorMonth, closeMonth, reopenMonth } = useCashflowActions();
  const monthSnapshots = useCashflowStore((s) => s.monthSnapshots);
  useAutoCloseMonth();
  const earliestMonth = useEarliestDataMonth();
  // Een voorbije maand is nog geen historie: zolang er geen snapshot is, wordt hij
  // opnieuw doorgerekend uit de huidige gegevens. Dat moet zichtbaar zijn.
  const currentMonth = getCurrentMonthKey();
  // Gelijk voor alle kolommen: anders staan de drie footers niet meer op één lijn.
  const bufferSummaries = months.map(bufferSummary);
  const hasBuffer = bufferSummaries.some((b) => b.present);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState(false);
  const [paymentState, setPaymentState] = useState<{ monthKey: MonthKey; filterType: ReservationPotType } | null>(null);
  const [repeatMonth, setRepeatMonth] = useState<MonthKey | null>(null);

  return (
    <main className="min-h-screen bg-background px-4 py-8 space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Cashflow prognose</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <SyncStatus />
          <MonthNavigator
            anchorMonth={anchorMonth}
            earliestMonth={earliestMonth}
            currentMonth={currentMonth}
            monthCount={3}
            onNavigate={setAnchorMonth}
          />
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
          <Link
            href="/analyse"
            className="inline-flex items-center h-9 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors"
          >
            Analyse
          </Link>
          <SignOutButton />
        </div>
      </header>

      {/* Vaste hoogte: elke kolom scrollt binnen zichzelf, zodat de drie saldo-footers
          op één horizontale lijn blijven staan. */}
      <section className="h-[calc(100vh-11rem)] min-h-[24rem]">
        <CashflowDndContext>
          <div className="grid grid-cols-3 gap-5 h-full">
            {months.map((month, index) => (
              <MonthCard
                key={month.monthKey}
                monthData={month}
                isFirst={index === 0}
                hasBuffer={hasBuffer}
                isReconstruction={month.monthKey < currentMonth}
                locked={monthSnapshots.some((s) => s.monthKey === month.monthKey)}
                onCloseMonth={
                  month.monthKey < currentMonth && month.monthKey >= earliestMonth
                    ? () => closeMonth(buildSnapshot(month, new Date().toISOString()))
                    : undefined
                }
                onReopenMonth={() => reopenMonth(month.monthKey)}
                onRegisterPayment={(filterType) => setPaymentState({ monthKey: month.monthKey, filterType })}
                onOpenRecurringSidepanel={() => setRecurringOpen(true)}
                onRepeatMonth={() => setRepeatMonth(month.monthKey)}
              />
            ))}
          </div>
        </CashflowDndContext>
      </section>

      <RecurringSidepanel open={recurringOpen} onClose={() => setRecurringOpen(false)} />
      <ReservationSidepanel open={reservationOpen} onClose={() => setReservationOpen(false)} />
      {repeatMonth && (
        <RepeatMonthModal monthKey={repeatMonth} onClose={() => setRepeatMonth(null)} />
      )}
      {paymentState && (
        <ReservationPaymentModal
          monthKey={paymentState.monthKey}
          filterType={paymentState.filterType}
          onClose={() => setPaymentState(null)}
        />
      )}
    </main>
  );
}
