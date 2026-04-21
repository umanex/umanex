'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragCancelEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useCashflowStore } from '../../store/cashflow';
import { formatCurrency } from '../../lib/cashflow/recurring';
import type { MonthKey, RecurringDefer, ReservationDefer } from '../../lib/cashflow/types';

interface ActiveItem {
  type: 'income' | 'expense' | 'recurring' | 'reservation-payment' | 'reservation-pot';
  id: string;
  label: string;
  amount: number;
  sourceMonth: MonthKey;
}

interface CashflowDndContextProps {
  children: React.ReactNode;
}

export function CashflowDndContext({ children }: CashflowDndContextProps) {
  const [activeItem, setActiveItem] = useState<ActiveItem | null>(null);

  const updateIncomeItem = useCashflowStore((s) => s.updateIncomeItem);
  const updateExpenseItem = useCashflowStore((s) => s.updateExpenseItem);
  const updateReservationPayment = useCashflowStore((s) => s.updateReservationPayment);
  const addRecurringDefer = useCashflowStore((s) => s.addRecurringDefer);
  const addReservationDefer = useCashflowStore((s) => s.addReservationDefer);
  const recurringItems = useCashflowStore((s) => s.recurringItems);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as ActiveItem | undefined;
    if (data) setActiveItem(data);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const data = active.data.current as ActiveItem | undefined;
    const targetMonthKey = over.data.current?.monthKey as MonthKey | undefined;

    if (!data || !targetMonthKey || data.sourceMonth === targetMonthKey) return;

    if (data.type === 'income') {
      updateIncomeItem(data.id, { monthKey: targetMonthKey });
    } else if (data.type === 'expense') {
      updateExpenseItem(data.id, { monthKey: targetMonthKey });
    } else if (data.type === 'reservation-payment') {
      updateReservationPayment(data.id, { monthKey: targetMonthKey });
    } else if (data.type === 'reservation-pot') {
      const defer: ReservationDefer = {
        id: crypto.randomUUID(),
        reservationId: data.id,
        fromMonth: data.sourceMonth,
        toMonth: targetMonthKey,
      };
      addReservationDefer(defer);
    } else if (data.type === 'recurring') {
      const recurringItem = recurringItems.find((i) => i.id === data.id);
      if (!recurringItem) return;
      const defer: RecurringDefer = {
        id: crypto.randomUUID(),
        recurringId: data.id,
        fromMonth: data.sourceMonth,
        toMonth: targetMonthKey,
      };
      addRecurringDefer(defer);
    }
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveItem(null);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay>
        {activeItem && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background border border-border shadow-lg text-sm font-medium opacity-90">
            <span className="truncate max-w-[140px]">{activeItem.label}</span>
            <span className="tabular-nums">
              {formatCurrency(activeItem.amount)}
              {activeItem.type === 'reservation-pot' ? '/m' : ''}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
