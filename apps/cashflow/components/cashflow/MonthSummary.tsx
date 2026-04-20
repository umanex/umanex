'use client';

import { formatCurrency } from '../../lib/cashflow/recurring';

interface MonthSummaryProps {
  startBalance: number;
  totalIncome: number;
  totalExpenses: number;
  yearlyReservation: number;
  btwAmount: number;
  reservationDeductions: number;
  reservationPaymentsCash: number;
  endBalance: number;
}

export function MonthSummary({
  startBalance,
  totalIncome,
  totalExpenses,
  yearlyReservation,
  btwAmount,
  reservationDeductions,
  reservationPaymentsCash,
  endBalance,
}: MonthSummaryProps) {
  return (
    <div className="space-y-1 px-3 py-2 border-t border-border text-xs text-muted-foreground">
      <div className="flex justify-between">
        <span>Begin saldo</span>
        <span className="tabular-nums">{formatCurrency(startBalance)}</span>
      </div>
      <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
        <span>+ Inkomsten</span>
        <span className="tabular-nums">{formatCurrency(totalIncome)}</span>
      </div>
      <div className="flex justify-between">
        <span>- Uitgaven</span>
        <span className="tabular-nums">{formatCurrency(totalExpenses)}</span>
      </div>
      {yearlyReservation > 0 && (
        <div className="flex justify-between text-violet-600 dark:text-violet-400">
          <span>- Jaarlijkse reservering</span>
          <span className="tabular-nums">{formatCurrency(yearlyReservation)}</span>
        </div>
      )}
      {reservationDeductions > 0 && (
        <div className="flex justify-between text-teal-600 dark:text-teal-400">
          <span>- Spaarpotten</span>
          <span className="tabular-nums">{formatCurrency(reservationDeductions)}</span>
        </div>
      )}
      {reservationPaymentsCash > 0 && (
        <div className="flex justify-between text-teal-600 dark:text-teal-400">
          <span>- Betalingen cash</span>
          <span className="tabular-nums">{formatCurrency(reservationPaymentsCash)}</span>
        </div>
      )}
      {btwAmount > 0 && (
        <div className="flex justify-between text-amber-600 dark:text-amber-400">
          <span>- BTW</span>
          <span className="tabular-nums">{formatCurrency(btwAmount)}</span>
        </div>
      )}
      <div
        className={`flex justify-between font-semibold pt-1 border-t border-border ${endBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
      >
        <span>Eind saldo</span>
        <span className="tabular-nums">{formatCurrency(endBalance)}</span>
      </div>
    </div>
  );
}
