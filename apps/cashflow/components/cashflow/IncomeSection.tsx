'use client';

import { useState } from 'react';
import type { IncomeItem, MonthKey } from '../../lib/cashflow/types';
import { formatCurrency, generateId } from '../../lib/cashflow/recurring';

interface IncomeSectionProps {
  monthKey: MonthKey;
  items: IncomeItem[];
  onAdd: (item: IncomeItem) => void;
  onToggleReceived: (id: string, received: boolean) => void;
  onRemove: (id: string) => void;
}

export function IncomeSection({
  monthKey,
  items,
  onAdd,
  onToggleReceived,
  onRemove,
}: IncomeSectionProps) {
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
      received: false,
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

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Inkomsten
        </span>
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-primary hover:text-primary/80 transition-colors"
          aria-label="Inkomst toevoegen"
        >
          + Toevoegen
        </button>
      </div>

      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 py-0.5">
          <input
            type="checkbox"
            checked={item.received}
            onChange={(e) => onToggleReceived(item.id, e.target.checked)}
            className="h-3.5 w-3.5 rounded border-input accent-primary"
            title="Ontvangen"
          />
          <span className={`flex-1 text-sm truncate ${item.received ? 'line-through text-muted-foreground' : ''}`}>
            {item.label}
          </span>
          <span className="text-sm font-medium text-emerald-600 tabular-nums">
            {formatCurrency(item.amount)}
          </span>
          <button
            onClick={() => onRemove(item.id)}
            className="text-muted-foreground hover:text-destructive transition-colors text-xs leading-none"
            aria-label="Verwijder"
          >
            ×
          </button>
        </div>
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
          <button
            onClick={handleAdd}
            className="text-xs text-primary hover:text-primary/80 font-medium"
          >
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

      {items.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground italic py-0.5">Geen inkomsten deze maand</p>
      )}
    </div>
  );
}
