export type MonthKey = string; // 'YYYY-MM'

export interface IncomeItem {
  id: string;
  monthKey: MonthKey;
  label: string;
  amount: number;
  received: boolean;
}

export interface RecurringItem {
  id: string;
  label: string;
  amount: number;
  type: 'expense';
  frequency: 'monthly' | 'yearly';
  startMonth: MonthKey;
}

export interface RecurringDefer {
  id: string;
  recurringId: string;
  fromMonth: MonthKey;
  toMonth: MonthKey;
}

export interface RecurringSettlement {
  id: string;
  recurringId: string;
  monthKey: MonthKey;
  paid: boolean;
  actualAmount: number;
}

export interface ReservationItem {
  id: string;
  label: string;
  monthlyAmount: number;
  startMonth: MonthKey;
}

export interface ReservationPayment {
  id: string;
  reservationId: string;
  monthKey: MonthKey;
  label: string;
  invoiceAmount: number;
  fromReservation: number;
  fromCash: number;
}

export interface BtwPayment {
  id: string;
  monthKey: MonthKey;
  amount: number;
  paid: boolean;
}

export interface ReservationPotBalance {
  reservationId: string;
  label: string;
  monthlyAmount: number;
  potBalance: number;
  paymentsThisMonth: ReservationPayment[];
}

export interface MonthData {
  monthKey: MonthKey;
  startBalance: number;
  endBalance: number;
  totalIncome: number;
  totalRecurring: number;
  totalReservationDeductions: number;
  totalReservationCashPayments: number;
  totalBtw: number;
  incomeItems: IncomeItem[];
  recurringItems: RecurringItem[];
  recurringSettlements: RecurringSettlement[];
  btwPayment: BtwPayment | null;
  reservationPots: ReservationPotBalance[];
  reservationPayments: ReservationPayment[];
  deferredRecurringAmount: number;
  deferredItems: Array<{
    deferId: string;
    recurringId: string;
    label: string;
    amount: number;
    fromMonth: MonthKey;
  }>;
}

export interface CashflowStore {
  startBalance: number;
  anchorMonth: MonthKey;
  incomeItems: IncomeItem[];
  recurringItems: RecurringItem[];
  recurringSettlements: RecurringSettlement[];
  reservations: ReservationItem[];
  reservationPayments: ReservationPayment[];
  btwPayments: BtwPayment[];
  recurringDefers: RecurringDefer[];

  setStartBalance: (balance: number) => void;
  setAnchorMonth: (month: MonthKey) => void;

  addIncomeItem: (item: IncomeItem) => void;
  updateIncomeItem: (id: string, patch: Partial<IncomeItem>) => void;
  removeIncomeItem: (id: string) => void;

  addRecurringItem: (item: RecurringItem) => void;
  updateRecurringItem: (id: string, patch: Partial<RecurringItem>) => void;
  removeRecurringItem: (id: string) => void;

  addReservation: (item: ReservationItem) => void;
  updateReservation: (id: string, patch: Partial<ReservationItem>) => void;
  removeReservation: (id: string) => void;

  addReservationPayment: (payment: ReservationPayment) => void;
  updateReservationPayment: (id: string, patch: Partial<ReservationPayment>) => void;
  removeReservationPayment: (id: string) => void;

  upsertBtwPayment: (monthKey: MonthKey, amount: number, paid: boolean) => void;

  addRecurringDefer: (defer: RecurringDefer) => void;
  removeRecurringDefer: (id: string) => void;

  upsertRecurringSettlement: (
    recurringId: string,
    monthKey: MonthKey,
    paid: boolean,
    actualAmount: number,
  ) => void;
  removeRecurringSettlement: (recurringId: string, monthKey: MonthKey) => void;
}
