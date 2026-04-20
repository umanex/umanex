'use client';

import { useState } from 'react';
import { useCashflowActions } from '../../hooks/useCashflow';
import { generateId } from '../../lib/cashflow/recurring';
import { getBtwQuarterLabel } from '../../lib/cashflow/btw';

export function AddBtwForm() {
  const { addBtwPayment } = useCashflowActions();
  const [amount, setAmount] = useState('');
  const [dueMonth, setDueMonth] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!dueMonth || isNaN(parsed) || parsed <= 0) return;
    addBtwPayment({
      id: generateId(),
      label: getBtwQuarterLabel(dueMonth),
      amount: parsed,
      dueMonth,
      paid: false,
    });
    setAmount('');
    setDueMonth('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end p-3 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50 dark:bg-amber-950/20">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-amber-700 dark:text-amber-400">Vervalmaand</label>
        <input
          type="month"
          value={dueMonth}
          onChange={(e) => setDueMonth(e.target.value)}
          className="h-9 px-3 rounded-md border border-amber-300 dark:border-amber-700 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>
      <div className="flex flex-col gap-1 w-28">
        <label className="text-xs text-amber-700 dark:text-amber-400">BTW bedrag (€)</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="h-9 px-3 rounded-md border border-amber-300 dark:border-amber-700 bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>
      <button
        type="submit"
        className="h-9 px-4 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
      >
        BTW toevoegen
      </button>
    </form>
  );
}
