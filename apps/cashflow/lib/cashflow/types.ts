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
  btwPayment: BtwPayment | null;
  reservationPots: ReservationPotBalance[];
  reservationPayments: ReservationPayment[];
}

export interface CashflowStore {
  startBalance: number;
  anchorMonth: MonthKey;
  incomeItems: IncomeItem[];
  recurringItems: RecurringItem[];
  reservations: ReservationItem[];
  reservationPayments: ReservationPayment[];
  btwPayments: BtwPayment[];

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
}
