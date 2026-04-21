import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { format } from 'date-fns';
import type {
  CashflowStore,
  IncomeItem,
  RecurringItem,
  RecurringDefer,
  RecurringSettlement,
  ReservationItem,
  ReservationPayment,
  ReservationDefer,
  MonthKey,
} from '../lib/cashflow/types';

export const useCashflowStore = create<CashflowStore>()(
  persist(
    immer((set) => ({
      startBalance: 0,
      anchorMonth: format(new Date(), 'yyyy-MM'),
      incomeItems: [] as IncomeItem[],
      recurringItems: [] as RecurringItem[],
      reservations: [] as ReservationItem[],
      reservationPayments: [] as ReservationPayment[],
      btwPayments: [],
      recurringDefers: [] as RecurringDefer[],
      recurringSettlements: [] as RecurringSettlement[],
      reservationDefers: [] as ReservationDefer[],

      setStartBalance: (balance) =>
        set((state) => { state.startBalance = balance; }),

      setAnchorMonth: (month) =>
        set((state) => { state.anchorMonth = month; }),

      addIncomeItem: (item) =>
        set((state) => { state.incomeItems.push(item); }),

      updateIncomeItem: (id, patch) =>
        set((state) => {
          const item = state.incomeItems.find((i) => i.id === id);
          if (item) Object.assign(item, patch);
        }),

      removeIncomeItem: (id) =>
        set((state) => { state.incomeItems = state.incomeItems.filter((i) => i.id !== id); }),

      addRecurringItem: (item) =>
        set((state) => { state.recurringItems.push(item); }),

      updateRecurringItem: (id, patch) =>
        set((state) => {
          const item = state.recurringItems.find((i) => i.id === id);
          if (item) Object.assign(item, patch);
        }),

      removeRecurringItem: (id) =>
        set((state) => {
          state.recurringItems = state.recurringItems.filter((i) => i.id !== id);
          state.recurringDefers = state.recurringDefers.filter((d) => d.recurringId !== id);
          state.recurringSettlements = state.recurringSettlements.filter((s) => s.recurringId !== id);
        }),

      addReservation: (item) =>
        set((state) => { state.reservations.push(item); }),

      updateReservation: (id, patch) =>
        set((state) => {
          const item = state.reservations.find((r) => r.id === id);
          if (item) Object.assign(item, patch);
        }),

      removeReservation: (id) =>
        set((state) => {
          state.reservations = state.reservations.filter((r) => r.id !== id);
          state.reservationPayments = state.reservationPayments.filter(
            (p) => p.reservationId !== id,
          );
          state.reservationDefers = state.reservationDefers.filter(
            (d) => d.reservationId !== id,
          );
        }),

      addReservationPayment: (payment) =>
        set((state) => { state.reservationPayments.push(payment); }),

      updateReservationPayment: (id, patch) =>
        set((state) => {
          const payment = state.reservationPayments.find((p) => p.id === id);
          if (payment) Object.assign(payment, patch);
        }),

      removeReservationPayment: (id) =>
        set((state) => {
          state.reservationPayments = state.reservationPayments.filter((p) => p.id !== id);
        }),

      upsertBtwPayment: (monthKey: MonthKey, amount: number, paid: boolean) =>
        set((state) => {
          const existing = state.btwPayments.find((p) => p.monthKey === monthKey);
          if (existing) {
            existing.amount = amount;
            existing.paid = paid;
          } else {
            state.btwPayments.push({ id: crypto.randomUUID(), monthKey, amount, paid });
          }
        }),

      addRecurringDefer: (defer) =>
        set((state) => { state.recurringDefers.push(defer); }),

      removeRecurringDefer: (id) =>
        set((state) => {
          state.recurringDefers = state.recurringDefers.filter((d) => d.id !== id);
        }),

      addReservationDefer: (defer) =>
        set((state) => { state.reservationDefers.push(defer); }),

      removeReservationDefer: (id) =>
        set((state) => {
          state.reservationDefers = state.reservationDefers.filter((d) => d.id !== id);
        }),

      upsertRecurringSettlement: (recurringId, monthKey, paid, actualAmount) =>
        set((state) => {
          const existing = state.recurringSettlements.find(
            (s) => s.recurringId === recurringId && s.monthKey === monthKey,
          );
          if (existing) {
            existing.paid = paid;
            existing.actualAmount = actualAmount;
          } else {
            state.recurringSettlements.push({
              id: crypto.randomUUID(),
              recurringId,
              monthKey,
              paid,
              actualAmount,
            });
          }
        }),

      removeRecurringSettlement: (recurringId, monthKey) =>
        set((state) => {
          state.recurringSettlements = state.recurringSettlements.filter(
            (s) => !(s.recurringId === recurringId && s.monthKey === monthKey),
          );
        }),
    })),
    {
      name: 'cashflow-store-v2',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
