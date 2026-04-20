'use client';

import { useState } from 'react';
import { useCashflowActions } from '../../hooks/useCashflow';
import { generateId, getCurrentMonthKey } from '../../lib/cashflow/recurring';
import type { TransactionType, RecurringFrequency } from '../../lib/cashflow/types';

export function AddItemForm() {
  const { addItem } = useCashflowActions();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('income');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!label.trim() || isNaN(parsed) || parsed <= 0) return;
    addItem({
      id: generateId(),
      label: label.trim(),
      amount: parsed,
      type,
      frequency,
      startMonth: getCurrentMonthKey(),
    });
    setLabel('');
    setAmount('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end p-3 border border-border rounded-lg bg-card">
      <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
        <label className="text-xs text-muted-foreground">Omschrijving</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="bijv. Freelance"
          className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1 w-28">
        <label className="text-xs text-muted-foreground">Bedrag (€)</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="h-9 px-3 rounded-md border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TransactionType)}
          className="h-9 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="income">Inkomen</option>
          <option value="expense">Uitgave</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Frequentie</label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
          className="h-9 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="monthly">Maandelijks</option>
          <option value="yearly">Jaarlijks</option>
        </select>
      </div>
      <button
        type="submit"
        className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Toevoegen
      </button>
    </form>
  );
}
