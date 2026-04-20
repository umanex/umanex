'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatCurrency } from '../../lib/cashflow/recurring';
import type { RecurringItem } from '../../lib/cashflow/types';

interface ItemRowProps {
  item: RecurringItem;
  onRemove?: (id: string) => void;
  draggable?: boolean;
}

export function ItemRow({ item, onRemove, draggable = false }: ItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: !draggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-muted/40 group"
    >
      {draggable && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Versleep item"
        >
          ⋮⋮
        </button>
      )}
      <span className="flex-1 text-sm truncate">{item.label}</span>
      <span
        className={`text-sm tabular-nums shrink-0 ${item.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}
      >
        {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
      </span>
      {onRemove && (
        <button
          onClick={() => onRemove(item.id)}
          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-xs"
          aria-label={`Verwijder ${item.label}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}
