#!/usr/bin/env node
/**
 * Unit-tegenproef voor de naamgevingsladder in scripts/laagnamen.mjs.
 *
 * WAAROM APART VAN figma-sync-selftest.mjs. Die zelftest muteert een JSON-veld en bewijst dat
 * de GUARD het leest — dat was reviewbevinding R06, en het is een echte beperking: hij raakt de
 * producent niet aan. Deze zelftest roept `benoem()` aan op synthetische bomen, dus hij toetst
 * de LADDER zelf: welke sport wint van welke, en of een feit een gok verslaat.
 *
 * Elk geval draait TWEE KEER — één keer met het feit en één keer zonder — zodat zichtbaar is
 * dat de uitkomst aan dát feit hangt en niet aan de vorm van de boom. Geven beide kanten
 * dezelfde naam, dan meet het geval niets en faalt het.
 *
 * Gebruik: node scripts/laagnamen-selftest.mjs
 */
import { benoem } from './laagnamen.mjs';

/** Een kandidaat zoals de walker hem schrijft: bron, sleutelnaam, eigen klassen / totaal. */
const kand = (bron, s, eigen, n, v = 0) => ({ b: bron, bron, s, v, n, eigen: Array.from({ length: eigen }, (_, i) => `r-${s}-${i}`) });
const node = (extra = {}) => ({ w: 100, h: 20, kandidaten: [], kinderen: [], ...extra });

const gevallen = [];
const geval = (naam, bouw, verwacht) => gevallen.push({ naam, bouw, verwacht });

// 1. Een GEDECLAREERDE grens verslaat een vreemde sleutel met volle dekking.
//    Zonder de grens wint `valueRow` uit WheelPicker.tsx; mét de grens heet de node `Chip`.
geval('testid verslaat een vreemde sleutel',
  (metFeit) => ({
    comp: 'IdlePhase',
    bomen: [node({ kinderen: [node({
      ...(metFeit ? { component: 'Chip' } : {}),
      kandidaten: [kand('components/WheelPicker.tsx', 'valueRow', 3, 3)],
    })] })],
  }),
  { met: ['Chip', 'testid'], zonder: ['valueRow', 'sleutel'] });

// 2. Een rnw-hostlaag verslaat een sleutel die hij alleen via gedeelde atomaire klassen wint.
//    Dit is het gemeten geval: de spinner in Button won `base`.
geval('rnw verslaat een gedeelde atomaire klasse',
  (metFeit) => ({
    comp: 'Button',
    bomen: [node({ kinderen: [node({
      ...(metFeit ? { rnw: 'spinner' } : {}),
      kandidaten: [kand('components/Button.tsx', 'base', 2, 5)],
    })] })],
  }),
  { met: ['spinner', 'rnw'], zonder: ['base', 'sleutel'] });

// 3. `o` — binnen een verklaarde grens wint de EIGEN sleutel, ook bij LAGERE dekking.
//    Als tiebreaker zou dit geval de vreemde sleutel kiezen (0,50 tegen 1,00).
geval('de eigen sleutel wint van een vreemde met hogere dekking',
  (metFeit) => ({
    comp: 'IdlePhase',
    bomen: [node({ kinderen: [node({
      ...(metFeit ? { component: 'Chip' } : {}),
      kinderen: [node({ kandidaten: [
        kand('components/Chip.tsx', 'row', 2, 4),
        kand('components/WheelPicker.tsx', 'valueRow', 3, 3),
      ] })],
    })] })],
    diepte: 2,
  }),
  { met: ['row', 'sleutel'], zonder: ['valueRow', 'sleutel'] });

// 4. `data-bron` benoemt de node waar de GRENS al door een ander component geclaimd is.
//    Dit is het geval waarvoor de heuristiek bestond: GoalSheet rendert een BottomSheet als zijn
//    eigen wortel en geeft daar `testID="GoalSheet"` aan door, dus de zelf-nesting-poort slaat de
//    testid-sport over. Zonder `bron` valt de node terug op zijn sleutel.
geval('bron benoemt een node waarvan de grens al geclaimd is',
  (metFeit) => ({
    comp: 'GoalSheet',
    bomen: [node({ kinderen: [node({
      component: 'GoalSheet',
      ...(metFeit ? { bron: 'BottomSheet' } : {}),
      kandidaten: [kand('components/BottomSheet.tsx', 'root', 2, 2)],
    })] })],
  }),
  { met: ['BottomSheet', 'bron'], zonder: ['root', 'sleutel'] });

// 4. `data-laag` in de verkeerde vorm wordt GENEGEERD, niet gebruikt.
geval('een data-laag met een spatie wordt genegeerd',
  (metFeit) => ({
    comp: 'WheelPicker',
    bomen: [node({ kinderen: [node({
      laag: metFeit ? 'bigLayer' : 'Big Layer',
      kandidaten: [],
    })] })],
  }),
  { met: ['bigLayer', 'laag'], zonder: ['item', 'terugval'] });

/** Loop naar de node op de opgegeven diepte (1 = eerste kind van de wortel). */
const opDiepte = (boom, d) => { let n = boom; for (let i = 0; i < d; i++) n = n.kinderen[0]; return n; };

let stuk = 0;
for (const { naam, bouw, verwacht } of gevallen) {
  const uit = {};
  for (const kant of ['met', 'zonder']) {
    const { comp, bomen, diepte = 1 } = bouw(kant === 'met');
    benoem(comp, bomen);
    const n = opDiepte(bomen[0], diepte);
    uit[kant] = [n.naam, n.naamBron];
  }
  const gelijk = (a, b) => a[0] === b[0] && a[1] === b[1];
  const okMet = gelijk(uit.met, verwacht.met);
  const okZonder = gelijk(uit.zonder, verwacht.zonder);
  // Beide kanten dezelfde uitkomst = de opstelling kan het defect niet opwekken.
  const beweegt = !gelijk(uit.met, uit.zonder);
  if (okMet && okZonder && beweegt) {
    console.log(`  ok   ${naam}: ${uit.met.join('/')} tegen ${uit.zonder.join('/')}`);
  } else {
    stuk++;
    console.log(`  FAAL ${naam}: met=${uit.met.join('/')} (hoort ${verwacht.met.join('/')}), `
      + `zonder=${uit.zonder.join('/')} (hoort ${verwacht.zonder.join('/')})`
      + (beweegt ? '' : ' — BEIDE KANTEN GELIJK, het geval meet niets'));
  }
}
console.log(stuk
  ? `\n${stuk} van ${gevallen.length} geval(len) stuk — de ladder doet niet wat hij beweert.`
  : `\n${gevallen.length} van ${gevallen.length}: elke sport verslaat de sport eronder, en elke uitkomst hangt aan zijn eigen feit.`);
process.exit(stuk ? 1 : 0);
