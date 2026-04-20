'use client';

import type { MonthData, RecurringItem } from '../../lib/cashflow/types';
import { MonthHeader } from './MonthHeader';
import { BtwRow } from './BtwRow';
import { MonthSummary } from './MonthSummary';
import { ReservationPotCard } from './ReservationPotCard';
import { useCashflowActions } from '../../hooks/useCashflow';
import { formatCurrency } from '../../lib/cashflow/recurring';

interface MonthCardProps {
  month: MonthData;
}

function ReadOnlyItemRow({ item }: { item: RecurringItem }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 px-2 text-sm">
      <span className="flex-1 truncate text-foreground/80">
        {item.label || <span className="italic text-muted-foreground">Naamloos</span>}
      </span>
      <span
        className={`tabular-nums shrink-0 ${item.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}
      >
        {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
      </span>
    </div>
  );
}

function ReadOnlyYearlyRow({ item }: { item: RecurringItem }) {
  const monthly = Math.round(item.amount / 12);
  return (
    <div className="flex items-center justify-between gap-2 py-1 px-2 text-sm">
      <span className="flex-1 truncate text-muted-foreground">
        {item.label || <span className="italic">Naamloos</span>}
      </span>
      <span className="tabular-nums text-muted-foreground shrink-0">
        -{formatCurrency(monthly)}/m <span className="text-xs">(reservering)</span>
      </span>
    </div>
  );
}

export function MonthCard({ month }: MonthCardProps) {
  const { updateBtwPayment } = useCashflowActions();

  const hasItems =
    month.incomeItems.length > 0 ||
    month.expenseItems.length > 0 ||
    month.yearlyItems.length > 0 ||
    month.btwPayments.length > 0;

  return (
    <div className="flex flex-col min-w-[260px] w-[260px] rounded-lg border border-border bg-card shadow-sm">
      <MonthHeader monthKey={month.monthKey} endBalance={month.endBalance} />

      <div className="flex flex-col gap-0.5 px-1 py-2 flex-1">
        {month.incomeItems.map((item) => (
          <ReadOnlyItemRow key={item.id} item={item} />
        ))}
        {month.expenseItems.map((item) => (
          <ReadOnlyItemRow key={item.id} item={item} />
        ))}
        {month.yearlyItems.map((item) => (
          <ReadOnlyYearlyRow key={item.id} item={item} />
        ))}
        {month.btwPayments.map((payment) => (
          <BtwRow
            key={payment.id}
            payment={payment}
            onMarkPaid={(id) => updateBtwPayment(id, { paid: true })}
          />
        ))}
        {!hasItems && month.reservationPots.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-1">Geen posten deze maand.</p>
        )}
      </div>

      {month.reservationPots.length > 0 && (
        <div className="px-1 pb-2 flex flex-col gap-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-1">
            Spaarpotten
          </p>
          {month.reservationPots.map((pot) => (
            <ReservationPotCard key={pot.reservationId} pot={pot} />
          ))}
        </div>
      )}

      <MonthSummary
        startBalance={month.startBalance}
        totalIncome={month.totalIncome}
        totalExpenses={month.totalExpenses}
        yearlyReservation={month.yearlyReservation}
        btwAmount={month.btwAmount}
        reservationDeductions={month.reservationDeductions}
        reservationPaymentsCash={month.reservationPaymentsCash}
        endBalance={month.endBalance}
      />
    </div>
  );
}
