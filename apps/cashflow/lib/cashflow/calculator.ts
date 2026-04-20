import type {
  MonthKey,
  MonthData,
  RecurringItem,
  BtwPayment,
  ReservationItem,
  ReservationPayment,
  ReservationPotBalance,
} from './types';
import { addMonths, format, parseISO, differenceInMonths } from 'date-fns';

function isActiveInMonth(item: RecurringItem, monthKey: MonthKey): boolean {
  if (item.startMonth > monthKey) return false;
  if (item.endMonth && item.endMonth < monthKey) return false;
  return true;
}

function getMonthsInRange(anchorMonth: MonthKey, count: number): MonthKey[] {
  const base = parseISO(`${anchorMonth}-01`);
  return Array.from({ length: count }, (_, i) =>
    format(addMonths(base, i), 'yyyy-MM'),
  );
}

export function calcPotBalance(
  reservation: ReservationItem,
  payments: ReservationPayment[],
  upToMonth: MonthKey,
): number {
  if (upToMonth < reservation.startMonth) return 0;
  const start = parseISO(`${reservation.startMonth}-01`);
  const end = parseISO(`${upToMonth}-01`);
  const months = differenceInMonths(end, start) + 1;
  const accumulated = months * reservation.monthlyAmount;
  const paid = payments
    .filter((p) => p.reservationId === reservation.id && p.monthKey <= upToMonth)
    .reduce((s, p) => s + p.fromReservation, 0);
  return accumulated - paid;
}

export function calculateMonths(
  anchorMonth: MonthKey,
  startBalance: number,
  items: RecurringItem[],
  btwPayments: BtwPayment[],
  monthCount = 12,
  reservations: ReservationItem[] = [],
  reservationPayments: ReservationPayment[] = [],
): MonthData[] {
  const months = getMonthsInRange(anchorMonth, monthCount);
  const result: MonthData[] = [];
  let runningBalance = startBalance;

  // Cumulative pot balances tracked across months
  const potBalanceMap = new Map<string, number>();

  for (const monthKey of months) {
    const incomeItems = items.filter(
      (i) => i.type === 'income' && i.frequency === 'monthly' && isActiveInMonth(i, monthKey),
    );
    const expenseItems = items.filter(
      (i) => i.type === 'expense' && i.frequency === 'monthly' && isActiveInMonth(i, monthKey),
    );
    const yearlyItems = items.filter(
      (i) => i.frequency === 'yearly' && isActiveInMonth(i, monthKey),
    );

    const totalIncome = incomeItems.reduce((s, i) => s + i.amount, 0);
    const totalExpenses = expenseItems.reduce((s, i) => s + i.amount, 0);
    const yearlyReservation = yearlyItems.reduce((s, i) => s + i.amount / 12, 0);

    const monthBtwPayments = btwPayments.filter((p) => p.dueMonth === monthKey && !p.paid);
    const btwAmount = monthBtwPayments.reduce((s, p) => s + p.amount, 0);

    // Active reservations this month
    const activeReservations = reservations.filter((r) => r.startMonth <= monthKey);

    // Add monthly contributions to each active pot
    for (const res of activeReservations) {
      potBalanceMap.set(res.id, (potBalanceMap.get(res.id) ?? 0) + res.monthlyAmount);
    }

    // Subtract reservation payments from pots
    for (const payment of reservationPayments) {
      if (payment.monthKey === monthKey) {
        potBalanceMap.set(
          payment.reservationId,
          (potBalanceMap.get(payment.reservationId) ?? 0) - payment.fromReservation,
        );
      }
    }

    const reservationDeductions = activeReservations.reduce((s, r) => s + r.monthlyAmount, 0);
    const reservationPaymentsCash = reservationPayments
      .filter((p) => p.monthKey === monthKey)
      .reduce((s, p) => s + p.fromCash, 0);

    const reservationPots: ReservationPotBalance[] = activeReservations.map((r) => ({
      reservationId: r.id,
      label: r.label,
      monthlyAmount: r.monthlyAmount,
      potBalance: potBalanceMap.get(r.id) ?? 0,
    }));

    const endBalance =
      runningBalance +
      totalIncome -
      totalExpenses -
      yearlyReservation -
      btwAmount -
      reservationDeductions -
      reservationPaymentsCash;

    result.push({
      monthKey,
      startBalance: runningBalance,
      endBalance,
      totalIncome,
      totalExpenses,
      yearlyReservation,
      btwAmount,
      reservationDeductions,
      reservationPaymentsCash,
      reservationPots,
      incomeItems,
      expenseItems,
      yearlyItems,
      btwPayments: monthBtwPayments,
    });

    runningBalance = endBalance;
  }

  return result;
}
