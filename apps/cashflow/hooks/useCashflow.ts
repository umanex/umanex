'use client';

import { useEffect, useState } from 'react';
import { useCashflowStore } from '../store/cashflow';
import { calculateMonths } from '../lib/cashflow/calculator';
import type { MonthData } from '../lib/cashflow/types';

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    useCashflowStore.persist.rehydrate();
    setHydrated(true);
  }, []);
  return hydrated;
}

export function useMonths(count = 12): MonthData[] {
  const anchorMonth = useCashflowStore((s) => s.anchorMonth);
  const startBalance = useCashflowStore((s) => s.startBalance);
  const items = useCashflowStore((s) => s.items);
  const btwPayments = useCashflowStore((s) => s.btwPayments);

  return calculateMonths(anchorMonth, startBalance, items, btwPayments, count);
}

export function useCashflowActions() {
  return {
    setStartBalance: useCashflowStore((s) => s.setStartBalance),
    addItem: useCashflowStore((s) => s.addItem),
    updateItem: useCashflowStore((s) => s.updateItem),
    removeItem: useCashflowStore((s) => s.removeItem),
    addBtwPayment: useCashflowStore((s) => s.addBtwPayment),
    updateBtwPayment: useCashflowStore((s) => s.updateBtwPayment),
    removeBtwPayment: useCashflowStore((s) => s.removeBtwPayment),
    setAnchorMonth: useCashflowStore((s) => s.setAnchorMonth),
  };
}
