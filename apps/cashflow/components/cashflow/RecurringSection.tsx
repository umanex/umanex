'use client';

import { useDraggable } from '@dnd-kit/core';
import type { RecurringItem, MonthKey } from '../../lib/cashflow/types';
import { formatCurrency, getMonthLabel } from '../../lib/cashflow/recurring';

interface DeferredDisplayItem {
  deferId: string;
  recurringId: string;
  label: string;
  amount: number;
  fromMonth: MonthKey;
}

interface RecurringSectionProps {
  items: RecurringItem[];
  monthKey: MonthKey;
  deferredItems: DeferredDisplayItem[];
  onRemoveDefer: (deferId: string) => void;
}

function DraggableRecurringItem({
  item,
  monthKey,
}: {
  item: RecurringItem;
  monthKey: MonthKey;
}) {
  const amount = item.frequency === 'yearly' ? item.amount / 12 : item.amount;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recurring-${item.id}-${monthKey}`,
    data: {
      type: 'recurring',
      id: item.id,
      sourceMonth: monthKey,
      label: item.label,
      amount,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 py-0.5 ${isDragging ? 'opacity-30' : ''}`}
    >
      <button
        {...listeners}
        {...attributes}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing text-base leading-none select-none"
        aria-label="Versleep"
        tabIndex={0}
      >
        ⠿
      </button>
      <span className="flex-1 text-sm truncate">{item.label}</span>
      {item.frequency === 'yearly' && (
        <span className="text-xs text-muted-foreground">(jaarlijks)</span>
      )}
      <span className="text-sm font-medium text-destructive tabular-nums">
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

export function RecurringSection({
  items,
  monthKey,
  deferredItems,
  onRemoveDefer,
}: RecurringSectionProps) {
  if (items.length === 0 && deferredItems.length === 0) return null;

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Vaste uitgaven
      </span>
      {items.map((item) => (
        <DraggableRecurringItem key={item.id} item={item} monthKey={monthKey} />
      ))}
      {deferredItems.map((d) => (
        <div key={d.deferId} className="flex items-center gap-2 py-0.5">
          <span className="flex-1 text-sm truncate">
            <span className="text-amber-600">{d.label}</span>
            {' '}
            <span className="text-xs text-amber-500">(uitgesteld van {getMonthLabel(d.fromMonth)})</span>
          </span>
          <span className="text-sm font-medium text-destructive tabular-nums">
            {formatCurrency(d.amount)}
          </span>
          <button
            onClick={() => onRemoveDefer(d.deferId)}
            className="text-amber-500 hover:text-amber-700 transition-colors text-sm leading-none"
            aria-label="Uitstelling ongedaan maken"
            title="Ongedaan maken"
          >
            ↩
          </button>
        </div>
      ))}
    </div>
  );
}
