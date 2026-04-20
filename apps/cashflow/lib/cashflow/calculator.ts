import type {
  MonthKey,
  MonthData,
  IncomeItem,
  RecurringItem,
  RecurringDefer,
  BtwPayment,
  ReservationItem,
  ReservationPayment,
  ReservationPotBalance,
} from './types';
import { addMonths, format, parseISO, differenceInMonths } from 'date-fns';

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
  incomeItems: IncomeItem[],
  recurringItems: RecurringItem[],
  reservations: ReservationItem[],
  reservationPayments: ReservationPayment[],
  btwPayments: BtwPayment[],
  recurringDefers: RecurringDefer[],
  count = 3,
): MonthData[] {
  const months = getMonthsInRange(anchorMonth, count);
  const result: MonthData[] = [];
  let runningBalance = startBalance;

  const potBalanceMap = new Map<string, number>();

  for (const monthKey of months) {
    const monthIncomeItems = incomeItems.filter((i) => i.monthKey === monthKey);
    const allActiveRecurring = recurringItems.filter((i) => i.startMonth <= monthKey);

    // Recurring items deferred away from this month
    const departingDeferIds = new Set(
      recurringDefers
        .filter((d) => d.fromMonth === monthKey)
        .map((d) => d.recurringId),
    );

    const monthRecurringItems = allActiveRecurring.filter((i) => !departingDeferIds.has(i.id));

    // Deferred items arriving this month from other months
    const arrivingDefers = recurringDefers.filter((d) => d.toMonth === monthKey);
    const deferredItems = arrivingDefers.flatMap((d) => {
      const recurringItem = recurringItems.find(
        (i) => i.id === d.recurringId && i.startMonth <= d.fromMonth,
      );
      if (!recurringItem) return [];
      const amount =
        recurringItem.frequency === 'yearly' ? recurringItem.amount / 12 : recurringItem.amount;
      return [{ deferId: d.id, recurringId: d.recurringId, label: recurringItem.label, amount, fromMonth: d.fromMonth }];
    });

    const totalIncome = monthIncomeItems.reduce((s, i) => s + i.amount, 0);

    const totalNormalRecurring = monthRecurringItems.reduce((s, i) => {
      return s + (i.frequency === 'yearly' ? i.amount / 12 : i.amount);
    }, 0);

    const deferredRecurringAmount = deferredItems.reduce((s, d) => s + d.amount, 0);
    const totalRecurring = totalNormalRecurring + deferredRecurringAmount;

    const activeReservations = reservations.filter((r) => r.startMonth <= monthKey);

    for (const res of activeReservations) {
      potBalanceMap.set(res.id, (potBalanceMap.get(res.id) ?? 0) + res.monthlyAmount);
    }

    const monthReservationPayments = reservationPayments.filter((p) => p.monthKey === monthKey);

    for (const payment of monthReservationPayments) {
      potBalanceMap.set(
        payment.reservationId,
        (potBalanceMap.get(payment.reservationId) ?? 0) - payment.fromReservation,
      );
    }

    const totalReservationDeductions = activeReservations.reduce(
      (s, r) => s + r.monthlyAmount,
      0,
    );

    const totalReservationCashPayments = monthReservationPayments.reduce(
      (s, p) => s + p.fromCash,
      0,
    );

    const btwPayment = btwPayments.find((p) => p.monthKey === monthKey && !p.paid) ?? null;
    const totalBtw = btwPayment?.amount ?? 0;

    const reservationPots: ReservationPotBalance[] = activeReservations.map((r) => ({
      reservationId: r.id,
      label: r.label,
      monthlyAmount: r.monthlyAmount,
      potBalance: potBalanceMap.get(r.id) ?? 0,
      paymentsThisMonth: monthReservationPayments.filter((p) => p.reservationId === r.id),
    }));

    const endBalance =
      runningBalance +
      totalIncome -
      totalRecurring -
      totalReservationDeductions -
      totalReservationCashPayments -
      totalBtw;

    result.push({
      monthKey,
      startBalance: runningBalance,
      endBalance,
      totalIncome,
      totalRecurring,
      totalReservationDeductions,
      totalReservationCashPayments,
      totalBtw,
      incomeItems: monthIncomeItems,
      recurringItems: monthRecurringItems,
      btwPayment,
      reservationPots,
      reservationPayments: monthReservationPayments,
      deferredRecurringAmount,
      deferredItems,
    });

    runningBalance = endBalance;
  }

  return result;
}
