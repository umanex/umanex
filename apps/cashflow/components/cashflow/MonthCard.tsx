'use client';

import { useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { MonthData } from '../../lib/cashflow/types';
import { formatCurrency, getMonthLabel } from '../../lib/cashflow/recurring';
import { IncomeSection } from './IncomeSection';
import { RecurringSection } from './RecurringSection';
import { ReservationSection } from './ReservationSection';
import { ExpenseSection } from './ExpenseSection';
import { useCashflowActions, useReservationActions } from '../../hooks/useCashflow';
import { useCashflowStore } from '../../store/cashflow';

function StartBalanceInput() {
  const stored = useCashflowStore((s) => s.startBalance);
  const { setStartBalance } = useCashflowActions();
  const [local, setLocal] = useState(String(stored));

  // Sync als store extern wijzigt (rehydratie)
  useEffect(() => { setLocal(String(stored)); }, [stored]);

  function handleBlur() {
    const parsed = parseFloat(local.replace(',', '.'));
    if (!isNaN(parsed)) setStartBalance(parsed);
    else setLocal(String(stored));
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Huidig saldo:</span>
      <input
        type="text"
        inputMode="decimal"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleBlur}
        className="w-28 h-6 px-2 text-xs tabular-nums text-right rounded border border-input
          bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label="Huidig saldo"
      />
    </div>
  );
}

interface MonthCardProps {
  monthData: MonthData;
  onRegisterPayment: () => void;
  isFirst?: boolean;
}

export function MonthCard({ monthData, onRegisterPayment, isFirst }: MonthCardProps) {
  const {
    addIncomeItem,
    updateIncomeItem,
    removeIncomeItem,
    removeRecurringDefer,
    upsertRecurringSettlement,
    addExpenseItem,
    updateExpenseItem,
    removeExpenseItem,
    removeReservationDefer,
    upsertReservationSettlement,
    removeReservationSettlement,
  } = useCashflowActions();

  const { removeReservationPayment, updateReservationPayment } = useReservationActions();

  const {
    monthKey,
    startBalance,
    endBalance,
    availableBudget,
    totalOutstandingCosts,
    incomeItems,
    recurringItems,
    reservationPots,
    deferredReservationItems,
    deferredItems,
    recurringSettlements,
    expenseItems,
  } = monthData;

  const { setNodeRef, isOver } = useDroppable({
    id: `month-${monthKey}`,
    data: { monthKey },
  });

  const balanceColor = endBalance >= 0 ? 'text-emerald-600' : 'text-destructive';

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border bg-card p-5 space-y-4 transition-colors ${
        isOver ? 'border-primary ring-2 ring-primary/30' : 'border-border'
      }`}
    >
      {/* Header: maandnaam + eindsaldo rechts */}
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-semibold text-base">{getMonthLabel(monthKey)}</h2>
        <span className={`text-base font-bold tabular-nums ${balanceColor}`}>
          {formatCurrency(endBalance)}
        </span>
      </div>

      {/* Saldo: editeerbaar in eerste maand, read-only in volgende maanden */}
      {isFirst ? (
        <StartBalanceInput />
      ) : (
        <p className="text-xs text-muted-foreground">
          Startsaldo:{' '}
          <span className="tabular-nums font-medium text-foreground">
            {formatCurrency(startBalance)}
          </span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-xs text-muted-foreground mb-0.5">Beschikbaar</p>
          <p className="text-sm font-semibold tabular-nums text-emerald-600">
            {formatCurrency(availableBudget)}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-xs text-muted-foreground mb-0.5">Openstaand</p>
          <p className="text-sm font-semibold tabular-nums text-destructive">
            {formatCurrency(totalOutstandingCosts)}
          </p>
        </div>
      </div>

      <IncomeSection
        monthKey={monthKey}
        items={incomeItems}
        onAdd={addIncomeItem}
        onUpdate={(id, patch) => updateIncomeItem(id, patch)}
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

      <ExpenseSection
        monthKey={monthKey}
        items={expenseItems}
        onAdd={addExpenseItem}
        onUpdate={(id, patch) => updateExpenseItem(id, patch)}
        onRemove={removeExpenseItem}
      />

      <ReservationSection
        monthKey={monthKey}
        pots={reservationPots}
        deferredReservationItems={deferredReservationItems}
        onRegisterPayment={onRegisterPayment}
        onRemovePayment={removeReservationPayment}
        onMovePayment={(id, newMonthKey) => updateReservationPayment(id, { monthKey: newMonthKey })}
        onRemoveReservationDefer={removeReservationDefer}
        onSettleReservation={(reservationId, effectiveAmount) =>
          upsertReservationSettlement(reservationId, monthKey, effectiveAmount)
        }
        onRemoveReservationSettlement={(reservationId) =>
          removeReservationSettlement(reservationId, monthKey)
        }
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
