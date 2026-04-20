'use client';

import { useCashflowStore } from '../../store/cashflow';
import { useCashflowActions } from '../../hooks/useCashflow';
import { formatCurrency } from '../../lib/cashflow/recurring';

export function ItemList() {
  const items = useCashflowStore((s) => s.items);
  const { removeItem } = useCashflowActions();

  if (items.length === 0) return null;

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-2 py-1 px-3 rounded hover:bg-muted/40 group text-sm">
          <span className="flex-1 truncate">{item.label}</span>
          <span className="text-xs text-muted-foreground capitalize shrink-0">
            {item.frequency === 'monthly' ? 'maandelijks' : 'jaarlijks'}
          </span>
          <span
            className={`tabular-nums shrink-0 ${item.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
          >
            {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
          </span>
          <button
            onClick={() => removeItem(item.id)}
            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity text-xs shrink-0"
            aria-label={`Verwijder ${item.label}`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
