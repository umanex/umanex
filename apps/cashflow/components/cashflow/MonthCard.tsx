'use client';

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import type { MonthData } from '../../lib/cashflow/types';
import { MonthHeader } from './MonthHeader';
import { ItemRow } from './ItemRow';
import { BtwRow } from './BtwRow';
import { YearlyRow } from './YearlyRow';
import { MonthSummary } from './MonthSummary';
import { useCashflowActions } from '../../hooks/useCashflow';

interface MonthCardProps {
  month: MonthData;
}

export function MonthCard({ month }: MonthCardProps) {
  const { updateBtwPayment } = useCashflowActions();
  const { setNodeRef, isOver } = useDroppable({ id: month.monthKey });

  const allDraggableItems = [...month.incomeItems, ...month.expenseItems];

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[260px] w-[260px] rounded-lg border border-border bg-card shadow-sm transition-colors ${isOver ? 'ring-2 ring-primary/40 bg-primary/5' : ''}`}
    >
      <MonthHeader monthKey={month.monthKey} endBalance={month.endBalance} />

      <div className="flex flex-col gap-1 px-1 py-2 flex-1">
        <SortableContext
          items={allDraggableItems.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {allDraggableItems.map((item) => (
            <ItemRow key={item.id} item={item} draggable />
          ))}
        </SortableContext>

        {month.yearlyItems.map((item) => (
          <YearlyRow key={item.id} item={item} />
        ))}

        {month.btwPayments.map((payment) => (
          <BtwRow
            key={payment.id}
            payment={payment}
            onMarkPaid={(id) => updateBtwPayment(id, { paid: true })}
          />
        ))}
      </div>

      <MonthSummary
        startBalance={month.startBalance}
        totalIncome={month.totalIncome}
        totalExpenses={month.totalExpenses}
        yearlyReservation={month.yearlyReservation}
        btwAmount={month.btwAmount}
        endBalance={month.endBalance}
      />
    </div>
  );
}
