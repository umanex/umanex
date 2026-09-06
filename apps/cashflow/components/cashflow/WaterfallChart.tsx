'use client';

import { useState } from 'react';
import { formatAmount, formatCurrency, formatSigned, getMonthLabel } from '../../lib/cashflow/recurring';
import type { MonthData } from '../../lib/cashflow/types';

type WaterfallChartProps = {
  month: MonthData;
};

const W = 640;
const H = 260;
const PAD = { top: 12, right: 12, bottom: 40, left: 76 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

type Step = {
  label: string;
  /** Mutatie; `null` bij een saldo-staaf die vanaf nul getekend wordt. */
  delta: number | null;
  value: number;
};

function buildSteps(month: MonthData): Step[] {
  const { startBalance, totalIncome, subtotals } = month;
  const afterIncome = startBalance + totalIncome;
  const afterRecurring = afterIncome - subtotals.recurring;
  const afterOneOff = afterRecurring - subtotals.oneOff;
  const afterBudgets = afterOneOff - subtotals.budgets;
  const afterProvisions = afterBudgets - subtotals.provisions;

  // De buffer is de laatste stap: hij neemt op wat er na alle andere posten overblijft,
  // waardoor het eindsaldo op €0 landt. Zonder bufferpot is de stap 0 breed en valt hij
  // visueel samen met het eindsaldo.
  return [
    { label: 'Beginsaldo', delta: null, value: startBalance },
    { label: 'Inkomsten', delta: totalIncome, value: afterIncome },
    { label: 'Vast', delta: -subtotals.recurring, value: afterRecurring },
    { label: 'Eenmalig', delta: -subtotals.oneOff, value: afterOneOff },
    { label: 'Budgetten', delta: -subtotals.budgets, value: afterBudgets },
    { label: 'Provisies', delta: -subtotals.provisions, value: afterProvisions },
    // "Naar de buffer" en niet "Buffer": dit is de storting of opname van die maand, en
    // sinds 2026-09-06 heet de stand in de footer en op de runwaykaart "Buffer". Twee
    // dingen met dezelfde naam op twee schermen las als een tegenspraak — gemeten stond
    // hier "Buffer € 0,00" terwijl de kaart erboven "Buffer −€ 1.500,00" meldde.
    { label: 'Naar de buffer', delta: -subtotals.buffer, value: subtotals.endBalance },
    { label: 'Eindsaldo', delta: null, value: subtotals.endBalance },
  ];
}

/**
 * Waterfall van één maand: hoe je van beginsaldo naar eindsaldo komt.
 *
 * Zwevende staven tussen het lopende saldo vóór en ná elke stap. Beide adviesrapporten
 * noemen dit de standaardvorm voor een cashflow-brug — bij gemengde plussen en minnen is
 * er geen goed alternatief.
 */
export function WaterfallChart({ month }: WaterfallChartProps) {
  const [showTable, setShowTable] = useState(false);
  const steps = buildSteps(month);

  const values = steps.flatMap((s, i) => [s.value, i > 0 ? steps[i - 1]!.value : 0, 0]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const y = (value: number) => PAD.top + PLOT_H - ((value - min) / span) * PLOT_H;
  const bandW = PLOT_W / steps.length;
  const barW = Math.min(bandW * 0.6, 56);
  const x = (i: number) => PAD.left + i * bandW + (bandW - barW) / 2;

  return (
    <section className="rounded-xl border border-accent bg-card p-5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Van beginsaldo naar eindsaldo
          </h2>
          <p className="text-sm text-muted-foreground">
            {getMonthLabel(month.monthKey)} — elke stap van de kernformule
          </p>
        </div>
        <button
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          aria-controls="waterfall-tabel"
          className="shrink-0 h-8 px-3 rounded-md border border-input text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showTable ? 'Verberg tabel' : 'Toon tabel'}
        </button>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full h-auto max-h-[280px]"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Opbouw van het eindsaldo van ${getMonthLabel(month.monthKey)}.${showTable ? ' De tabel eronder bevat dezelfde waarden.' : ' Gebruik "Toon tabel" voor dezelfde waarden als tekst.'}`}
      >
        {/* Ontdubbeld: `values` bevat altijd een literale 0, dus min <= 0 <= max. Zodra
            een van beide exact 0 is — het normale geval, en met een actieve bufferpot per
            constructie — kregen twee <g>-elementen dezelfde key en werd dezelfde
            rasterlijn met astekst twee keer over zichzelf getekend. */}
        {[...new Set([min, 0, max])].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 0 ? 'hsl(var(--muted-foreground))' : 'hsl(var(--border))'}
            />
            <text
              x={PAD.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize={11}
              fill="hsl(var(--muted-foreground))"
            >
              {formatCurrency(tick)}
            </text>
          </g>
        ))}

        {steps.map((step, i) => {
          const from = step.delta === null ? 0 : steps[i - 1]!.value;
          const top = Math.min(y(from), y(step.value));
          const height = Math.max(Math.abs(y(step.value) - y(from)), 2);
          const isTotal = step.delta === null;
          const isInflow = (step.delta ?? 0) >= 0;

          return (
            <g key={step.label}>
              <rect
                x={x(i)}
                y={top}
                width={barW}
                height={height}
                rx={2}
                fill={
                  isTotal
                    ? 'hsl(var(--finance-total))'
                    : isInflow
                      ? 'hsl(var(--finance-positive))'
                      : 'hsl(var(--finance-negative-surface))'
                }
              />
              {/* Verbindingslijn naar de volgende staaf, zodat de brug leesbaar blijft. */}
              {i < steps.length - 1 && (
                <line
                  x1={x(i)}
                  x2={x(i + 1) + barW}
                  y1={y(step.value)}
                  y2={y(step.value)}
                  stroke="hsl(var(--input))"
                  strokeDasharray="2 2"
                />
              )}
              <text
                x={x(i) + barW / 2}
                y={H - 24}
                textAnchor="middle"
                fontSize={11}
                fill="hsl(var(--muted-foreground))"
              >
                {step.label}
              </text>
              <text
                x={x(i) + barW / 2}
                y={H - 10}
                textAnchor="middle"
                fontSize={10}
                fill="hsl(var(--muted-foreground))"
              >
                {isTotal ? formatCurrency(step.value) : formatSigned(step.delta ?? 0, 'in')}
              </text>
            </g>
          );
        })}
      </svg>

      {showTable && (
        <table id="waterfall-tabel" className="mt-4 w-full text-sm">
          <caption className="sr-only">Opbouw van het eindsaldo</caption>
          <thead>
            <tr className="text-left text-muted-foreground">
              <th scope="col" className="font-medium py-1">Stap</th>
              <th scope="col" className="font-medium py-1">Mutatie</th>
              <th scope="col" className="font-medium py-1">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.label} className="border-t border-border">
                <td className="py-1">{step.label}</td>
                <td className="py-1 tabular-nums">
                  {step.delta === null ? '—' : formatSigned(step.delta, 'in')}
                </td>
                <td className="py-1 tabular-nums">{formatAmount(step.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
