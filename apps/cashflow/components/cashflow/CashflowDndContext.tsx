'use client';

import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { useCashflowStore } from '../../store/cashflow';
import { useCashflowActions } from '../../hooks/useCashflow';
import type { RecurringItem } from '../../lib/cashflow/types';
import { ItemRow } from './ItemRow';

interface CashflowDndContextProps {
  children: React.ReactNode;
}

export function CashflowDndContext({ children }: CashflowDndContextProps) {
  const items = useCashflowStore((s) => s.items);
  const { updateItem } = useCashflowActions();
  const [activeItem, setActiveItem] = useState<RecurringItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    const found = items.find((i) => i.id === event.active.id);
    setActiveItem(found ?? null);
  }

  function handleDragOver(_event: DragOverEvent) {
    // Items are moved between months on DragEnd; over is handled by droppable highlights
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);
    if (!over) return;

    const itemId = String(active.id);
    const overId = String(over.id);

    // over.id is either a MonthKey (drop onto month column) or another item.id
    const isMonthKey = /^\d{4}-\d{2}$/.test(overId);
    if (isMonthKey) {
      updateItem(itemId, { startMonth: overId });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay>
        {activeItem ? <ItemRow item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
