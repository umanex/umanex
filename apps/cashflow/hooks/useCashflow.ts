'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useCashflowStore } from '../store/cashflow';
import { calculateMonths } from '../lib/cashflow/calculator';
import type { MonthData } from '../lib/cashflow/types';

// Verwijder verouderde defers en settlements die volledig in het verleden liggen.
// Wordt eenmalig uitgevoerd na rehydratie.
function cleanupStaleData(currentMonth: string) {
  const state = useCashflowStore.getState();

  // RecurringDefers: verwijder als zowel fromMonth als toMonth voor huidige maand liggen
  const staleRecurringDefers = state.recurringDefers.filter(
    (d) => d.fromMonth < currentMonth && d.toMonth < currentMonth,
  );
  staleRecurringDefers.forEach((d) => state.removeRecurringDefer(d.id));

  // ReservationDefers: zelfde logica
  const staleReservationDefers = state.reservationDefers.filter(
    (d) => d.fromMonth < currentMonth && d.toMonth < currentMonth,
  );
  staleReservationDefers.forEach((d) => state.removeReservationDefer(d.id));

  // RecurringSettlements: bewaar enkel de huidige maand
  // Oudere settlements zijn historiek en worden niet verwijderd —
  // ze beinvloeden de berekening niet (calculator filtert op monthKey)
  // maar ze blijven beschikbaar als referentie.

  // Rapporteer cleanup in development
  const cleaned = staleRecurringDefers.length + staleReservationDefers.length;
  if (cleaned > 0 && process.env.NODE_ENV === 'development') {
    console.info(
      `[cashflow] cleanup: ${staleRecurringDefers.length} recurring defers, ` +
      `${staleReservationDefers.length} reservation defers verwijderd (voor ${currentMonth})`
    );
  }
}

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const currentMonth = format(new Date(), 'yyyy-MM');

    const finish = () => {
      cleanupStaleData(currentMonth);
      setHydrated(true);
    };

    try {
      const r = useCashflowStore.persist.rehydrate();
      if (r && typeof (r as Promise<void>).then === 'function') {
        (r as Promise<void>).then(finish).catch(finish);
      } else {
        finish();
      }
    } catch {
      finish();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  const recurringDefers = useCashflowStore((s) => s.recurringDefers);
  const recurringSettlements = useCashflowStore((s) => s.recurringSettlements);
  const reservationDefers = useCashflowStore((s) => s.reservationDefers);
  const reservationSettlements = useCashflowStore((s) => s.reservationSettlements);

  return calculateMonths(
    anchorMonth,
    startBalance,
    expenseItems,
    incomeItems,
    recurringItems,
    reservations,
    reservationPayments,
    recurringDefers,
    recurringSettlements,
    reservationDefers,
    reservationSettlements,
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
    addRecurringDefer: useCashflowStore((s) => s.addRecurringDefer),
    removeRecurringDefer: useCashflowStore((s) => s.removeRecurringDefer),
    upsertRecurringSettlement: useCashflowStore((s) => s.upsertRecurringSettlement),
    removeRecurringSettlement: useCashflowStore((s) => s.removeRecurringSettlement),
    addReservationDefer: useCashflowStore((s) => s.addReservationDefer),
    removeReservationDefer: useCashflowStore((s) => s.removeReservationDefer),
    upsertReservationSettlement: useCashflowStore((s) => s.upsertReservationSettlement),
    removeReservationSettlement: useCashflowStore((s) => s.removeReservationSettlement),
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
