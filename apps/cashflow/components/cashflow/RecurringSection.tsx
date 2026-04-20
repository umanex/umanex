'use client';

import type { RecurringItem } from '../../lib/cashflow/types';
import { formatCurrency } from '../../lib/cashflow/recurring';

interface RecurringSectionProps {
  items: RecurringItem[];
}

export function RecurringSection({ items }: RecurringSectionProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Vaste uitgaven
      </span>
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 py-0.5">
          <span className="flex-1 text-sm truncate">{item.label}</span>
          {item.frequency === 'yearly' && (
            <span className="text-xs text-muted-foreground">(jaarlijks)</span>
          )}
          <span className="text-sm font-medium text-destructive tabular-nums">
            {formatCurrency(item.frequency === 'yearly' ? item.amount / 12 : item.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}
