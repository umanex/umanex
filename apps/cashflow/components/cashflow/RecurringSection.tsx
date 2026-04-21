'use client';

import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { RecurringItem, RecurringSettlement, MonthKey } from '../../lib/cashflow/types';
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
  settlements: RecurringSettlement[];
  onRemoveDefer: (deferId: string) => void;
  onSettle: (recurringId: string, paid: boolean, actualAmount: number) => void;
}

function DraggableRecurringItem({
  item,
  monthKey,
  settlement,
  onSettle,
}: {
  item: RecurringItem;
  monthKey: MonthKey;
  settlement: RecurringSettlement | undefined;
  onSettle: (recurringId: string, paid: boolean, actualAmount: number) => void;
}) {
  const budgeted = item.frequency === 'yearly' ? item.amount / 12 : item.amount;
  const isPaid = settlement?.paid ?? false;
  const actualAmount = settlement?.actualAmount ?? budgeted;
  const [localAmount, setLocalAmount] = useState(String(actualAmount));

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recurring-${item.id}-${monthKey}`,
    data: {
      type: 'recurring',
      id: item.id,
      sourceMonth: monthKey,
      label: item.label,
      amount: budgeted,
    },
  });

  function handleCheck(checked: boolean) {
    const amt = parseFloat(localAmount.replace(',', '.'));
    const effective = isNaN(amt) || amt < 0 ? budgeted : amt;
    onSettle(item.id, checked, effective);
  }

  function handleAmountBlur() {
    const amt = parseFloat(localAmount.replace(',', '.'));
    const effective = isNaN(amt) || amt < 0 ? budgeted : amt;
    setLocalAmount(String(effective));
    if (isPaid) onSettle(item.id, true, effective);
  }

  const hasDeviation = isPaid && Math.abs(actualAmount - budgeted) > 0.01;

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

      <input
        type="checkbox"
        checked={isPaid}
        onChange={(e) => handleCheck(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-input accent-primary flex-shrink-0"
        aria-label={`${item.label} betaald`}
      />

      <span className={`flex-1 text-sm truncate ${isPaid ? 'line-through text-muted-foreground' : ''}`}>
        {item.label}
      </span>

      {item.frequency === 'yearly' && (
        <span className="text-xs text-muted-foreground">(jaarlijks)</span>
      )}

      {isPaid ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            value={localAmount}
            onChange={(e) => setLocalAmount(e.target.value)}
            onBlur={handleAmountBlur}
            className="w-20 h-6 px-1.5 text-xs text-right tabular-nums rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Werkelijk bedrag"
          />
          {hasDeviation && (
            <span className="text-xs text-amber-500 tabular-nums" title={`Begroot: ${formatCurrency(budgeted)}`}>
              ({formatCurrency(budgeted)})
            </span>
          )}
        </div>
      ) : (
        <span className="text-sm font-medium text-destructive tabular-nums">
          {formatCurrency(budgeted)}
        </span>
      )}
    </div>
  );
}

export function RecurringSection({
  items,
  monthKey,
  deferredItems,
  settlements,
  onRemoveDefer,
  onSettle,
}: RecurringSectionProps) {
  if (items.length === 0 && deferredItems.length === 0) return null;

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Vaste uitgaven
      </span>
      {items.map((item) => (
        <DraggableRecurringItem
          key={item.id}
          item={item}
          monthKey={monthKey}
          settlement={settlements.find((s) => s.recurringId === item.id)}
          onSettle={onSettle}
        />
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
