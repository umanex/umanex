import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { format } from 'date-fns';
import type {
  CashflowStore,
  RecurringItem,
  BtwPayment,
  ReservationItem,
  ReservationPayment,
} from '../lib/cashflow/types';

export const useCashflowStore = create<CashflowStore>()(
  persist(
    immer((set) => ({
      anchorMonth: format(new Date(), 'yyyy-MM'),
      startBalance: 0,
      items: [] as RecurringItem[],
      btwPayments: [] as BtwPayment[],
      reservations: [] as ReservationItem[],
      reservationPayments: [] as ReservationPayment[],

      setStartBalance: (balance) =>
        set((state) => { state.startBalance = balance; }),

      addItem: (item) =>
        set((state) => { state.items.push(item); }),

      updateItem: (id, patch) =>
        set((state) => {
          const item = state.items.find((i) => i.id === id);
          if (item) Object.assign(item, patch);
        }),

      removeItem: (id) =>
        set((state) => { state.items = state.items.filter((i) => i.id !== id); }),

      addBtwPayment: (payment) =>
        set((state) => { state.btwPayments.push(payment); }),

      updateBtwPayment: (id, patch) =>
        set((state) => {
          const payment = state.btwPayments.find((p) => p.id === id);
          if (payment) Object.assign(payment, patch);
        }),

      removeBtwPayment: (id) =>
        set((state) => { state.btwPayments = state.btwPayments.filter((p) => p.id !== id); }),

      setAnchorMonth: (month) =>
        set((state) => { state.anchorMonth = month; }),

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
    })),
    {
      name: 'cashflow-store',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
