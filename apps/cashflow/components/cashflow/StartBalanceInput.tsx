'use client';

import { useState } from 'react';
import { useCashflowStore } from '../../store/cashflow';
import { useCashflowActions } from '../../hooks/useCashflow';

export function StartBalanceInput() {
  const currentBalance = useCashflowStore((s) => s.startBalance);
  const { setStartBalance } = useCashflowActions();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentBalance));

  function handleBlur() {
    const parsed = parseFloat(value.replace(',', '.'));
    if (!isNaN(parsed)) setStartBalance(parsed);
    else setValue(String(currentBalance));
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Beginsaldo:</span>
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') handleBlur(); if (e.key === 'Escape') { setValue(String(currentBalance)); setEditing(false); } }}
          className="w-28 h-8 px-2 rounded border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
        />
      ) : (
        <button
          onClick={() => { setValue(String(currentBalance)); setEditing(true); }}
          className="text-sm font-semibold tabular-nums underline decoration-dotted hover:text-primary transition-colors"
        >
          € {currentBalance.toLocaleString('nl-BE')}
        </button>
      )}
    </div>
  );
}
