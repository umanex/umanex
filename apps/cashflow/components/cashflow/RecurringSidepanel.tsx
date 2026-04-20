'use client';

import { useCashflowStore } from '../../store/cashflow';
import { useCashflowActions } from '../../hooks/useCashflow';
import { generateId, getCurrentMonthKey, formatCurrency } from '../../lib/cashflow/recurring';
import type { RecurringItem, RecurringFrequency, TransactionType } from '../../lib/cashflow/types';

interface RecurringSidepanelProps {
  open: boolean;
  onClose: () => void;
}

interface ItemEditRowProps {
  item: RecurringItem;
  onUpdate: (patch: Partial<RecurringItem>) => void;
  onRemove: () => void;
}

function ItemEditRow({ item, onUpdate, onRemove }: ItemEditRowProps) {
  const monthlyHint = item.frequency === 'yearly' && item.amount > 0
    ? `≈ ${formatCurrency(Math.round(item.amount / 12))}/maand`
    : null;

  return (
    <div className="flex flex-col gap-1.5 p-2.5 rounded-lg border border-border bg-muted/30">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={item.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Omschrijving"
          className="flex-1 h-8 px-2 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive shrink-0 text-sm px-1"
          aria-label={`Verwijder ${item.label}`}
        >
          ✕
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={item.amount === 0 ? '' : item.amount}
          onChange={(e) => onUpdate({ amount: parseFloat(e.target.value) || 0 })}
          placeholder="0"
          min={0}
          step={0.01}
          className="w-28 h-8 px-2 rounded border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={item.frequency}
          onChange={(e) => onUpdate({ frequency: e.target.value as RecurringFrequency })}
          className="h-8 px-2 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="monthly">Maandelijks</option>
          <option value="yearly">Jaarlijks</option>
        </select>
        {monthlyHint && (
          <span className="text-xs text-muted-foreground shrink-0">{monthlyHint}</span>
        )}
      </div>
    </div>
  );
}

export function RecurringSidepanel({ open, onClose }: RecurringSidepanelProps) {
  const items = useCashflowStore((s) => s.items);
  const { addItem, updateItem, removeItem } = useCashflowActions();

  const incomeItems = [...items].filter((i) => i.type === 'income').reverse();
  const expenseItems = [...items].filter((i) => i.type === 'expense').reverse();

  function handleAdd(type: TransactionType) {
    addItem({
      id: generateId(),
      label: '',
      amount: 0,
      type,
      frequency: 'monthly',
      startMonth: getCurrentMonthKey(),
    });
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Terugkerende posten beheren"
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-background border-l border-border shadow-xl z-50 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold">Terugkerende posten</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors"
            aria-label="Sluiten"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Inkomsten
              </h3>
              <button
                onClick={() => handleAdd('income')}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
              >
                + Toevoegen
              </button>
            </div>
            {incomeItems.length === 0 && (
              <p className="text-xs text-muted-foreground py-1">Nog geen inkomsten toegevoegd.</p>
            )}
            {incomeItems.map((item) => (
              <ItemEditRow
                key={item.id}
                item={item}
                onUpdate={(patch) => updateItem(item.id, patch)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Uitgaven
              </h3>
              <button
                onClick={() => handleAdd('expense')}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                + Toevoegen
              </button>
            </div>
            {expenseItems.length === 0 && (
              <p className="text-xs text-muted-foreground py-1">Nog geen uitgaven toegevoegd.</p>
            )}
            {expenseItems.map((item) => (
              <ItemEditRow
                key={item.id}
                item={item}
                onUpdate={(patch) => updateItem(item.id, patch)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
