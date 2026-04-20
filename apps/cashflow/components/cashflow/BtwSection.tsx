'use client';

import { useState, useEffect } from 'react';
import type { BtwPayment, MonthKey } from '../../lib/cashflow/types';
import { isBtwPaymentMonth, getBtwLabel } from '../../lib/cashflow/btw';

interface BtwSectionProps {
  monthKey: MonthKey;
  btwPayment: BtwPayment | null;
  onUpsert: (amount: number, paid: boolean) => void;
}

export function BtwSection({ monthKey, btwPayment, onUpsert }: BtwSectionProps) {
  const show = isBtwPaymentMonth(monthKey) || btwPayment !== null;
  const [amountStr, setAmountStr] = useState(btwPayment ? String(btwPayment.amount) : '');
  const [paid, setPaid] = useState(btwPayment?.paid ?? false);

  useEffect(() => {
    setAmountStr(btwPayment ? String(btwPayment.amount) : '');
    setPaid(btwPayment?.paid ?? false);
  }, [btwPayment]);

  if (!show) return null;

  function handleAmountBlur() {
    const parsed = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) return;
    onUpsert(parsed, paid);
  }

  function handlePaidChange(checked: boolean) {
    setPaid(checked);
    const parsed = parseFloat(amountStr.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      onUpsert(parsed, checked);
    }
  }

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {getBtwLabel(monthKey)}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          onBlur={handleAmountBlur}
          placeholder="Bedrag"
          className="w-28 h-7 px-2 text-sm rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right tabular-nums"
        />
        <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={paid}
            onChange={(e) => handlePaidChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-input accent-primary"
          />
          <span className="text-muted-foreground">Betaald</span>
        </label>
      </div>
    </div>
  );
}
