'use client';

import { useEffect, useRef, useState } from 'react';
import { useCashflowStore } from '../store/cashflow';
import { calculateMonths } from '../lib/cashflow/calculator';
import type { MonthData } from '../lib/cashflow/types';

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const finish = () => setHydrated(true);

    const timeout = setTimeout(finish, 800);

    try {
      const result = useCashflowStore.persist.rehydrate();
      if (result instanceof Promise) {
        result.then(finish).catch(finish).finally(() => clearTimeout(timeout));
      } else {
        clearTimeout(timeout);
        finish();
      }
    } catch {
      clearTimeout(timeout);
      finish();
    }

    return () => clearTimeout(timeout);
  }, []);

  return hydrated;
}

export function useMonths(count = 3): MonthData[] {
  const anchorMonth = useCashflowStore((s) => s.anchorMonth);
  const startBalance = useCashflowStore((s) => s.startBalance);
  const expenseItems = useCashflowStore((s) => s.expenseItems);
  const incomeItems = useCashflowStore((s) => s.incomeItems);
  const recurringItems = useCashflowStore((s) => s.recurringItems);
  const reservations = useCashflowStore((s) => s.reservations);
  const reservationPayments = useCashflowStore((s) => s.reservationPayments);
  const btwPayments = useCashflowStore((s) => s.btwPayments);
  const recurringDefers = useCashflowStore((s) => s.recurringDefers);
  const recurringSettlements = useCashflowStore((s) => s.recurringSettlements);
  const reservationDefers = useCashflowStore((s) => s.reservationDefers);

  return calculateMonths(
    anchorMonth,
    startBalance,
    expenseItems,
    incomeItems,
    recurringItems,
    reservations,
    reservationPayments,
    btwPayments,
    recurringDefers,
    recurringSettlements,
    reservationDefers,
    count,
  );
}

export function useCashflowActions() {
  return {
    setStartBalance: useCashflowStore((s) => s.setStartBalance),
    setAnchorMonth: useCashflowStore((s) => s.setAnchorMonth),
    addIncomeItem: useCashflowStore((s) => s.addIncomeItem),
    updateIncomeItem: useCashflowStore((s) => s.updateIncomeItem),
    removeIncomeItem: useCashflowStore((s) => s.removeIncomeItem),
    addRecurringItem: useCashflowStore((s) => s.addRecurringItem),
    updateRecurringItem: useCashflowStore((s) => s.updateRecurringItem),
    removeRecurringItem: useCashflowStore((s) => s.removeRecurringItem),
    addExpenseItem: useCashflowStore((s) => s.addExpenseItem),
    updateExpenseItem: useCashflowStore((s) => s.updateExpenseItem),
    removeExpenseItem: useCashflowStore((s) => s.removeExpenseItem),
    upsertBtwPayment: useCashflowStore((s) => s.upsertBtwPayment),
    addRecurringDefer: useCashflowStore((s) => s.addRecurringDefer),
    removeRecurringDefer: useCashflowStore((s) => s.removeRecurringDefer),
    upsertRecurringSettlement: useCashflowStore((s) => s.upsertRecurringSettlement),
    removeRecurringSettlement: useCashflowStore((s) => s.removeRecurringSettlement),
    addReservationDefer: useCashflowStore((s) => s.addReservationDefer),
    removeReservationDefer: useCashflowStore((s) => s.removeReservationDefer),
  };
}

export function useReservationActions() {
  return {
    addReservation: useCashflowStore((s) => s.addReservation),
    updateReservation: useCashflowStore((s) => s.updateReservation),
    removeReservation: useCashflowStore((s) => s.removeReservation),
    addReservationPayment: useCashflowStore((s) => s.addReservationPayment),
    updateReservationPayment: useCashflowStore((s) => s.updateReservationPayment),
    removeReservationPayment: useCashflowStore((s) => s.removeReservationPayment),
  };
}
