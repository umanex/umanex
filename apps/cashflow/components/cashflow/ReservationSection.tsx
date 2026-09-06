'use client';

import { useState, useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { ReservationPotBalance, ReservationPayment, MonthKey, ReservationPotType } from '../../lib/cashflow/types';
import { formatAmount, getMonthLabel, limitDecimals, roundTo2 } from '../../lib/cashflow/recurring';
import { pendingOverrideDelta } from '../../lib/cashflow/subtotals';
import { SectionBar } from './SectionBar';

interface DeferredReservationDisplayItem {
  deferId: string;
  reservationId: string;
  label: string;
  amount: number;
  fromMonth: MonthKey;
}

interface ReservationSectionProps {
  monthKey: MonthKey;
  isCurrentMonth?: boolean;
  pots: ReservationPotBalance[];
  /** Stapbedragen van de twee ledger-regels, uit de calculator. */
  budgetAmount: number;
  provisionAmount: number;
  deferredReservationItems: DeferredReservationDisplayItem[];
  onRegisterPayment: (filterType: ReservationPotType) => void;
  onRemovePayment: (id: string) => void;
  onMovePayment: (id: string, newMonthKey: MonthKey) => void;
  onRemoveReservationDefer: (deferId: string) => void;
  onSettleReservation: (reservationId: string, effectiveAmount: number) => void;
  onRemoveReservationSettlement: (reservationId: string) => void;
  onFinalize: (reservationId: string, effectiveAmount: number) => void;
  onUnfinalize: (reservationId: string) => void;
  /** Afgesloten maand: alles staat vast, dus mag de filter niets verbergen. */
  locked?: boolean;
}

function nextMonthKey(monthKey: MonthKey): MonthKey {
  const parts = monthKey.split('-').map(Number);
  const year = parts[0] ?? 2000;
  const month = parts[1] ?? 1;
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`;
}

function DraggablePotRow({
  pot,
  index,
  monthKey,
  isCurrentMonth,
  onRemovePayment,
  onMovePayment,
  onSettle,
  onRemoveSettlement,
  onFinalize,
  onAmountChange,
}: {
  pot: ReservationPotBalance;
  index: number;
  monthKey: MonthKey;
  isCurrentMonth?: boolean;
  onRemovePayment: (id: string) => void;
  onMovePayment: (id: string, newMonthKey: MonthKey) => void;
  onSettle: (reservationId: string, effectiveAmount: number) => void;
  onRemoveSettlement: (reservationId: string) => void;
  onFinalize: (reservationId: string, effectiveAmount: number) => void;
  onAmountChange: (reservationId: string, amount: number | null) => void;
}) {
  const paidFromReservation = pot.paymentsThisMonth.reduce((s, p) => s + p.fromReservation, 0);
  const hasPayments = pot.paymentsThisMonth.length > 0;
  // Maandelijks budget mag ook zonder betalingen gefinaliseerd worden (besteed = 0);
  // spaardoel is finaliseerbaar zodra er betalingen zijn — het restsaldo wordt
  // bij finalisatie vrijgegeven en de opbouw herstart de maand erna.
  const canShowFinalize = pot.potType === 'maandelijks_budget' || hasPayments;
  const isBudgetCurrentMonth = pot.potType === 'maandelijks_budget' && isCurrentMonth;

  // De resterende provisie van deze maand: het budget minus wat er al uit de pot betaald is.
  // Een betaling kan de pot niet onder nul trekken (de betaalmodal capt `fromReservation` op
  // de potstand), dus is dit nooit negatief — het teveel vertrekt als cash-bijbetaling.
  const remaining = Math.max(
    0,
    pot.provisionThisMonth + pot.deferredFromPrevious - paidFromReservation,
  );

  // Het bedragveld toont bij een budget in de huidige maand de resterende provisie; bij elke
  // andere pot of maand de storting/het budget van die maand. Bewerken raakt altijd het
  // budget zelf — daarom wisselt het veld bij focus naar dat budget (zie `handleFocus`) en
  // valt het bij blur terug op de rustwaarde hieronder.
  const idleFieldValue = isBudgetCurrentMonth ? remaining : pot.provisionThisMonth;

  const [editing, setEditing] = useState(false);
  const [localAmount, setLocalAmount] = useState(String(roundTo2(idleFieldValue)));
  const inputRef = useRef<HTMLInputElement>(null);

  // Buiten het bewerken volgt het veld de opgeslagen waarde — zo daalt het resterende bedrag
  // meteen zodra er een betaling bijkomt. Tijdens het typen niet: dan zou een store-update de
  // cursor terugzetten.
  useEffect(() => {
    if (!editing) setLocalAmount(String(roundTo2(idleFieldValue)));
  }, [idleFieldValue, editing]);

  // De subregel van een spaardoel (of een budget in een latere maand) rekent met wat er op
  // dit moment in het veld staat — daar ís het veld de storting. Bij een budget in de huidige
  // maand toont het veld zelf al het resterende bedrag; de subregel toont er het brutobudget
  // naast (zie de render).
  const typedAmount = parseFloat(localAmount.replace(',', '.'));
  const pendingProvision =
    isNaN(typedAmount) || typedAmount < 0 ? pot.provisionThisMonth : typedAmount;
  const displayAmount = pendingProvision + pot.deferredFromPrevious - paidFromReservation;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `reservation-pot-${pot.reservationId}-${monthKey}`,
    data: {
      type: 'reservation-pot',
      id: pot.reservationId,
      sourceMonth: monthKey,
      label: pot.label,
      amount: pot.monthlyAmount,
    },
  });

  function handleFocus() {
    setEditing(true);
    // Een budget in de huidige maand toont in rust de resterende provisie; bewerken raakt het
    // budget zelf, dus wisselt het veld bij focus naar dat brutobudget.
    if (isBudgetCurrentMonth) setLocalAmount(String(roundTo2(pot.provisionThisMonth)));
    // Selecteren ná de re-render: de wissel hierboven is een state-update, dus op dit moment
    // staat de oude waarde nog in het veld en zou een directe `select()` die selecteren. Zonder
    // dit moet je het brutobudget eerst handmatig wissen, en typ je er anders doodleuk middenin.
    requestAnimationFrame(() => inputRef.current?.select());
  }

  function handleAmountBlur() {
    setEditing(false);
    const amt = parseFloat(localAmount.replace(',', '.'));
    onAmountChange(pot.reservationId, null);
    // Wat je typt is altijd het budget/de storting van die maand. Leeg, onleesbaar of
    // negatief valt terug op het begrote bedrag.
    const invalid = isNaN(amt) || amt < 0;
    const effectiveBudget = invalid ? pot.monthlyAmount : amt;
    // Display valt terug op de rustwaarde: bij een budget in de huidige maand het resterende
    // deel van het (nieuwe) budget, anders het budget/de storting zelf.
    const nextRemaining = Math.max(
      0,
      effectiveBudget + pot.deferredFromPrevious - paidFromReservation,
    );
    setLocalAmount(String(roundTo2(isBudgetCurrentMonth ? nextRemaining : effectiveBudget)));
    // Een afrekening ís het verschil met het begrote bedrag. Wie terugtypt naar dat bedrag
    // (of leeg/negatief laat) wil dus geen afrekening van dezelfde waarde, maar geen meer.
    if (invalid || Math.abs(effectiveBudget - pot.monthlyAmount) < 0.01) {
      if (pot.hasSettlement) onRemoveSettlement(pot.reservationId);
      return;
    }
    // Ongewijzigd t.o.v. wat er al staat: niets naar de store schrijven.
    if (Math.abs(effectiveBudget - pot.provisionThisMonth) < 0.01) return;
    onSettle(pot.reservationId, effectiveBudget);
  }

  function handleFinalize() {
    // Budget: effectiveAmount = besteed bedrag (prudente release van onbesteed budget).
    // Spaardoel: behoud de storting van deze maand — het restsaldo komt via de
    // calculator vrij, de storting zelf mag niet herschreven worden.
    const total = pot.paymentsThisMonth.reduce((s, p) => s + p.fromReservation, 0);
    onFinalize(
      pot.reservationId,
      pot.potType === 'maandelijks_budget' ? total : pot.effectiveAmount,
    );
  }

  const zebra = index % 2 !== 0;

  return (
    <div ref={setNodeRef} className={`${isDragging ? 'opacity-30' : ''}`}>
      {/* Pot hoofdrij — altijd label + beschikbare provisie */}
      <div className={`flex gap-2 pl-1 rounded-sm w-full items-start py-1 ${zebra ? 'bg-muted' : ''}`}>
        <button
          {...listeners}
          {...attributes}
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing text-sm leading-none select-none shrink-0 mt-0.5"
          aria-label="Versleep spaarpot bijdrage"
        >
          ⠿
        </button>

        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{pot.label}</span>
            {canShowFinalize && (
              <button
                onClick={handleFinalize}
                onPointerDown={(e) => e.stopPropagation()}
                className="text-xs text-primary underline whitespace-nowrap shrink-0"
              >
                Finaliseren →
              </button>
            )}
          </div>
          {isBudgetCurrentMonth ? (
            // Het veld toont hier de resterende provisie, de subregel het brutobudget. Die
            // staat er altijd, ook zolang beide gelijk zijn: verscheen hij pas bij de eerste
            // uitgave, dan dook hij op op exact het moment dat het veld begon af te wijken —
            // en dan moet je in één keer leren dat er twee bedragen zijn én dat ze verschillen.
            // De prijs is een korte dubbeling bij een onaangeroerd budget; dat weegt lichter.
            <div className="flex items-center gap-1">
              <span className="text-2xs text-muted-foreground opacity-70">Budget:</span>
              <span className="text-2xs font-semibold tabular-nums text-finance-positive">
                {formatAmount(pot.provisionThisMonth)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-2xs text-muted-foreground opacity-70">Provisie:</span>
              <span className={`text-2xs font-semibold tabular-nums ${displayAmount < 0 ? 'text-finance-negative' : 'text-finance-positive'}`}>
                {formatAmount(displayAmount)}
                {displayAmount < 0 && ' ⚠'}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={localAmount}
            onChange={(e) => {
              const v = limitDecimals(e.target.value);
              setLocalAmount(v);
              const parsed = parseFloat(v.replace(',', '.'));
              onAmountChange(pot.reservationId, isNaN(parsed) || parsed < 0 ? null : parsed);
            }}
            onFocus={handleFocus}
            onBlur={handleAmountBlur}
            onPointerDown={(e) => e.stopPropagation()}
            className={`w-[92px] h-7 px-2 text-dense text-right tabular-nums rounded-sm border border-input bg-background text-finance-deferred focus:outline-none focus:ring-1 focus:ring-ring ${
              pot.hasSettlement ? 'font-medium' : ''
            }`}
            aria-label={pot.potType === 'maandelijks_budget' ? 'Budget deze maand' : 'Stortingsbedrag'}
            // Bij een budget in de huidige maand wisselt het veld bij focus van het resterende
            // bedrag naar het budget. Zonder uitleg leest die sprong als een storing in plaats
            // van als "nu bewerk je het budget" — vandaar dat de tooltip het benoemt mét het
            // bedrag dat je te zien krijgt.
            title={
              isBudgetCurrentMonth
                ? `Bewerken past het budget aan — nu ${formatAmount(pot.provisionThisMonth)}`
                : undefined
            }
          />
          {pot.hasSettlement && (
            <span className="text-xs text-muted-foreground tabular-nums" title="Begroot bedrag">
              ({formatAmount(pot.monthlyAmount)})
            </span>
          )}
        </div>
      </div>

      {/* Betalingsdetails — enkel wanneer betalingen aanwezig */}
      {hasPayments && (
        <div className="pl-[22px] flex flex-col">
          {pot.paymentsThisMonth.map((payment, pi) => (
            <div
              key={payment.id}
              className={`flex flex-col gap-1 py-2 ${
                pi < pot.paymentsThisMonth.length - 1 ? 'border-b border-accent' : ''
              }`}
            >
              {/* Betalingslabel + verwijder/verplaats */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-foreground font-medium">{payment.label}</span>
                <button
                  onClick={() => onMovePayment(payment.id, nextMonthKey(monthKey))}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground transition-colors text-xs leading-none"
                  title="Verplaats naar volgende maand"
                >
                  →
                </button>
                <button
                  onClick={() => onRemovePayment(payment.id)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-destructive transition-colors text-xs leading-none"
                  aria-label="Verwijder betaling"
                >
                  ×
                </button>
              </div>
              {/* Betaald · Provisie · Cash */}
              <div className="flex items-center gap-2 text-2xs">
                {payment.fromCash === 0 ? (
                  <span className="text-finance-positive font-semibold tabular-nums">
                    {formatAmount(payment.invoiceAmount)} betaald met provisie
                  </span>
                ) : (
                  <>
                    <span className="text-muted-foreground opacity-70">Betaald:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatAmount(payment.invoiceAmount)}</span>
                    {payment.fromReservation > 0 && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-muted-foreground opacity-70">Provisie:</span>
                        <span className="font-semibold text-finance-positive tabular-nums">{formatAmount(payment.fromReservation)}</span>
                      </>
                    )}
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-muted-foreground opacity-70">Cash:</span>
                    <span className="font-semibold text-finance-negative tabular-nums">{formatAmount(payment.fromCash)}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PotSubgroup({
  label,
  potType,
  activePots,
  finalizedPots,
  amount,
  monthKey,
  isCurrentMonth,
  overrideAmounts,
  onRegisterPayment,
  onRemovePayment,
  onMovePayment,
  onSettleReservation,
  onRemoveReservationSettlement,
  onFinalize,
  onUnfinalize,
  onAmountChange,
  locked,
}: {
  label: string;
  potType: ReservationPotType;
  activePots: ReservationPotBalance[];
  finalizedPots: ReservationPotBalance[];
  amount: number;
  monthKey: MonthKey;
  isCurrentMonth: boolean;
  overrideAmounts: Record<string, number>;
  onRegisterPayment: (filterType: ReservationPotType) => void;
  onRemovePayment: (id: string) => void;
  onMovePayment: (id: string, newMonthKey: MonthKey) => void;
  onSettleReservation: (reservationId: string, effectiveAmount: number) => void;
  onRemoveReservationSettlement: (reservationId: string) => void;
  onFinalize: (reservationId: string, effectiveAmount: number) => void;
  onUnfinalize: (reservationId: string) => void;
  onAmountChange: (reservationId: string, amount: number | null) => void;
  locked?: boolean;
}) {
  const [showFinalized, setShowFinalized] = useState(false);
  // Zie RecurringSection: in een afgesloten maand is de filterknop uitgeschakeld, dus mag
  // hij de gefinaliseerde potten niet verborgen houden.
  const showAll = locked || showFinalized;
  // Het bedrag komt uit de calculator; alleen wat je op dit moment aan het typen bent
  // — nog niet opgeslagen — wordt er lokaal bovenop gelegd, zodat de kop meebeweegt.
  const subtotaal = amount + pendingOverrideDelta(activePots, overrideAmounts, isCurrentMonth);

  if (activePots.length === 0 && finalizedPots.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 w-full">
      <SectionBar
        label={label}
        amount={subtotaal}
        showPaid={finalizedPots.length > 0 ? showAll : undefined}
        onFilterToggle={finalizedPots.length > 0 ? () => setShowFinalized((v) => !v) : undefined}
        onAdd={() => onRegisterPayment(potType)}
        addAriaLabel="Betaling registreren"
      />

      <div className="flex flex-col gap-1 w-full">
        {activePots.map((pot, index) => (
          <DraggablePotRow
            key={pot.reservationId}
            pot={pot}
            index={index}
            monthKey={monthKey}
            isCurrentMonth={isCurrentMonth}
            onRemovePayment={onRemovePayment}
            onMovePayment={onMovePayment}
            onSettle={onSettleReservation}
            onRemoveSettlement={onRemoveReservationSettlement}
            onFinalize={onFinalize}
            onAmountChange={onAmountChange}
          />
        ))}

        {showAll &&
          finalizedPots.map((pot, index) => (
            <div
              key={pot.reservationId}
              className={`flex items-center gap-2 h-7 pl-1 rounded-sm w-full opacity-50 ${
                (activePots.length + index) % 2 !== 0 ? 'bg-muted' : ''
              }`}
            >
              <span className="flex-1 text-sm truncate min-w-0">{pot.label}</span>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {formatAmount(pot.effectiveAmount)} / {formatAmount(pot.monthlyAmount)}
              </span>
              <button
                onClick={() => onUnfinalize(pot.reservationId)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0"
                title="Finalisatie opheffen"
              >
                ↩
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

export function ReservationSection({
  monthKey,
  isCurrentMonth = false,
  pots,
  budgetAmount,
  provisionAmount,
  deferredReservationItems,
  onRegisterPayment,
  onRemovePayment,
  onMovePayment,
  onRemoveReservationDefer,
  onSettleReservation,
  onRemoveReservationSettlement,
  onFinalize,
  onUnfinalize,
  locked,
}: ReservationSectionProps) {
  const [overrideAmounts, setOverrideAmounts] = useState<Record<string, number>>({});

  function handleAmountChange(reservationId: string, amount: number | null) {
    setOverrideAmounts((prev) => {
      if (amount === null) {
        const next = { ...prev };
        delete next[reservationId];
        return next;
      }
      return { ...prev, [reservationId]: amount };
    });
  }

  const budgetActive = pots.filter((p) => !p.finalized && p.potType === 'maandelijks_budget');
  const budgetFinalized = pots.filter((p) => p.finalized && p.potType === 'maandelijks_budget');
  // De bufferpot hoort niet in de ledger: zijn storting is geen beslissing die je hier
  // neemt maar het saldo dat na alle andere posten overblijft. Zijn stand zit in de bufferregel van de footer.
  const spaardoelActive = pots.filter(
    (p) => !p.finalized && p.potType === 'spaardoel' && !p.isDeficitBuffer,
  );
  const spaardoelFinalized = pots.filter(
    (p) => p.finalized && p.potType === 'spaardoel' && !p.isDeficitBuffer,
  );

  const hasContent =
    budgetActive.length > 0 || budgetFinalized.length > 0 ||
    spaardoelActive.length > 0 || spaardoelFinalized.length > 0 ||
    deferredReservationItems.length > 0;

  if (!hasContent) return null;

  const sharedProps = {
    monthKey,
    isCurrentMonth,
    overrideAmounts,
    onRegisterPayment,
    onRemovePayment,
    onMovePayment,
    onSettleReservation,
    onRemoveReservationSettlement,
    onFinalize,
    onUnfinalize,
    onAmountChange: handleAmountChange,
    locked,
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <PotSubgroup
        label="Maandelijkse budgetten"
        potType="maandelijks_budget"
        activePots={budgetActive}
        finalizedPots={budgetFinalized}
        amount={budgetAmount}
        {...sharedProps}
      />
      <PotSubgroup
        label="Provisies"
        potType="spaardoel"
        activePots={spaardoelActive}
        finalizedPots={spaardoelFinalized}
        amount={provisionAmount}
        {...sharedProps}
      />

      {deferredReservationItems.map((d, index) => (
        <div key={d.deferId} className={`flex items-center gap-2 h-7 pl-1 rounded-sm w-full ${index % 2 !== 0 ? 'bg-muted' : ''}`}>
          <span className="flex-1 text-sm truncate min-w-0">
            <span className="text-finance-deferred">{d.label}</span>
            {' '}
            <span className="text-xs text-finance-deferred">
              (uitgesteld van {getMonthLabel(d.fromMonth)})
            </span>
          </span>
          <span className="text-sm font-medium text-finance-deferred tabular-nums shrink-0">
            -{formatAmount(d.amount)}
          </span>
          <button
            onClick={() => onRemoveReservationDefer(d.deferId)}
            className="text-finance-deferred hover:text-finance-deferred-strong transition-colors text-sm leading-none shrink-0"
            aria-label="Uitstelling ongedaan maken"
          >
            ↩
          </button>
        </div>
      ))}
    </div>
  );
}
