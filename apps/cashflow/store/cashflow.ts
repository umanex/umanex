import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { CashflowStore, RecurringItem, BtwPayment } from '../lib/cashflow/types';

const SEED_ITEMS: RecurringItem[] = [
  { id: 'inc-1', label: 'Freelance Umanex', amount: 4500, type: 'income', frequency: 'monthly', startMonth: '2026-01' },
  { id: 'inc-2', label: 'Bijproject', amount: 800, type: 'income', frequency: 'monthly', startMonth: '2026-01' },
  { id: 'inc-3', label: 'Retainer client', amount: 1200, type: 'income', frequency: 'monthly', startMonth: '2026-04' },
  { id: 'exp-1', label: 'Hosting & tools', amount: 150, type: 'expense', frequency: 'monthly', startMonth: '2026-01' },
  { id: 'exp-2', label: 'Boekhouder', amount: 200, type: 'expense', frequency: 'monthly', startMonth: '2026-01' },
  { id: 'exp-3', label: 'Verzekeringen', amount: 120, type: 'expense', frequency: 'monthly', startMonth: '2026-01' },
  { id: 'exp-4', label: 'Kantoorkosten', amount: 80, type: 'expense', frequency: 'monthly', startMonth: '2026-01' },
  { id: 'yrly-1', label: 'Belasting personenbelasting', amount: 3600, type: 'expense', frequency: 'yearly', startMonth: '2026-01' },
  { id: 'yrly-2', label: 'Sociale bijdragen', amount: 4800, type: 'expense', frequency: 'yearly', startMonth: '2026-01' },
  { id: 'yrly-3', label: 'Hardware vervanging', amount: 2400, type: 'expense', frequency: 'yearly', startMonth: '2026-01' },
];

const SEED_BTW: BtwPayment[] = [
  { id: 'btw-1', label: 'Q1 2026', amount: 2100, dueMonth: '2026-04', paid: false },
];

export const useCashflowStore = create<CashflowStore>()(
  persist(
    immer((set) => ({
      anchorMonth: '2026-04',
      startBalance: 8500,
      items: SEED_ITEMS,
      btwPayments: SEED_BTW,

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
