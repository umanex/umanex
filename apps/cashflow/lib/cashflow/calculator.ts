import type { MonthKey, MonthData, RecurringItem, BtwPayment } from './types';
import { addMonths, format, parseISO } from 'date-fns';

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

export function calculateMonths(
  anchorMonth: MonthKey,
  startBalance: number,
  items: RecurringItem[],
  btwPayments: BtwPayment[],
  monthCount = 12,
): MonthData[] {
  const months = getMonthsInRange(anchorMonth, monthCount);
  const result: MonthData[] = [];
  let runningBalance = startBalance;

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

    // Yearly items are reserved monthly (amount / 12)
    const yearlyReservation = yearlyItems.reduce((s, i) => s + i.amount / 12, 0);

    const monthBtwPayments = btwPayments.filter((p) => p.dueMonth === monthKey && !p.paid);
    const btwAmount = monthBtwPayments.reduce((s, p) => s + p.amount, 0);

    const endBalance =
      runningBalance + totalIncome - totalExpenses - yearlyReservation - btwAmount;

    result.push({
      monthKey,
      startBalance: runningBalance,
      endBalance,
      totalIncome,
      totalExpenses,
      yearlyReservation,
      btwAmount,
      incomeItems,
      expenseItems,
      yearlyItems,
      btwPayments: monthBtwPayments,
    });

    runningBalance = endBalance;
  }

  return result;
}
