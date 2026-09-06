import { calculateMonths, computeAnchorState } from '../lib/cashflow/calculator';
import type { AnchorState } from '../lib/cashflow/calculator';
import { bufferSummary } from '../lib/cashflow/buffer';
import { bufferSeries, computeRunway } from '../lib/cashflow/analysis';
import { netBurn } from '../lib/cashflow/burn';
import { buildSnapshot, snapshotMap } from '../lib/cashflow/snapshot';
import type {
  ExpenseItem,
  IncomeItem,
  MonthData,
  RecurringItem,
  RecurringSettlement,
  ReservationItem,
  ReservationPayment,
  ReservationPotBalance,
  ReservationSettlement,
} from '../lib/cashflow/types';

let failures = 0;
let checks = 0;

function near(a: number, b: number, tol = 0.005): boolean {
  return Math.abs(a - b) < tol;
}

function check(name: string, actual: number, expected: number) {
  checks++;
  if (!near(actual, expected)) {
    failures++;
    console.log(`  FAIL  ${name}: verwacht ${expected.toFixed(2)}, kreeg ${actual.toFixed(2)}`);
  } else {
    console.log(`  ok    ${name} = ${actual.toFixed(2)}`);
  }
}

function checkBool(name: string, actual: boolean, expected: boolean) {
  checks++;
  if (actual !== expected) {
    failures++;
    console.log(`  FAIL  ${name}: verwacht ${expected}, kreeg ${actual}`);
  } else {
    console.log(`  ok    ${name} = ${actual}`);
  }
}

/**
 * Onafhankelijke herberekening van het eindsaldo uit de rauwe maanddata — de toetssteen
 * voor `lib/cashflow/subtotals.ts`. Leest bewust niet `m.subtotals`, anders zou de check
 * de implementatie tegen zichzelf houden.
 *
 * Ankermaand: het beginsaldo is het echte banksaldo, dus een betaalde kost is er al af en
 * de tot dan opgebouwde potten zitten er nog in. Latere maanden: het beginsaldo is een
 * projectie, dus vertrekt élke kost — betaald gemarkeerd of niet — en is de opbouw in een
 * eerdere maand al afgetrokken.
 */
function recomputeEindsaldo(m: MonthData, isFirst: boolean): number {
  const paidFromPot = (p: ReservationPotBalance) =>
    p.paymentsThisMonth.reduce((s, pay) => s + pay.fromReservation, 0);

  const recurring =
    m.recurringItems.reduce((s, item) => {
      const settlement = m.recurringSettlements.find((st) => st.recurringId === item.id);
      if (settlement?.paid) return isFirst ? s : s + settlement.actualAmount;
      return s + (item.frequency === 'yearly' ? item.amount / 12 : item.amount);
    }, 0) +
    m.deferredItems.reduce((s, d) => {
      if (d.paid) return isFirst ? s : s + d.paidAmount;
      return s + d.amount;
    }, 0);

  const expenses = m.expenseItems.reduce((s, i) => (i.paid && isFirst ? s : s + i.amount), 0);

  // Ankermaand: een geregistreerde bijbetaling is al van het banksaldo af, net als een
  // betaalde kost. Latere maanden vertrekken van een projectie waar nog niets van betaald
  // is, dus telt élke bijbetaling daar wel.
  const cash = isFirst ? 0 : m.reservationPayments.reduce((s, pay) => s + pay.fromCash, 0);

  // Een budget is een inschatting: in de ankermaand resteert wat je nog niet opmaakte,
  // in een latere maand staat de volledige inschatting nog te vertrekken. Wat er nog te
  // besteden valt kan niet minder dan niets zijn — een budget onder wat er al uit betaald
  // is, geeft geen geld terug.
  const budgets = m.reservationPots
    .filter((p) => p.potType === 'maandelijks_budget' && (!isFirst || !p.finalized))
    .reduce(
      (s, p) => s + (isFirst ? Math.max(0, p.provisionThisMonth - paidFromPot(p)) : p.provisionThisMonth),
      0,
    );

  // Ankermaand: wat er aan het einde van de maand nog in de potten vastzit, en dat kan
  // niet minder dan niets zijn. Latere maanden: de storting van die maand, plus wat een
  // betaling méér opnam dan de pot kon dragen — dat kwam van de rekening.
  const provisions =
    m.reservationPots
      .filter((p) => p.potType === 'spaardoel' && (!isFirst || !p.finalized))
      .reduce((s, p) => {
        const beschikbaar = p.deferredFromPrevious + p.provisionThisMonth;
        return (
          s +
          (isFirst
            ? Math.max(0, beschikbaar - paidFromPot(p))
            : p.provisionThisMonth -
              p.releasedThisMonth +
              Math.max(0, paidFromPot(p) - beschikbaar))
        );
      }, 0) + m.deferredReservationItems.reduce((s, d) => s + d.amount, 0);

  return (m.startBalance + m.totalIncome) - (recurring + expenses + cash + budgets + provisions);
}

type Scenario = {
  anchor: string;
  startBalance: number;
  income: Array<[string, number]>;
  recurring: Array<[string, number]>;
  expenses?: Array<[string, number, boolean]>;
  reservations: ReservationItem[];
  count?: number;
};

function run(s: Scenario): MonthData[] {
  const incomeItems: IncomeItem[] = s.income.map(([monthKey, amount], i) => ({
    id: `inc-${i}`, monthKey, label: `inkomen ${i}`, amount, received: false,
  }));
  const recurringItems: RecurringItem[] = s.recurring.map(([startMonth, amount], i) => ({
    id: `rec-${i}`, label: `vaste kost ${i}`, amount, type: 'expense', frequency: 'monthly', startMonth,
  }));
  const expenseItems: ExpenseItem[] = (s.expenses ?? []).map(([monthKey, amount, paid], i) => ({
    id: `exp-${i}`, monthKey, label: `uitgave ${i}`, amount, paid,
  }));
  return calculateMonths(
    s.anchor, s.startBalance, expenseItems, incomeItems, recurringItems,
    s.reservations, [], [], [], [], [], s.count ?? 3,
  );
}

function bufferPot(m: MonthData) {
  return m.reservationPots.find((p) => p.isDeficitBuffer);
}

function invariant(months: MonthData[], label: string) {
  months.forEach((m, i) => {
    check(`${label} · eindsaldo-invariant ${m.monthKey}`, recomputeEindsaldo(m, i === 0), m.endBalance);
    // De kaart toont `subtotals`; die moet hetzelfde getal geven als de doorrol.
    check(`${label} · kaart == doorrol ${m.monthKey}`, m.subtotals.endBalance, m.endBalance);
    // De buffer is uit `provisions` gelicht maar zit nog wél in `costs` — anders zou de
    // doorrol een storting missen die het geld wel degelijk van het vrije saldo haalt.
    const { recurring, oneOff, budgets, provisions, buffer, costs } = m.subtotals;
    check(`${label} · kostenkoppen ${m.monthKey}`, recurring + oneOff + budgets + provisions + buffer, costs);
    // Wat de ledger zichtbaar toont, is het maandresultaat vóór buffer: dat gaat naar de
    // pot, op het niet-gedekte restant na.
    const zichtbaar = m.subtotals.incoming - recurring - oneOff - budgets - provisions;
    check(`${label} · zichtbaar == buffer + eindsaldo ${m.monthKey}`, zichtbaar, buffer + m.endBalance);
    // De footer leest `bufferSummary`; die delta moet de potbeweging van de maand zijn.
    const b = bufferSummary(m);
    const potten = m.reservationPots.filter((p) => p.isDeficitBuffer);
    check(`${label} · buffer-delta ${m.monthKey}`, b.delta,
      potten.reduce((s, p) => s + p.potBalance - p.deferredFromPrevious, 0));
    check(`${label} · buffer-totaal ${m.monthKey}`, b.total,
      potten.reduce((s, p) => s + p.potBalance, 0));

    // De footer toont sinds 2026-09-06 niet de pot maar de positie: potstand plus vrij
    // saldo. De pot alleen is €0 in precies de maanden waarin je er slecht voor staat,
    // want de opname is begrensd tot wat erin zit.
    // `uncovered` is dan hetzelfde getal met omgekeerd teken — de regel "Niet gedekt"
      // was een tweede naam voor een negatieve positie, en is daarom uit de footer weg.
      // Alleen zolang de pot zelf niet negatief staat: dat is een andere faalklasse
    // (een betaling groter dan de pot, zie S10) en geen door de buffer gedekt tekort.
    if (b.present && b.total > -0.005) {
      check(`${label} · positie == −niet gedekt ${m.monthKey}`, Math.min(b.position, 0), -b.uncovered);
    }
    // `movement` komt uit `netBurn` (stromen), de positie uit de potstand en de doorrol.
    // Twee onafhankelijke wegen naar hetzelfde getal — in de ankermaand niet te nemen,
    // want `startBalance` is daar het banksaldo mét de potten erin. Geldt óók in een maand
    // zonder bufferpot: dan is het vrije saldo de hele positie.
    if (i > 0) {
      check(`${label} · beweging == positieverschil ${m.monthKey}`, b.movement,
        (potten.reduce((s, p) => s + p.potBalance, 0) + m.endBalance) -
        (potten.reduce((s, p) => s + p.deferredFromPrevious, 0) + m.startBalance));
    }
  });
  // Doorrol: eindsaldo maand N == startsaldo maand N+1
  for (let i = 0; i < months.length - 1; i++) {
    check(`${label} · doorrol ${months[i]!.monthKey}→${months[i + 1]!.monthKey}`,
      months[i + 1]!.startBalance, months[i]!.endBalance);
    // Wat de footer van maand N+1 toont, moet de positie van maand N zijn plus wat die
    // maand beweegt. Dit is de invariant over het hele venster: fixt iemand later één
    // kolom, dan valt hier op dat de reeks niet meer sluit.
    const vorige = bufferSummary(months[i]!);
    const nu = bufferSummary(months[i + 1]!);
    check(`${label} · positie-doorrol ${months[i]!.monthKey}→${months[i + 1]!.monthKey}`,
      nu.position - vorige.position, nu.movement);
  }
}

const BUFFER: ReservationItem = {
  id: 'buffer', label: 'Buffer', monthlyAmount: 200, startMonth: '2025-01', type: 'spaardoel', coversDeficit: true,
};
const BUFFER_OFF: ReservationItem = { ...BUFFER, coversDeficit: false };

// ── S1: geen buffer gemarkeerd → gedrag ongewijzigd ─────────────────────────────
console.log('\nS1 — geen buffer gemarkeerd (regressie-baseline)');
{
  const cfg: Scenario = {
    anchor: '2026-03', startBalance: 3000,
    income: [['2026-03', 2000], ['2026-04', 2000], ['2026-05', 2000]],
    recurring: [['2025-01', 2400]],
    reservations: [BUFFER_OFF],
  };
  const off = run(cfg);
  checkBool('S1 · geen pot gemarkeerd als buffer', off.every((m) => !bufferPot(m)), true);
  checkBool('S1 · geen coverage', off.every((m) => m.reservationPots.every((p) => p.autoContribution === null)), true);
  invariant(off, 'S1');
}

// ── S2: tekort met ruime pot → eindsaldo exact 0 ────────────────────────────────
// Historische pot t/m 2026-02: startMonth 2025-01 → 14 maanden × 200 = 2800.
console.log('\nS2 — tekort, pot ruim voldoende');
{
  const months = run({
    anchor: '2026-03', startBalance: 3000,
    income: [['2026-03', 1000]],
    recurring: [['2025-01', 1500]],
    reservations: [BUFFER],
    count: 1,
  });
  const m0 = months[0]!;
  const p = bufferPot(m0)!;
  // E(0) maand 0 = 3000 + 1000 − 1500 − (2800 + 0) = −300 → coverage −300
  check('S2 · coverage', p.autoContribution!, -300);
  check('S2 · eindsaldo', m0.endBalance, 0);
  check('S2 · uncovered', p.deficitUncovered, 0);
  invariant(months, 'S2');
}

// ── S3: tekort groter dan pot → begrensd, rest blijft rood ──────────────────────
console.log('\nS3 — tekort groter dan potsaldo');
{
  const smallBuffer: ReservationItem = { ...BUFFER, monthlyAmount: 50, startMonth: '2026-01' };
  // Historisch t/m 2026-02: 2 maanden × 50 = 100
  const months = run({
    anchor: '2026-03', startBalance: 1000,
    income: [['2026-03', 1000]],
    recurring: [['2025-01', 2500]],
    reservations: [smallBuffer],
    count: 1,
  });
  const m0 = months[0]!;
  const p = bufferPot(m0)!;
  // E(0) = 1000 + 1000 − 2500 − 100 = −600, cap = −100 → coverage −100, eind = −500
  check('S3 · coverage begrensd tot potsaldo', p.autoContribution!, -100);
  check('S3 · eindsaldo blijft negatief', m0.endBalance, -500);
  check('S3 · uncovered', p.deficitUncovered, 500);
  check('S3 · potsaldo landt op 0', p.provisionThisMonth + p.deferredFromPrevious, 0);
  invariant(months, 'S3');
}

// ── S4: overschot → alles naar de buffer, eindsaldo 0 ───────────────────────────
console.log('\nS4 — overschot wordt volledig opgenomen');
{
  const months = run({
    anchor: '2026-03', startBalance: 10000,
    income: [['2026-03', 3000]],
    recurring: [['2025-01', 1000]],
    reservations: [BUFFER],
    count: 1,
  });
  const m0 = months[0]!;
  const p = bufferPot(m0)!;
  // E(0) = 10000 + 3000 − 1000 − 2800 = 9200 → dat is de storting. Het maandbedrag van
  // 200 speelt geen rol meer.
  check('S4 · storting is het volledige overschot', p.autoContribution!, 9200);
  check('S4 · eindsaldo landt op 0', m0.endBalance, 0);
  check('S4 · potstand', p.potBalance, 12000);
  check('S4 · buffer-delta', bufferSummary(m0).delta, 9200);
  check('S4 · uncovered', p.deficitUncovered, 0);
  invariant(months, 'S4');
}

// ── S5: meerdere maanden — pot depleteert, blijft nooit negatief ────────────────
console.log('\nS5 — meerdere tekortmaanden op rij');
{
  const months = run({
    anchor: '2026-03', startBalance: 3000,
    income: [['2026-03', 1000], ['2026-04', 1000], ['2026-05', 1000], ['2026-06', 1000]],
    recurring: [['2025-01', 1800]],
    reservations: [BUFFER],
    count: 4,
  });
  months.forEach((m) => {
    const p = bufferPot(m)!;
    const potNa = p.deferredFromPrevious + p.provisionThisMonth;
    console.log(
      `  maand ${m.monthKey}: start ${m.startBalance.toFixed(2)} · storting ${p.autoContribution === null ? '—' : p.autoContribution.toFixed(2)}` +
      ` · pot voor ${p.deferredFromPrevious.toFixed(2)} → na ${potNa.toFixed(2)} · eind ${m.endBalance.toFixed(2)}`,
    );
    checks++;
    if (potNa < -0.005) { failures++; console.log(`  FAIL  potsaldo negatief in ${m.monthKey}`); }
    else console.log(`  ok    potsaldo niet-negatief in ${m.monthKey}`);
  });
  // Pot: 2800 − 600 → 2200 − 800 → 1400 − 800 → 600, en dan is 800 te veel.
  check('S5 · pot na maand 3', bufferPot(months[2]!)!.potBalance, 600);
  check('S5 · laatste maand put de pot leeg', bufferPot(months[3]!)!.potBalance, 0);
  check('S5 · restant blijft rood', months[3]!.endBalance, -200);
  check('S5 · uncovered', bufferPot(months[3]!)!.deficitUncovered, 200);
  invariant(months, 'S5');
}

// ── S6: maand 0 en latere maand geven hetzelfde bij identieke situatie ──────────
console.log('\nS6 — maand 0 vs latere maand, identieke situatie');
{
  // Pot start pas in de ankermaand, dus geen historische pot; maand 0 en maand 1
  // hebben dan dezelfde structuur op de doorgerolde balans na.
  const fresh: ReservationItem = { ...BUFFER, startMonth: '2026-03' };
  const months = run({
    anchor: '2026-03', startBalance: 1000,
    income: [['2026-03', 1000], ['2026-04', 1000]],
    recurring: [['2025-01', 1500]],
    reservations: [fresh],
    count: 2,
  });
  const [m0, m1] = months as [MonthData, MonthData];
  // m0: E(0) = 1000 + 1000 − 1500 − 0 = 500 → alles naar de pot, eindsaldo 0
  check('S6 · m0 storting', bufferPot(m0)!.autoContribution!, 500);
  check('S6 · m0 eindsaldo', m0.endBalance, 0);
  // m1: start 0, E(0) = 0 + 1000 − 1500 = −500 → opname −500 uit de pot van 500 → eind 0
  check('S6 · m1 opname', bufferPot(m1)!.autoContribution!, -500);
  check('S6 · m1 eindsaldo', m1.endBalance, 0);
  check('S6 · pot leeg na m1', bufferPot(m1)!.potBalance, 0);
  invariant(months, 'S6');
}

// ── S7: klein overschot — het maandbedrag speelt geen rol meer ─────────────────
console.log('\nS7 — overschot kleiner dan het oude maandbedrag');
{
  const fresh: ReservationItem = { ...BUFFER, startMonth: '2026-03', monthlyAmount: 200 };
  const months = run({
    anchor: '2026-03', startBalance: 1000,
    income: [['2026-03', 1000]],
    recurring: [['2025-01', 1950]],
    reservations: [fresh],
    count: 1,
  });
  const m0 = months[0]!;
  const p = bufferPot(m0)!;
  // E(0) = 1000 + 1000 − 1950 = 50 → dat is de storting, niet de begrote 200.
  check('S7 · storting is het overschot', p.autoContribution!, 50);
  check('S7 · eindsaldo', m0.endBalance, 0);
  check('S7 · uncovered', p.deficitUncovered, 0);
  invariant(months, 'S7');
}

// ── S8: buffer naast een tweede spaardoel — enkel de buffer beweegt ─────────────
console.log('\nS8 — buffer naast een gewoon spaardoel');
{
  const ander: ReservationItem = {
    id: 'vakantie', label: 'Vakantie', monthlyAmount: 100, startMonth: '2026-03', type: 'spaardoel',
  };
  const fresh: ReservationItem = { ...BUFFER, startMonth: '2026-03' };
  const months = run({
    anchor: '2026-03', startBalance: 1000,
    income: [['2026-03', 1000]],
    recurring: [['2025-01', 2000]],
    reservations: [fresh, ander],
    count: 1,
  });
  const m0 = months[0]!;
  const buf = bufferPot(m0)!;
  const other = m0.reservationPots.find((p) => p.reservationId === 'vakantie')!;
  // Pot start deze maand op 0 → er valt niets op te nemen; er gaat ook niets in.
  // E(0) = 1000 + 1000 − 2000 − 100 (vakantie) = −100, cap = 0 → storting 0, eind −100.
  check('S8 · begrensd tot lege pot', buf.autoContribution!, 0);
  check('S8 · ander spaardoel ongemoeid', other.provisionThisMonth, 100);
  checkBool('S8 · ander spaardoel niet automatisch', other.autoContribution === null, true);
  check('S8 · vakantie blijft in provisies', m0.subtotals.provisions, 100);
  check('S8 · buffer heeft eigen kop', m0.subtotals.buffer, 0);
  check('S8 · eindsaldo', m0.endBalance, -100);
  check('S8 · uncovered', buf.deficitUncovered, 100);
  invariant(months, 'S8');
}

// ── S8b: buffer mét opgebouwd saldo naast een gewoon spaardoel ─────────────────
console.log('\nS8b — buffer met saldo naast een gewoon spaardoel');
{
  const ander: ReservationItem = {
    id: 'vakantie', label: 'Vakantie', monthlyAmount: 100, startMonth: '2026-03', type: 'spaardoel',
  };
  const months = run({
    anchor: '2026-03', startBalance: 3000,
    income: [['2026-03', 1000]],
    recurring: [['2025-01', 2000]],
    reservations: [BUFFER, ander],
    count: 1,
  });
  const m0 = months[0]!;
  const buf = bufferPot(m0)!;
  const other = m0.reservationPots.find((p) => p.reservationId === 'vakantie')!;
  // E(0) = 3000 + 1000 − 2000 − 2800 (bufferpot) − 100 (vakantie) = −900, pot 2800 → opname −900
  check('S8b · buffer opname', buf.autoContribution!, -900);
  check('S8b · ander spaardoel ongemoeid', other.provisionThisMonth, 100);
  check('S8b · eindsaldo', m0.endBalance, 0);
  check('S8b · potsaldo na opname', buf.deferredFromPrevious + buf.autoContribution!, 1900);
  // De ankermaand trekt de volledige pot uit het banksaldo, dus is de buffer-kop de
  // stand ná opname — de footer toont daarnaast de beweging van −900.
  check('S8b · buffer-kop in subtotals', m0.subtotals.buffer, 1900);
  check('S8b · buffer-delta', bufferSummary(m0).delta, -900);
  invariant(months, 'S8b');
}

// ── S9: betaling uit de bufferpot in dezelfde maand — cap houdt er rekening mee ──
console.log('\nS9 — betaling uit de bufferpot in de tekortmaand');
{
  const buf: ReservationItem = { ...BUFFER, monthlyAmount: 200, startMonth: '2026-05' };
  // Pot t/m 2026-07: 3 maanden × 200 = 600
  const months = calculateMonths(
    '2026-08', 0,
    [{ id: 'e1', monthKey: '2026-08', label: 'kost', amount: 500, paid: false }],
    [], [], [buf],
    [{ id: 'pay1', reservationId: 'buffer', monthKey: '2026-08', label: 'factuur', invoiceAmount: 300, fromReservation: 300, fromCash: 0 }],
    [], [], [], [], 3,
  );
  const m0 = months[0]!;
  const p = bufferPot(m0)!;
  // Beschikbaar = 600 − 300 betaald = 300 → opname max −300, pot landt op 0
  check('S9 · opname begrensd door betaling', p.autoContribution!, -300);
  check('S9 · potsaldo niet negatief', p.potBalance, 0);
  checkBool('S9 · potsaldo blijft ≥ 0 in latere maanden',
    months.every((m) => (bufferPot(m)?.potBalance ?? 0) >= -0.005), true);
  invariant(months, 'S9');
}

// ── S10: overtrokken pot leent niets uit ───────────────────────────────────────
console.log('\nS10 — overtrokken pot mag de maand niet verslechteren');
{
  const buf: ReservationItem = { ...BUFFER, monthlyAmount: 100, startMonth: '2026-01' };
  const months = calculateMonths(
    '2026-04', 500,
    [{ id: 'e1', monthKey: '2026-04', label: 'kost', amount: 1000, paid: false }],
    [], [], [buf],
    [{ id: 'pay1', reservationId: 'buffer', monthKey: '2026-02', label: 'factuur', invoiceAmount: 500, fromReservation: 500, fromCash: 0 }],
    [], [], [], [], 1,
  );
  const zonder = calculateMonths(
    '2026-04', 500,
    [{ id: 'e1', monthKey: '2026-04', label: 'kost', amount: 1000, paid: false }],
    [], [], [{ ...buf, coversDeficit: false }],
    [{ id: 'pay1', reservationId: 'buffer', monthKey: '2026-02', label: 'factuur', invoiceAmount: 500, fromReservation: 500, fromCash: 0 }],
    [], [], [], [], 1,
  );
  const m0 = months[0]!;
  const p = bufferPot(m0)!;
  // Pot staat op −200 (betaling groter dan de opbouw): er valt niets uit te lenen, dus
  // blijft de storting op 0 in plaats van de pot verder onder water te duwen.
  check('S10 · lege pot leent niets uit', p.autoContribution!, 0);
  checkBool('S10 · buffer maakt het niet slechter', m0.endBalance >= zonder[0]!.endBalance - 0.005, true);
  invariant(months, 'S10');
}

// ── S11: ankermaand schuift op — potstand mag niet heropleven ───────────────────
console.log('\nS11 — doorrol over de ankermaand heen (P0-regressie)');
{
  const buf: ReservationItem = { ...BUFFER, monthlyAmount: 400, startMonth: '2025-10' };
  const expenses: ExpenseItem[] = [{ id: 'e1', monthKey: '2026-01', label: 'kost', amount: 900, paid: false }];

  const anchorState = (anchor: string, pots: ReservationItem[]) =>
    computeAnchorState(1000, '2026-01', anchor, expenses, [], [], pots, [], [], [], [], [], []);
  const window = (anchor: string, pots: ReservationItem[], state: AnchorState) =>
    calculateMonths(anchor, state.startBalance, expenses, [], [], pots, [], [], [], [], [], 2, state.potBalances);

  // Zicht vanaf januari: pot 1200 in, opname −1100, eindsaldo 0, pot 100 over.
  const jan = anchorState('2026-01', [buf]);
  const janMonths = window('2026-01', [buf], jan);
  const janBuf = bufferPot(janMonths[0]!)!;
  check('S11 · januari opname', janBuf.autoContribution!, -1100);
  check('S11 · januari eindsaldo', janMonths[0]!.endBalance, 0);
  check('S11 · pot na januari', janBuf.potBalance, 100);

  // Eén maand later schuift het anker op zonder dat er data verandert.
  const feb = anchorState('2026-02', [buf]);
  check('S11 · banksaldo bij start februari', feb.startBalance, 100);
  check('S11 · potstand bij start februari', feb.potBalances.get('buffer') ?? -1, 100);

  // Controle: zonder buffer moeten beide vensters ook overeenkomen (bestaand gedrag).
  const off: ReservationItem[] = [{ ...buf, coversDeficit: false }];
  const janOff = anchorState('2026-01', off);
  const janOffMonths = window('2026-01', off, janOff);
  const febOff = anchorState('2026-02', off);
  check('S11 · controle zonder buffer', febOff.startBalance, janOffMonths[0]!.endBalance
    + (janOffMonths[1]!.reservationPots.find((p) => p.reservationId === 'buffer')?.deferredFromPrevious ?? 0));
}

// ── S12: uitgestelde storting die toekomt telt mee in de potstand ───────────────
console.log('\nS12 — uitgestelde storting crediteert de pot');
{
  const pot: ReservationItem = {
    id: 'auto', label: 'Auto', monthlyAmount: 100, startMonth: '2026-03', type: 'spaardoel',
  };
  const months = calculateMonths(
    '2026-03', 5000, [], [], [], [pot], [], [], [],
    [{ id: 'd1', reservationId: 'auto', fromMonth: '2026-03', toMonth: '2026-04' }],
    [], 3,
  );
  const april = months[1]!;
  const mei = months[2]!;
  const aprilPot = april.reservationPots.find((p) => p.reservationId === 'auto');
  const meiPot = mei.reservationPots.find((p) => p.reservationId === 'auto')!;
  // April: eigen storting 100 + uitgestelde 100 → pot 200, dus mei start op 200.
  check('S12 · pot in april', aprilPot?.potBalance ?? 0, 200);
  check('S12 · overgedragen naar mei', meiPot.deferredFromPrevious, 200);
  invariant(months, 'S12');
}

// ── S13: betaald gemarkeerd in een toekomstige maand telt tóch als kost ─────────
console.log('\nS13 — betaalde post in een toekomstige maand');
{
  const huur: RecurringItem = {
    id: 'huur', label: 'Huur', amount: 500, type: 'expense', frequency: 'monthly', startMonth: '2026-03',
  };

  // April staat als betaald gemarkeerd. Het geld moet nog steeds vertrekken: het
  // beginsaldo van april is een projectie waar niets van afgetrokken is.
  const later: RecurringSettlement[] = [
    { id: 's1', recurringId: 'huur', monthKey: '2026-04', paid: true, actualAmount: 500 },
  ];
  const months = calculateMonths('2026-03', 5000, [], [], [huur], [], [], [], later, [], [], 3);
  check('S13 · eindsaldo april', months[1]!.endBalance, 4000);
  check('S13 · kaart toont hetzelfde', months[1]!.subtotals.endBalance, 4000);
  check('S13 · beginsaldo mei', months[2]!.startBalance, 4000);
  invariant(months, 'S13');

  // Spiegelbeeld: in de ankermaand is een betaalde kost al van het banksaldo af en mag
  // ze er niet nog eens af.
  const anchor: RecurringSettlement[] = [
    { id: 's2', recurringId: 'huur', monthKey: '2026-03', paid: true, actualAmount: 500 },
  ];
  const anchorMonths = calculateMonths('2026-03', 5000, [], [], [huur], [], [], [], anchor, [], [], 3);
  check('S13 · ankermaand telt betaalde kost niet dubbel', anchorMonths[0]!.endBalance, 5000);
  invariant(anchorMonths, 'S13b');
}

// ── S14: budget is een inschatting, geen opzijgezet geld ───────────────────────
console.log('\nS14 — budget: betaling in een toekomstige maand');
{
  const budget: ReservationItem = {
    id: 'boodschappen', label: 'Boodschappen', monthlyAmount: 300,
    startMonth: '2026-03', type: 'maandelijks_budget',
  };
  const betaling: ReservationPayment[] = [{
    id: 'p1', reservationId: 'boodschappen', monthKey: '2026-04', label: 'Winkel',
    invoiceAmount: 180, fromReservation: 180, fromCash: 0,
  }];
  const months = calculateMonths('2026-03', 1000, [], [], [], [budget], betaling, [], [], [], [], 3);
  const potIn = (i: number) =>
    months[i]!.reservationPots.find((p) => p.reservationId === 'boodschappen')!;

  // April is een prognose: er is nog niets vertrokken, dus blijft de volle inschatting
  // staan. Zou de geboekte betaling de kost verlagen, dan maakt uitgeven je rijker.
  check('S14 · kost april', months[0]!.endBalance - months[1]!.endBalance, 300);
  check('S14 · potstand april', potIn(1).potBalance, 120);
  // Wat je niet opmaakt blijft op je rekening staan in plaats van door te rollen.
  check('S14 · potstand mei rolt niet door', potIn(2).potBalance, 300);
  invariant(months, 'S14');
}

// ── S15: gefinaliseerde spaarpot staat leeg in de afsluitmaand ─────────────────
console.log('\nS15 — spaarpot afsluiten');
{
  const pot: ReservationItem = {
    id: 'btw', label: 'Btw', monthlyAmount: 300, startMonth: '2026-03', type: 'spaardoel',
  };
  const settlements: ReservationSettlement[] = [{
    id: 's1', reservationId: 'btw', monthKey: '2026-05', effectiveAmount: 300, finalized: true,
  }];
  const months = calculateMonths('2026-03', 1000, [], [], [], [pot], [], [], [], [], settlements, 4);
  const potIn = (i: number) => months[i]!.reservationPots.find((p) => p.reservationId === 'btw')!;

  check('S15 · opbouw tot april', potIn(1).potBalance, 600);
  // Het restsaldo valt vrij in het eindsaldo; wat er nog gereserveerd zou staan is nul.
  check('S15 · potstand in de afsluitmaand', potIn(2).potBalance, 0);
  check('S15 · vrij saldo na vrijgave', months[2]!.endBalance, 1000);
  check('S15 · opbouw herstart in juni', potIn(3).potBalance, 300);
  invariant(months, 'S15');
}

// ── S16: netBurn telt de buffer niet mee ───────────────────────────────────────
console.log('\nS16 — netto tekort blijft leesbaar met een actieve buffer');
{
  const months = run({
    anchor: '2026-03', startBalance: 3000,
    income: [['2026-03', 1000], ['2026-04', 1000]],
    recurring: [['2025-01', 1200]],
    reservations: [BUFFER],
    count: 2,
  });
  const [m0, m1] = months as [MonthData, MonthData];
  // Beide maanden geven 1000 in en 1200 uit: een netto tekort van 200, dat de buffer
  // opvangt. Zou de buffer meetellen als kost, dan las netBurn hier 0.
  check('S16 · netBurn ankermaand', netBurn(m0), 200);
  check('S16 · netBurn latere maand', netBurn(m1), 200);
  check('S16 · oude formule zou 0 geven', m1.subtotals.costs - m1.totalIncome, 0);
  check('S16 · buffer-delta latere maand', bufferSummary(m1).delta, -200);
  invariant(months, 'S16');
}

// ── S17: overschot in een latere maand == het maandresultaat ───────────────────
console.log('\nS17 — overschot in een latere maand');
{
  const months = run({
    anchor: '2026-03', startBalance: 3000,
    income: [['2026-03', 1000], ['2026-04', 1500]],
    recurring: [['2025-01', 1200]],
    reservations: [BUFFER],
    count: 2,
  });
  const m1 = months[1]!;
  // Latere maand start op 0: de storting is dan exact inkomsten − kosten.
  check('S17 · beginsaldo is nul', m1.startBalance, 0);
  check('S17 · storting == maandresultaat', bufferPot(m1)!.autoContribution!, 300);
  check('S17 · buffer-delta', bufferSummary(m1).delta, 300);
  check('S17 · netBurn is negatief bij overschot', netBurn(m1), -300);
  check('S17 · eindsaldo', m1.endBalance, 0);
  invariant(months, 'S17');
}

// ── S18: een maand afsluiten mag de maand erna niet verschuiven ────────────────
console.log('\nS18 — snapshot: afsluiten verandert de volgende maand niet');
{
  const cfg = {
    expenses: [] as ExpenseItem[],
    income: [
      { id: 'i1', monthKey: '2026-03', label: 'inkomen', amount: 1000, received: false },
      { id: 'i2', monthKey: '2026-04', label: 'inkomen', amount: 1000, received: false },
    ] as IncomeItem[],
    recurring: [
      { id: 'r1', label: 'vast', amount: 1200, type: 'expense', frequency: 'monthly', startMonth: '2025-01' },
    ] as RecurringItem[],
  };

  // Ononderbroken doorrekening als referentie.
  const open = calculateMonths(
    '2026-03', 3000, cfg.expenses, cfg.income, cfg.recurring, [BUFFER],
    [], [], [], [], [], 2,
  );

  // Nu maart afsluiten en april opnieuw berekenen vanaf de ankerstaat.
  const snap = buildSnapshot(open[0]!, '2026-04-01T00:00:00.000Z');
  const state = computeAnchorState(
    3000, '2026-03', '2026-04', cfg.expenses, cfg.income, cfg.recurring, [BUFFER],
    [], [], [], [], [], [], [snap],
  );
  const closed = calculateMonths(
    '2026-04', state.startBalance, cfg.expenses, cfg.income, cfg.recurring, [BUFFER],
    [], [], [], [], [], 1, state.potBalances, snapshotMap([snap]),
  );

  const aprilOpen = open[1]!;
  const aprilClosed = closed[0]!;
  // Het banksaldo bij de start van april is het vrije saldo (0) plus alles wat er in de
  // potten zit — met de sweep zit daar per definitie de hele buffer in.
  check('S18 · buffer bij afsluiten maart', snap.buffer, bufferSummary(open[0]!).total);
  check('S18 · beginsaldo april', state.startBalance, snap.buffer + snap.reserved);
  check('S18 · potstand rolt door', state.potBalances.get('buffer') ?? -1, snap.buffer);
  check('S18 · storting april identiek', bufferPot(aprilClosed)!.autoContribution!,
    bufferPot(aprilOpen)!.autoContribution!);
  check('S18 · bufferstand april identiek', bufferSummary(aprilClosed).total, bufferSummary(aprilOpen).total);
  check('S18 · eindsaldo april identiek', aprilClosed.endBalance, aprilOpen.endBalance);
  invariant(closed, 'S18');
}

// ── S19: cash-bijbetaling mag de pot niet ongemerkt negatief laten gaan ────────
console.log('\nS19 — cash-bijbetaling op de bufferpot');
{
  const buf: ReservationItem = { ...BUFFER, monthlyAmount: 200, startMonth: '2025-01' };
  const months = calculateMonths(
    '2026-03', 10000,
    [], [{ id: 'i1', monthKey: '2026-03', label: 'inkomen', amount: 3000, received: false }],
    [{ id: 'r1', label: 'vast', amount: 1000, type: 'expense', frequency: 'monthly', startMonth: '2025-01' }],
    [buf],
    [{ id: 'pay1', reservationId: 'buffer', monthKey: '2026-03', label: 'factuur',
       invoiceAmount: 150, fromReservation: 100, fromCash: 50 }],
    [], [], [], [], 3,
  );
  // De pot is met de cash-bijbetaling volledig benut: hij staat op 0 én rolt als 0 door,
  // dus valt er in de maanden erna niets uit te lenen en blijft het tekort zichtbaar.
  months.forEach((m) => {
    const p = bufferPot(m)!;
    checkBool(`S19 · potsaldo niet negatief in ${m.monthKey}`, p.potBalance >= -0.005, true);
    checkBool(
      `S19 · tekort niet verzwegen in ${m.monthKey}`,
      m.endBalance >= -0.005 || p.deficitUncovered > 0.005,
      true,
    );
  });
  check('S19 · pot leeg na de bijbetaling', bufferPot(months[0]!)!.potBalance, 0);
  check('S19 · april dekt niets meer', bufferPot(months[1]!)!.autoContribution!, 0);
  check('S19 · april toont het tekort', bufferPot(months[1]!)!.deficitUncovered, 1000);
  invariant(months, 'S19');
}

// ── S20: resten uit het oude model blokkeren de sweep niet ────────────────────
console.log('\nS20 — uitstel en finalisatie op de bufferpot worden genegeerd');
{
  const base = {
    income: [
      { id: 'i1', monthKey: '2026-03', label: 'inkomen', amount: 1000, received: false },
      { id: 'i2', monthKey: '2026-04', label: 'inkomen', amount: 100, received: false },
    ] as IncomeItem[],
    recurring: [
      { id: 'r1', label: 'vast', amount: 1200, type: 'expense', frequency: 'monthly', startMonth: '2025-01' },
    ] as RecurringItem[],
  };
  const schoon = calculateMonths(
    '2026-03', 3000, [], base.income, base.recurring, [BUFFER], [], [], [], [], [], 2,
  );
  // Een uitstel op de bufferpot: zonder guard verdwijnt de pot uit april en meldt de
  // footer €0 terwijl er 2800 in zit.
  const metUitstel = calculateMonths(
    '2026-03', 3000, [], base.income, base.recurring, [BUFFER], [], [], [],
    [{ id: 'd1', reservationId: 'buffer', fromMonth: '2026-04', toMonth: '2026-05' }], [], 2,
  );
  // Een gefinaliseerde afrekening op de bufferpot: zonder guard slaat de sweep over.
  const metFinalisatie = calculateMonths(
    '2026-03', 3000, [], base.income, base.recurring, [BUFFER], [], [], [], [],
    [{ id: 's1', reservationId: 'buffer', monthKey: '2026-04', effectiveAmount: 999, finalized: true }], 2,
  );

  for (const [label, months] of [['uitstel', metUitstel], ['finalisatie', metFinalisatie]] as const) {
    check(`S20 · ${label} · bufferstand april`, bufferSummary(months[1]!).total, bufferSummary(schoon[1]!).total);
    check(`S20 · ${label} · beweging april`, bufferSummary(months[1]!).delta, bufferSummary(schoon[1]!).delta);
    check(`S20 · ${label} · eindsaldo april`, months[1]!.endBalance, schoon[1]!.endBalance);
    invariant(months, `S20 ${label}`);
  }
}

// ── S21: netBurn meet stromen, niet de opgebouwde stand van andere potten ──────
console.log('\nS21 — netBurn met een tweede provisiepot');
{
  const vakantie: ReservationItem = {
    id: 'vakantie', label: 'Vakantie', monthlyAmount: 100, startMonth: '2025-01', type: 'spaardoel',
  };
  const months = run({
    anchor: '2026-03', startBalance: 5000,
    income: [['2026-03', 1500], ['2026-04', 1500]],
    recurring: [['2025-01', 1000]],
    reservations: [BUFFER, vakantie],
    count: 2,
  });
  // Echte maandbeweging: 1500 in, 1000 vast + 100 storting uit → 400 overschot. De
  // opgebouwde 1400 van Vakantie is een stand, geen kost van deze maand.
  check('S21 · netBurn ankermaand', netBurn(months[0]!), -400);
  check('S21 · netBurn latere maand', netBurn(months[1]!), -400);
  check('S21 · geen runway bij overschot',
    computeRunway([buildSnapshot(months[0]!, '2026-04-01T00:00:00.000Z')], months[0]!).months === null ? 1 : 0, 1);
  invariant(months, 'S21');
}

// ── S22: cash-bijbetaling telt niet dubbel in de ankermaand ───────────────────
console.log('\nS22 — bijbetaling bovenop een pot');
{
  const pot: ReservationItem = {
    id: 'x', label: 'Pot', monthlyAmount: 100, startMonth: '2026-01', type: 'spaardoel',
  };
  const betaling: ReservationPayment[] = [{
    id: 'p1', reservationId: 'x', monthKey: '2026-03', label: 'factuur',
    invoiceAmount: 140, fromReservation: 100, fromCash: 40,
  }];
  // Ankermaand: de bijbetaling is al van het banksaldo af, dus telt ze niet als kost.
  const anker = calculateMonths('2026-03', 1140, [], [], [], [pot], betaling, [], [], [], [], 1);
  check('S22 · ankermaand telt de bijbetaling niet', anker[0]!.subtotals.oneOff, 0);
  check('S22 · geen overflow-regel in de ankermaand', anker[0]!.cashOverflowItems.length, 0);
  invariant(anker, 'S22a');

  // Latere maand: daar is nog niets vertrokken, dus telt ze wél.
  const later = calculateMonths('2026-02', 1140, [], [], [], [pot], betaling, [], [], [], [], 2);
  check('S22 · latere maand telt de bijbetaling wel', later[1]!.subtotals.oneOff, 40);
  check('S22 · met overflow-regel', later[1]!.cashOverflowItems.length, 1);
  invariant(later, 'S22b');
}

// ── S23: betaling groter dan de pot maakt geen geld uit het niets ─────────────
console.log('\nS23 — opname groter dan het potsaldo');
{
  const pot: ReservationItem = {
    id: 'x', label: 'Pot', monthlyAmount: 100, startMonth: '2026-03', type: 'spaardoel',
  };
  const teveel: ReservationPayment[] = [{
    id: 'p1', reservationId: 'x', monthKey: '2026-03', label: 'te grote factuur',
    invoiceAmount: 300, fromReservation: 300, fromCash: 0,
  }];
  // Ankermaand: er blijft niets gereserveerd staan, maar de kost mag niet negatief worden.
  const anker = calculateMonths('2026-03', 1000, [], [], [], [pot], teveel, [], [], [], [], 1);
  check('S23 · provisiekost niet negatief', anker[0]!.subtotals.provisions, 0);
  checkBool('S23 · eindsaldo stijgt niet door de opname', anker[0]!.endBalance <= 1000 + 0.005, true);
  invariant(anker, 'S23a');

  // Latere maand: wat de pot niet kon dragen, kwam van de rekening en telt dus als kost.
  const later = calculateMonths('2026-02', 1000, [], [], [], [pot], teveel, [], [], [], [], 2);
  check('S23 · overschot boven de pot telt als kost', later[1]!.subtotals.provisions, 300);
  invariant(later, 'S23b');
}

// ── S24: budget van de ankermaand handmatig bijgesteld ────────────────────────
console.log('\nS24 — budget bijstellen in de ankermaand');
{
  const budget: ReservationItem = {
    id: 'b', label: 'Boodschappen', monthlyAmount: 400, startMonth: '2026-03',
    type: 'maandelijks_budget',
  };
  const betaling: ReservationPayment[] = [{
    id: 'p1', reservationId: 'b', monthKey: '2026-03', label: 'winkel',
    invoiceAmount: 250, fromReservation: 250, fromCash: 0,
  }];
  const hoger: ReservationSettlement[] = [{
    id: 's1', reservationId: 'b', monthKey: '2026-03', effectiveAmount: 600, finalized: false,
  }];
  const lager: ReservationSettlement[] = [{
    id: 's2', reservationId: 'b', monthKey: '2026-03', effectiveAmount: 100, finalized: false,
  }];

  const basis = calculateMonths('2026-03', 1000, [], [], [], [budget], betaling, [], [], [], [], 1);
  check('S24 · zonder bijstelling resteert 400 − 250', basis[0]!.subtotals.budgets, 150);
  invariant(basis, 'S24a');

  const op = calculateMonths('2026-03', 1000, [], [], [], [budget], betaling, [], [], [], hoger, 1);
  check('S24 · budget verhoogd naar 600 → 350 te besteden', op[0]!.subtotals.budgets, 350);
  check('S24 · pot draagt het nieuwe bedrag', op[0]!.reservationPots[0]!.provisionThisMonth, 600);
  invariant(op, 'S24b');

  // Onder wat er al betaald is: er valt niets meer te reserveren, en het teveel is al van
  // het banksaldo af. De kost zakt naar 0 en mag het eindsaldo niet optillen.
  const neer = calculateMonths('2026-03', 1000, [], [], [], [budget], betaling, [], [], [], lager, 1);
  check('S24 · budget onder het betaalde → kost 0', neer[0]!.subtotals.budgets, 0);
  check('S24 · eindsaldo niet opgetild', neer[0]!.endBalance, 1000);
  invariant(neer, 'S24c');

  // Latere maand: de bijstelling geldt enkel voor de maand waarop ze staat.
  const later = calculateMonths('2026-02', 1000, [], [], [], [budget], betaling, [], [], [], lager, 3);
  check('S24 · bijgestelde maand telt zijn eigen bedrag', later[1]!.subtotals.budgets, 100);
  check('S24 · maand erna staat weer op het begrote bedrag', later[2]!.subtotals.budgets, 400);
  invariant(later, 'S24d');
}

// ── S25: budget overschreden — resterend 0, teveel bij de niet-recurrente uitgaven ─────
console.log('\nS25 — budget overschreden in de ankermaand');
{
  const budget: ReservationItem = {
    id: 'b', label: 'Parking', monthlyAmount: 106.4, startMonth: '2026-03',
    type: 'maandelijks_budget',
  };

  // Binnen budget: het resterende deel is 106,40 − 39,63 = 66,77 en er is geen cash-regel.
  const binnen: ReservationPayment[] = [{
    id: 'p1', reservationId: 'b', monthKey: '2026-03', label: 'ticket',
    invoiceAmount: 39.63, fromReservation: 39.63, fromCash: 0,
  }];
  const b = calculateMonths('2026-03', 1000, [], [], [], [budget], binnen, [], [], [], [], 1);
  check('S25 · binnen budget → resterend 66,77', b[0]!.subtotals.budgets, 66.77);
  check('S25 · binnen budget → geen cash-regel', b[0]!.cashOverflowItems.length, 0);
  invariant(b, 'S25a');

  // Over budget: de pot draagt 106,40, de rest (43,60) is cash. Resterend 0, en het teveel
  // verschijnt als regel bij de niet-recurrente uitgaven — maar telt in de ankermaand niet
  // nog eens als kost, want het is al van het banksaldo af.
  const over: ReservationPayment[] = [{
    id: 'p1', reservationId: 'b', monthKey: '2026-03', label: 'ticket',
    invoiceAmount: 150, fromReservation: 106.4, fromCash: 43.6,
  }];
  const anker = calculateMonths('2026-03', 1000, [], [], [], [budget], over, [], [], [], [], 1);
  check('S25 · over budget → resterend 0', anker[0]!.subtotals.budgets, 0);
  check('S25 · over budget → cash-regel in de ankermaand', anker[0]!.cashOverflowItems.length, 1);
  check('S25 · cash-regel = het teveel', anker[0]!.cashOverflowItems[0]!.amount, 43.6);
  check('S25 · teveel telt niet dubbel in de ankermaand', anker[0]!.subtotals.oneOff, 0);
  check('S25 · eindsaldo niet dubbel verlaagd', anker[0]!.endBalance, 1000);
  // De vlag moet de kop volgen: telt het bedrag niet mee, dan hoort de regel zich als een
  // betaalde uitgave te gedragen en dus achter de filter te zitten. Anders toont de sectie
  // een regel die niet in haar eigen totaal zit — precies wat er tot 07-08 gebeurde.
  checkBool('S25 · niet meegeteld → regel als betaald', anker[0]!.cashOverflowItems[0]!.paid, true);
  invariant(anker, 'S25b');

  // Latere maand: daar telt de cash-bijbetaling wél als kost én krijgt ze een regel.
  const later = calculateMonths('2026-02', 1000, [], [], [], [budget], over, [], [], [], [], 2);
  check('S25 · latere maand telt het teveel', later[1]!.subtotals.oneOff, 43.6);
  check('S25 · latere maand toont de cash-regel', later[1]!.cashOverflowItems.length, 1);
  checkBool('S25 · wél meegeteld → regel niet als betaald', later[1]!.cashOverflowItems[0]!.paid, false);
  invariant(later, 'S25c');
}

// ── S27: de regressie waarvoor de positie bestaat ──────────────────────────────
// Jeroens oktober 2026, teruggebracht tot zijn vorm: een maand die eindigt met een kleine
// pot, gevolgd door een tekort dat die pot ver overstijgt. De footer toonde daar "Deze
// maand −€ 40,13 · Buffer € 0,00" — de potbeweging en een lege pot — terwijl de maand
// €832,70 verloor en de stand op −€792,57 kwam. Dat de opname exact het potsaldo is, is
// per constructie zo: daardoor viel het ene getal samen met de bufferstand van de maand
// ervoor en las het scherm als een doorgeschoven saldo.
console.log('\nS27 — tekort groter dan de pot: wat de footer toont');
{
  const vers: ReservationItem = { ...BUFFER, monthlyAmount: 0, startMonth: '2026-08' };
  const months = run({
    anchor: '2026-08', startBalance: 0,
    income: [['2026-08', 1000], ['2026-09', 2000], ['2026-10', 1000]],
    recurring: [['2026-08', 1000]],
    expenses: [['2026-09', 959.87, false], ['2026-10', 832.70, false]],
    reservations: [vers],
    count: 3,
  });
  const [, sep, okt] = months as [MonthData, MonthData, MonthData];
  const bSep = bufferSummary(sep);
  const bOkt = bufferSummary(okt);

  check('S27 · september bouwt op', bSep.position, 40.13);
  check('S27 · september beweegt', bSep.movement, 40.13);
  check('S27 · oktober staat negatief', bOkt.position, -792.57);
  check('S27 · oktober beweegt het volle tekort', bOkt.movement, -832.70);
  // De twee oude getallen bestaan nog en zijn nog steeds wat ze waren — ze horen alleen
  // niet meer in de footer. Zonder deze twee zou de suite niet vastleggen dat de nieuwe
  // regels iets ánders zeggen dan de oude.
  check('S27 · potbeweging blijft de oude −potstand', bOkt.delta, -40.13);
  check('S27 · potstand blijft begrensd op nul', bOkt.total, 0);
  check('S27 · niet-gedekt is de negatieve positie', bOkt.uncovered, 792.57);
  invariant(months, 'S27');
}

// ── S28: betaling uit een ánder spaardoel, groter dan die pot ──────────────────
// Het gat dat de suite tot 2026-09-06 niet had: een bufferpot náást een gewoon spaardoel
// waaruit méér betaald wordt dan erin zit. Het deel dat de pot niet draagt komt van de
// rekening — `subtotals.ts` boekt dat als `teveel`, en een maandstroom die die term mist
// is te gunstig. Zonder dit scenario blijft die fout onzichtbaar: geen enkel ander
// scenario combineert een buffer met een pot-betaling boven het potsaldo.
console.log('\nS28 — betaling boven het saldo van een ánder spaardoel');
{
  const buf: ReservationItem = { ...BUFFER, monthlyAmount: 0, startMonth: '2026-09' };
  const doel: ReservationItem = {
    id: 'doel', label: 'Doel', monthlyAmount: 100, startMonth: '2026-09', type: 'spaardoel',
  };
  const months = calculateMonths(
    '2026-09', 5000, [], [], [], [buf, doel],
    [{ id: 'pay1', reservationId: 'doel', monthKey: '2026-10', label: 'factuur', invoiceAmount: 600, fromReservation: 600, fromCash: 0 }],
    [], [], [], [], 3,
  );
  const okt = months[1]!;
  const doelPot = okt.reservationPots.find((p) => p.reservationId === 'doel')!;
  // De pot draagt 100 overgedragen + 100 storting = 200; 400 komt van de rekening.
  check('S28 · pot draagt 200', doelPot.deferredFromPrevious + doelPot.provisionThisMonth, 200);
  check('S28 · teveel valt op de rekening', okt.subtotals.provisions, 100 + 400);
  invariant(months, 'S28');
}

// ── S29: betaling boven een maandbudget ────────────────────────────────────────
// De tegenhanger van S28 voor de andere pot-soort. Een budget kent geen `teveel`-term in
// `subtotals`; het teveel verschijnt als losse regel in de uitgavensectie. De vraag is of
// de maandstroom dan nog sluit op de positiereeks — meten, niet aannemen.
console.log('\nS29 — betaling boven een maandbudget');
{
  const buf: ReservationItem = { ...BUFFER, monthlyAmount: 0, startMonth: '2026-09' };
  const budget: ReservationItem = {
    id: 'budget', label: 'Budget', monthlyAmount: 150, startMonth: '2026-09', type: 'maandelijks_budget',
  };
  const months = calculateMonths(
    '2026-09', 5000, [], [], [], [buf, budget],
    [{ id: 'pay1', reservationId: 'budget', monthKey: '2026-10', label: 'factuur', invoiceAmount: 400, fromReservation: 150, fromCash: 250 }],
    [], [], [], [], 3,
  );
  check('S29 · het teveel staat als losse regel', months[1]!.cashOverflowItems.length, 1);
  invariant(months, 'S29');
}

// ── S30: /analyse leest dezelfde positie als de footer ─────────────────────────
// `computeRunway` en `bufferSeries` lazen tot 2026-09-06 de potstand. Die is per
// constructie €0 zodra het tekort de pot overstijgt, dus meldde de runwaykaart "0 maanden"
// en tekende de grafiek een vlakke nullijn op het moment dat de footer een negatieve stand
// toont. Beide leespaden hadden geen enkele check; dit is die check.
console.log('\nS30 — runway en grafiek volgen de footer');
{
  const vers: ReservationItem = { ...BUFFER, monthlyAmount: 0, startMonth: '2026-08' };
  const months = run({
    anchor: '2026-08', startBalance: 0,
    income: [['2026-08', 1000], ['2026-09', 2000], ['2026-10', 1000]],
    recurring: [['2026-08', 1000]],
    expenses: [['2026-09', 959.87, false], ['2026-10', 832.70, false]],
    reservations: [vers],
    count: 3,
  });
  const okt = months[2]!;
  const stand = bufferSummary(okt).position;
  check('S30 · oktober staat negatief', stand, -792.57);

  // De runway deelt die stand, niet de potstand — anders is de teller altijd nul.
  const runway = computeRunway([buildSnapshot(months[0]!, '2026-09-01T00:00:00Z')], okt);
  check('S30 · runway deelt de bufferstand', runway.buffer, stand);
  checkBool('S30 · runwaykaart valt in de tak "staat negatief"', runway.buffer < -0.005, true);

  // De grafiek plot dezelfde grootheid, ook voor de bevroren maand: die leidt hem af uit
  // `snap.data` en laat het bevroren veld `snap.buffer` ongemoeid.
  const snap = buildSnapshot(okt, '2026-11-01T00:00:00Z');
  const punten = bufferSeries([snap], months);
  check('S30 · grafiek plot de positie voor historie', punten[0]!.buffer, stand);
  check('S30 · het bevroren veld blijft de potstand', snap.buffer, 0);
  checkBool('S30 · historie en prognose op dezelfde definitie',
    punten.every((punt) => Math.abs(punt.buffer - bufferSummary(
      months.find((m) => m.monthKey === punt.monthKey)!,
    ).position) < 0.005), true);
  invariant(months, 'S30');
}

// ── S31: drie tekortmaanden op rij, de stand zakt door ─────────────────────────
// Het acceptatie-item "twee tekortmaanden op rij cumuleren" leunde eerst op S5 en S9, en
// geen van beide cumuleert: S5 heeft één negatieve maand, S9 herhaalt drie keer dezelfde
// stand bij een beweging van €0. Zonder een reeks die écht doorzakt kan geen enkele check
// het verschil zien tussen "de stand telt op" en "de stand blijft staan".
console.log('\nS31 — drie tekortmaanden op rij, de stand cumuleert');
{
  const vers: ReservationItem = { ...BUFFER, monthlyAmount: 0, startMonth: '2026-09' };
  const months = run({
    anchor: '2026-09', startBalance: 0,
    income: [['2026-09', 1000], ['2026-10', 1000], ['2026-11', 1000]],
    recurring: [['2026-09', 1500]],
    reservations: [vers],
    count: 3,
  });
  const standen = months.map((m) => bufferSummary(m).position);
  const bewegingen = months.map((m) => bufferSummary(m).movement);
  check('S31 · stand maand 1', standen[0]!, -500);
  check('S31 · stand maand 2', standen[1]!, -1000);
  check('S31 · stand maand 3', standen[2]!, -1500);
  // De beweging blijft élke maand −500: de stand zakt door omdat hij optelt, niet omdat
  // de maand zelf erger wordt. Precies dat onderscheid mist een reeks die stilstaat.
  bewegingen.forEach((b, i) => check(`S31 · beweging maand ${i + 1}`, b, -500));
  invariant(months, 'S31');
}

// Tegenproef. `scripts/scenarios.mjs` draait deze suite eerst mét deze vlag en eist dan een
// niet-nul exit: een suite die niet kán falen meldt "546/546 geslaagd" even overtuigend als
// een die werkt. Zonder de vlag verandert er niets aan de telling.
if (process.env.SCENARIO_SELFTEST) check('zelftest — hoort te falen', 0, 1);

console.log(`\n${checks - failures}/${checks} checks geslaagd${failures ? ` — ${failures} FOUT` : ''}`);
process.exit(failures ? 1 : 0);
