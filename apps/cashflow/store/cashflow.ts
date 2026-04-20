import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { format } from 'date-fns';
import type { CashflowStore, RecurringItem, BtwPayment } from '../lib/cashflow/types';

export const useCashflowStore = create<CashflowStore>()(
  persist(
    immer((set) => ({
      anchorMonth: format(new Date(), 'yyyy-MM'),
      startBalance: 0,
      items: [] as RecurringItem[],
      btwPayments: [] as BtwPayment[],

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
    })),
    {
      name: 'cashflow-store',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
