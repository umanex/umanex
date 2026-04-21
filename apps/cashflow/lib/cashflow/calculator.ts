import type {
  MonthKey,
  MonthData,
  ExpenseItem,
  IncomeItem,
  RecurringItem,
  RecurringDefer,
  RecurringSettlement,
  BtwPayment,
  ReservationItem,
  ReservationPayment,
  ReservationPotBalance,
  ReservationDefer,
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
  expenseItems: ExpenseItem[],
  incomeItems: IncomeItem[],
  recurringItems: RecurringItem[],
  reservations: ReservationItem[],
  reservationPayments: ReservationPayment[],
  btwPayments: BtwPayment[],
  recurringDefers: RecurringDefer[],
  recurringSettlements: RecurringSettlement[],
  reservationDefers: ReservationDefer[],
  count = 3,
): MonthData[] {
  const months = getMonthsInRange(anchorMonth, count);
  const result: MonthData[] = [];
  let runningBalance = startBalance;
  const potBalanceMap = new Map<string, number>();

  for (const monthKey of months) {
    const monthExpenseItems = expenseItems.filter((i) => i.monthKey === monthKey);
    const totalExpenses = monthExpenseItems.reduce((s, i) => s + i.amount, 0);
    const monthIncomeItems = incomeItems.filter((i) => i.monthKey === monthKey);
    const allActiveRecurring = recurringItems.filter((i) => i.startMonth <= monthKey);

    const departingDeferIds = new Set(
      recurringDefers.filter((d) => d.fromMonth === monthKey).map((d) => d.recurringId),
    );
    const monthRecurringItems = allActiveRecurring.filter((i) => !departingDeferIds.has(i.id));

    const arrivingDefers = recurringDefers.filter((d) => d.toMonth === monthKey);
    const deferredItems = arrivingDefers.flatMap((d) => {
      const ri = recurringItems.find((i) => i.id === d.recurringId && i.startMonth <= d.fromMonth);
      if (!ri) return [];
      const amount = ri.frequency === 'yearly' ? ri.amount / 12 : ri.amount;
      return [{ deferId: d.id, recurringId: d.recurringId, label: ri.label, amount, fromMonth: d.fromMonth }];
    });

    const totalIncome = monthIncomeItems.reduce((s, i) => s + i.amount, 0);

    // Gebruik actualAmount voor betaalde items, begroot voor onbetaalde
    const totalNormalRecurring = monthRecurringItems.reduce((s, item) => {
      const budgeted = item.frequency === 'yearly' ? item.amount / 12 : item.amount;
      const settlement = recurringSettlements.find(
        (st) => st.recurringId === item.id && st.monthKey === monthKey,
      );
      return s + (settlement?.paid ? settlement.actualAmount : budgeted);
    }, 0);

    const deferredRecurringAmount = deferredItems.reduce((s, d) => s + d.amount, 0);
    const totalRecurring = totalNormalRecurring + deferredRecurringAmount;

    const activeReservations = reservations.filter((r) => r.startMonth <= monthKey);

    const departingReservationDeferIds = new Set(
      reservationDefers.filter((d) => d.fromMonth === monthKey).map((d) => d.reservationId),
    );
    const billableReservations = activeReservations.filter(
      (r) => !departingReservationDeferIds.has(r.id),
    );

    const arrivingReservationDefers = reservationDefers.filter((d) => d.toMonth === monthKey);
    const deferredReservationItems = arrivingReservationDefers.flatMap((d) => {
      const res = reservations.find((r) => r.id === d.reservationId);
      if (!res) return [];
      return [{
        deferId: d.id,
        reservationId: d.reservationId,
        label: res.label,
        amount: res.monthlyAmount,
        fromMonth: d.fromMonth,
      }];
    });
    const deferredReservationAmount = deferredReservationItems.reduce((s, d) => s + d.amount, 0);

    for (const res of billableReservations) {
      potBalanceMap.set(res.id, (potBalanceMap.get(res.id) ?? 0) + res.monthlyAmount);
    }
    for (const d of arrivingReservationDefers) {
      const res = reservations.find((r) => r.id === d.reservationId);
      if (res) potBalanceMap.set(res.id, (potBalanceMap.get(res.id) ?? 0) + res.monthlyAmount);
    }

    const monthReservationPayments = reservationPayments.filter((p) => p.monthKey === monthKey);
    for (const payment of monthReservationPayments) {
      potBalanceMap.set(
        payment.reservationId,
        (potBalanceMap.get(payment.reservationId) ?? 0) - payment.fromReservation,
      );
    }

    const totalReservationDeductions =
      billableReservations.reduce((s, r) => s + r.monthlyAmount, 0) + deferredReservationAmount;
    const totalReservationCashPayments = monthReservationPayments.reduce((s, p) => s + p.fromCash, 0);
    const btwPayment = btwPayments.find((p) => p.monthKey === monthKey && !p.paid) ?? null;
    const totalBtw = btwPayment?.amount ?? 0;

    const reservationPots: ReservationPotBalance[] = billableReservations.map((r) => ({
      reservationId: r.id,
      label: r.label,
      monthlyAmount: r.monthlyAmount,
      potBalance: potBalanceMap.get(r.id) ?? 0,
      paymentsThisMonth: monthReservationPayments.filter((p) => p.reservationId === r.id),
    }));

    const monthSettlements = recurringSettlements.filter((s) => s.monthKey === monthKey);

    const paidRecurringAmount = monthRecurringItems.reduce((s, item) => {
      const settlement = recurringSettlements.find(
        (st) => st.recurringId === item.id && st.monthKey === monthKey,
      );
      if (!settlement?.paid) return s;
      const budgeted = item.frequency === 'yearly' ? item.amount / 12 : item.amount;
      return s + budgeted;
    }, 0);

    const availableBudget = runningBalance + totalIncome - paidRecurringAmount;

    // Berekening 1: openstaande kosten (display tile) — enkel onbetaalde recurring
    const totalOpenRecurring = monthRecurringItems.reduce((s, item) => {
      const settlement = recurringSettlements.find(
        (st) => st.recurringId === item.id && st.monthKey === monthKey,
      );
      if (settlement?.paid) return s;
      return s + (item.frequency === 'yearly' ? item.amount / 12 : item.amount);
    }, 0);

    const totalOutstandingCosts =
      totalOpenRecurring +
      deferredRecurringAmount +
      totalReservationDeductions +
      totalReservationCashPayments +
      totalBtw +
      totalExpenses;

    const endBalance = availableBudget - totalOutstandingCosts;

    result.push({
      monthKey,
      startBalance: runningBalance,
      endBalance,
      totalIncome,
      totalRecurring,
      totalReservationDeductions,
      totalReservationCashPayments,
      totalBtw,
      availableBudget,
      totalOutstandingCosts,
      expenseItems: monthExpenseItems,
      totalExpenses,
      incomeItems: monthIncomeItems,
      recurringItems: monthRecurringItems,
      btwPayment,
      reservationPots,
      reservationPayments: monthReservationPayments,
      deferredRecurringAmount,
      deferredItems,
      deferredReservationAmount,
      deferredReservationItems,
      recurringSettlements: monthSettlements,
    });

    runningBalance = endBalance;
  }

  return result;
}
