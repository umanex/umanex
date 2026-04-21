'use client';

import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { ExpenseItem, MonthKey } from '../../lib/cashflow/types';
import { formatCurrency, generateId } from '../../lib/cashflow/recurring';

interface ExpenseSectionProps {
  monthKey: MonthKey;
  items: ExpenseItem[];
  onAdd: (item: ExpenseItem) => void;
  onUpdate: (id: string, patch: Partial<ExpenseItem>) => void;
  onRemove: (id: string) => void;
}

function DraggableExpenseItem({
  item,
  onUpdate,
  onRemove,
}: {
  item: ExpenseItem;
  onUpdate: (id: string, patch: Partial<ExpenseItem>) => void;
  onRemove: (id: string) => void;
}) {
  const [localAmount, setLocalAmount] = useState(String(item.amount));

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `expense-${item.id}`,
    data: {
      type: 'expense',
      id: item.id,
      sourceMonth: item.monthKey,
      label: item.label,
      amount: item.amount,
    },
  });

  function handleAmountBlur() {
    const parsed = parseFloat(localAmount.replace(',', '.'));
    const effective = isNaN(parsed) || parsed < 0 ? item.amount : parsed;
    setLocalAmount(String(effective));
    if (effective !== item.amount) onUpdate(item.id, { amount: effective });
  }

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
      >
        ⠿
      </button>
      <input
        type="checkbox"
        checked={item.paid}
        onChange={(e) => onUpdate(item.id, { paid: e.target.checked })}
        className="h-3.5 w-3.5 rounded border-input accent-primary flex-shrink-0"
        title="Betaald"
      />
      <span className={`flex-1 text-sm truncate ${item.paid ? 'line-through text-muted-foreground' : ''}`}>
        {item.label}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={localAmount}
        onChange={(e) => setLocalAmount(e.target.value)}
        onBlur={handleAmountBlur}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-20 h-6 px-1.5 text-xs text-right tabular-nums rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label="Bedrag"
      />
      <button
        onClick={() => onRemove(item.id)}
        className="text-muted-foreground hover:text-destructive transition-colors text-xs leading-none"
        aria-label="Verwijder"
      >
        ×
      </button>
    </div>
  );
}

export function ExpenseSection({
  monthKey,
  items,
  onAdd,
  onUpdate,
  onRemove,
}: ExpenseSectionProps) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');

  function handleAdd() {
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!label.trim() || isNaN(parsed) || parsed <= 0) return;
    onAdd({
      id: generateId(),
      monthKey,
      label: label.trim(),
      amount: parsed,
      paid: false,
    });
    setLabel('');
    setAmount('');
    setAdding(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') {
      setAdding(false);
      setLabel('');
      setAmount('');
    }
  }

  if (items.length === 0 && !adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        + Kost toevoegen
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Niet recurrente kosten
        </span>
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-primary hover:text-primary/80 transition-colors"
          aria-label="Kost toevoegen"
        >
          + Toevoegen
        </button>
      </div>

      {items.map((item) => (
        <DraggableExpenseItem
          key={item.id}
          item={item}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}

      {adding && (
        <div className="flex items-center gap-2 pt-1" onKeyDown={handleKeyDown}>
          <input
            autoFocus
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Omschrijving"
            className="flex-1 h-7 px-2 text-sm rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="€"
            className="w-20 h-7 px-2 text-sm rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
          />
          <button onClick={handleAdd} className="text-xs text-primary hover:text-primary/80 font-medium">
            OK
          </button>
          <button
            onClick={() => { setAdding(false); setLabel(''); setAmount(''); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
