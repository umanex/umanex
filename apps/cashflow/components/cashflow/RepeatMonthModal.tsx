'use client';

import { useState } from 'react';
import { Button } from '@umanex/ui/components/ui/button';
import { useCashflowStore } from '../../store/cashflow';
import { useCashflowActions } from '../../hooks/useCashflow';
import { useDismissOnEscape } from '../../hooks/useDismissOnEscape';
import { addMonth, formatSigned, generateId, getMonthLabel } from '../../lib/cashflow/recurring';
import type { MonthKey } from '../../lib/cashflow/types';

interface RepeatMonthModalProps {
  /** Maand waarin de posten terechtkomen. De bron is telkens de maand ervóór. */
  monthKey: MonthKey;
  onClose: () => void;
}

type Candidate = {
  key: string;
  kind: 'income' | 'expense';
  label: string;
  amount: number;
  /** Staat er in de doelmaand al een post met deze omschrijving? */
  exists: boolean;
};

/** Omschrijvingen vergelijken zonder te struikelen over hoofdletters of spaties. */
function normalize(label: string): string {
  return label.trim().toLowerCase();
}

export function RepeatMonthModal({ monthKey, onClose }: RepeatMonthModalProps) {
  useDismissOnEscape(onClose);

  const incomeItems = useCashflowStore((s) => s.incomeItems);
  const expenseItems = useCashflowStore((s) => s.expenseItems);
  const { addIncomeItem, addExpenseItem } = useCashflowActions();

  const sourceMonth = addMonth(monthKey, -1);

  const [candidates] = useState<Candidate[]>(() => {
    const existingIncome = new Set(
      incomeItems.filter((i) => i.monthKey === monthKey).map((i) => normalize(i.label)),
    );
    const existingExpense = new Set(
      expenseItems.filter((i) => i.monthKey === monthKey).map((i) => normalize(i.label)),
    );
    return [
      ...incomeItems
        .filter((i) => i.monthKey === sourceMonth)
        .map<Candidate>((i) => ({
          key: `income-${i.id}`,
          kind: 'income',
          label: i.label,
          amount: i.amount,
          exists: existingIncome.has(normalize(i.label)),
        })),
      ...expenseItems
        .filter((i) => i.monthKey === sourceMonth)
        .map<Candidate>((i) => ({
          key: `expense-${i.id}`,
          kind: 'expense',
          label: i.label,
          amount: i.amount,
          exists: existingExpense.has(normalize(i.label)),
        })),
    ];
  });

  // Alles aan, behalve wat er al lijkt te staan — dat vink je bewust zelf aan.
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(candidates.map((c) => [c.key, !c.exists])),
  );

  const selected = candidates.filter((c) => checked[c.key]);

  function handleConfirm() {
    for (const candidate of selected) {
      if (candidate.kind === 'income') {
        addIncomeItem({
          id: generateId(),
          monthKey,
          label: candidate.label,
          amount: candidate.amount,
          received: false,
        });
      } else {
        addExpenseItem({
          id: generateId(),
          monthKey,
          label: candidate.label,
          amount: candidate.amount,
          paid: false,
        });
      }
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-label={`Posten overnemen uit ${getMonthLabel(sourceMonth)}`}
    >
      <div className="absolute inset-0 bg-overlay-scrim" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background shadow-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Herhaal vorige maand</h2>
            <p className="text-sm text-muted-foreground">
              Uit {getMonthLabel(sourceMonth)} naar {getMonthLabel(monthKey)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors shrink-0"
            aria-label="Sluiten"
          >
            ×
          </button>
        </div>

        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {getMonthLabel(sourceMonth)} bevat geen inkomsten of eenmalige uitgaven om over te nemen.
            Vaste uitgaven en spaarpotten staan er sowieso al.
          </p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1">
            <ul className="space-y-1">
              {candidates.map((candidate) => (
                <li key={candidate.key}>
                  <label className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked[candidate.key] ?? false}
                      onChange={(e) =>
                        setChecked((prev) => ({ ...prev, [candidate.key]: e.target.checked }))
                      }
                      className="h-3.5 w-3.5 rounded border-input shrink-0 accent-primary"
                    />
                    <span className="flex-1 text-sm truncate min-w-0">
                      {candidate.label}
                      {candidate.exists && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          (staat er al)
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-sm tabular-nums whitespace-nowrap shrink-0 ${
                        candidate.kind === 'income'
                          ? 'text-finance-positive'
                          : 'text-finance-negative'
                      }`}
                    >
                      {formatSigned(candidate.amount, candidate.kind === 'income' ? 'in' : 'out')}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {selected.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Saldo-effect: {formatSigned(
              selected.reduce(
                (s, c) => s + (c.kind === 'income' ? c.amount : -c.amount),
                0,
              ),
              'in',
            )}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="px-4"
          >
            Annuleren
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={selected.length === 0}
            className="px-4"
          >
            {selected.length === 0
              ? 'Niets geselecteerd'
              : `${selected.length} ${selected.length === 1 ? 'post' : 'posten'} overnemen`}
          </Button>
        </div>
      </div>
    </div>
  );
}
