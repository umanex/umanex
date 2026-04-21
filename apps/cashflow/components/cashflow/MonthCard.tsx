'use client';

import type { MonthData } from '../../lib/cashflow/types';
import { formatCurrency, getMonthLabel } from '../../lib/cashflow/recurring';
import { IncomeSection } from './IncomeSection';
import { RecurringSection } from './RecurringSection';
import { ReservationSection } from './ReservationSection';
import { BtwSection } from './BtwSection';
import { useCashflowActions } from '../../hooks/useCashflow';

interface MonthCardProps {
  monthData: MonthData;
  onRegisterPayment: () => void;
}

export function MonthCard({ monthData, onRegisterPayment }: MonthCardProps) {
  const {
    addIncomeItem,
    updateIncomeItem,
    removeIncomeItem,
    upsertBtwPayment,
    removeRecurringDefer,
    upsertRecurringSettlement,
  } = useCashflowActions();

  const {
    monthKey,
    startBalance,
    endBalance,
    incomeItems,
    recurringItems,
    reservationPots,
    btwPayment,
    deferredItems,
    recurringSettlements,
  } = monthData;

  const balanceColor = endBalance >= 0 ? 'text-emerald-600' : 'text-destructive';

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 w-full max-w-sm flex-shrink-0">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base">{getMonthLabel(monthKey)}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          start {formatCurrency(startBalance)}
        </span>
      </div>

      <IncomeSection
        monthKey={monthKey}
        items={incomeItems}
        onAdd={addIncomeItem}
        onToggleReceived={(id, received) => updateIncomeItem(id, { received })}
        onRemove={removeIncomeItem}
      />

      <RecurringSection
        items={recurringItems}
        monthKey={monthKey}
        deferredItems={deferredItems}
        settlements={recurringSettlements ?? []}
        onRemoveDefer={removeRecurringDefer}
        onSettle={(recurringId, paid, actualAmount) =>
          upsertRecurringSettlement(recurringId, monthKey, paid, actualAmount)
        }
      />

      <ReservationSection pots={reservationPots} onRegisterPayment={onRegisterPayment} />

      <BtwSection
        monthKey={monthKey}
        btwPayment={btwPayment}
        onUpsert={(amount, paid) => upsertBtwPayment(monthKey, amount, paid)}
      />

      <div className="pt-2 border-t border-border flex items-center justify-between">
        <span className="text-sm font-medium">Eindsaldo</span>
        <span className={`text-lg font-bold tabular-nums ${balanceColor}`}>
          {formatCurrency(endBalance)}
        </span>
      </div>
    </div>
  );
}
