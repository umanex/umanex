'use client';

import { useDroppable } from '@dnd-kit/core';
import type { MonthData } from '../../lib/cashflow/types';
import { formatCurrency, getMonthLabel } from '../../lib/cashflow/recurring';
import { IncomeSection } from './IncomeSection';
import { RecurringSection } from './RecurringSection';
import { ReservationSection } from './ReservationSection';
import { BtwSection } from './BtwSection';
import { useCashflowActions } from '../../hooks/useCashflow';
import { useReservationActions } from '../../hooks/useCashflow';

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

  const { removeReservationPayment } = useReservationActions();

  const {
    monthKey,
    startBalance,
    endBalance,
    availableBudget,
    totalOutstandingCosts,
    incomeItems,
    recurringItems,
    reservationPots,
    btwPayment,
    deferredItems,
    recurringSettlements,
  } = monthData;

  const { setNodeRef, isOver } = useDroppable({
    id: `month-${monthKey}`,
    data: { monthKey },
  });

  const balanceColor = endBalance >= 0 ? 'text-emerald-600' : 'text-destructive';

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border bg-card p-5 space-y-4 w-full max-w-sm flex-shrink-0 transition-colors ${
        isOver ? 'border-primary ring-2 ring-primary/30' : 'border-border'
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base">{getMonthLabel(monthKey)}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          start {formatCurrency(startBalance)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-xs text-muted-foreground mb-0.5">Beschikbaar</p>
          <p className="text-sm font-semibold tabular-nums text-emerald-600">
            {formatCurrency(availableBudget)}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-xs text-muted-foreground mb-0.5">Totale kosten</p>
          <p className="text-sm font-semibold tabular-nums text-destructive">
            {formatCurrency(totalOutstandingCosts)}
          </p>
        </div>
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

      <ReservationSection
        pots={reservationPots}
        onRegisterPayment={onRegisterPayment}
        onRemovePayment={removeReservationPayment}
      />

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
