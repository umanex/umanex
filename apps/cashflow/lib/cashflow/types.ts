export type MonthKey = string; // 'YYYY-MM'

export type TransactionType = 'income' | 'expense';

export type RecurringFrequency = 'monthly' | 'yearly';

export interface RecurringItem {
  id: string;
  label: string;
  amount: number;
  type: TransactionType;
  frequency: RecurringFrequency;
  /** ISO month string when this item starts recurring, e.g. '2026-01' */
  startMonth: MonthKey;
  /** ISO month string when this item stops (inclusive), undefined = open-ended */
  endMonth?: MonthKey;
}

export interface BtwPayment {
  id: string;
  /** Quarter label, e.g. 'Q1 2026' */
  label: string;
  amount: number;
  /** Month in which the BTW is due, e.g. '2026-04' */
  dueMonth: MonthKey;
  paid: boolean;
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
  invoiceAmount: number;
  fromReservation: number;
  fromCash: number;
  label: string;
}

export interface ReservationPotBalance {
  reservationId: string;
  label: string;
  monthlyAmount: number;
  potBalance: number;
}

export interface MonthData {
  monthKey: MonthKey;
  startBalance: number;
  endBalance: number;
  totalIncome: number;
  totalExpenses: number;
  yearlyReservation: number;
  btwAmount: number;
  reservationDeductions: number;
  reservationPaymentsCash: number;
  reservationPots: ReservationPotBalance[];
  incomeItems: RecurringItem[];
  expenseItems: RecurringItem[];
  yearlyItems: RecurringItem[];
  btwPayments: BtwPayment[];
}

export interface CashflowState {
  anchorMonth: MonthKey;
  startBalance: number;
  items: RecurringItem[];
  btwPayments: BtwPayment[];
  reservations: ReservationItem[];
  reservationPayments: ReservationPayment[];
}

export interface CashflowStore extends CashflowState {
  setStartBalance: (balance: number) => void;
  addItem: (item: RecurringItem) => void;
  updateItem: (id: string, patch: Partial<RecurringItem>) => void;
  removeItem: (id: string) => void;
  addBtwPayment: (payment: BtwPayment) => void;
  updateBtwPayment: (id: string, patch: Partial<BtwPayment>) => void;
  removeBtwPayment: (id: string) => void;
  setAnchorMonth: (month: MonthKey) => void;
  addReservation: (item: ReservationItem) => void;
  updateReservation: (id: string, patch: Partial<ReservationItem>) => void;
  removeReservation: (id: string) => void;
  addReservationPayment: (payment: ReservationPayment) => void;
  updateReservationPayment: (id: string, patch: Partial<ReservationPayment>) => void;
  removeReservationPayment: (id: string) => void;
}
