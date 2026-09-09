// ---------------------------------------------------------------------------
// Trekt de library-imports vooraf in de cache van RowTrack - Design, met een tijdbudget.
//
// WAAROM. Ná een publicatie haalt elke vérse `importComponentByKeyAsync`/`importStyleByKeyAsync`
// de nieuwe versie over het netwerk — seconden per sleutel (gemeten 2026-09-09: 350–410 ms voor
// een style die het bestand al kende, veel meer voor een net gepubliceerde component). Een
// schermbouw die daar middenin de 30 s-wachtlimiet van `figma_execute` raakt, wordt afgebroken
// in een lopende import, en die halve import houdt élke volgende import vast tot de plugin
// herstart is. Dus: eerst hier alles importeren, in aanroepen die elk ruim onder de limiet
// blijven, en pas bouwen als `resterend` leeg is. Elke import heeft zijn eigen wachttijd, zodat
// een hangende sleutel een melding is en niet een blokkade.
//
//   const BUDGET = 18000;          // ms, optioneel
//   const bron = await (await fetch('http://localhost:9229/voorverwarm-imports.js')).text();
//   const F = Object.getPrototypeOf(async function () {}).constructor;
//   return await (new F('BUDGET', 'figma', bron))(BUDGET, figma);
//   // herhaal tot resterend === 0
// ---------------------------------------------------------------------------
if (figma.fileKey !== 'T1bGrvIzSNeLyh5CbarATZ') return { fout: 'verkeerde file: ' + figma.fileKey };
const POORT = 9229;
const BUDGET_MS = typeof BUDGET !== 'undefined' ? BUDGET : 18000;
const WACHT_MS = 6000;
const t0 = Date.now();
const keys = await (await fetch(`http://localhost:${POORT}/library-component-keys.json`)).json();
const bib = await (await fetch(`http://localhost:${POORT}/library-keys.json`)).json();
const klaar = new Set((figma.root.getPluginData('voorverwarmd') || '').split('\n').filter(Boolean));
const race = (p) => Promise.race([p, new Promise((_, nee) => setTimeout(() => nee(new Error(`geen antwoord binnen ${WACHT_MS} ms`)), WACHT_MS))]);

const taken = [];
for (const [naam, c] of Object.entries(keys.componenten)) {
  if (c.status === 'UNPUBLISHED') continue;
  if (c.varianten) taken.push({ id: `set:${naam}`, doe: () => figma.importComponentSetByKeyAsync(c.key) });
  else taken.push({ id: `component:${naam}`, doe: () => figma.importComponentByKeyAsync(c.key) });
}
for (const [naam, o] of Object.entries(bib.textStyles ?? {})) taken.push({ id: `style:${naam}`, doe: () => figma.importStyleByKeyAsync(o.key) });
for (const [naam, o] of Object.entries(bib.effectStyles ?? {})) taken.push({ id: `style:${naam}`, doe: () => figma.importStyleByKeyAsync(o.key) });
for (const [naam, o] of Object.entries(bib.variabelen ?? {})) taken.push({ id: `variabele:${naam}`, doe: () => figma.variables.importVariableByKeyAsync(o.key) });

const gedaan = [], fouten = [];
let resterend = 0;
for (const t of taken) {
  if (klaar.has(t.id)) continue;
  if (Date.now() - t0 > BUDGET_MS) { resterend++; continue; }
  const s = Date.now();
  try { await race(t.doe()); klaar.add(t.id); gedaan.push(`${t.id} ${Date.now() - s} ms`); }
  catch (e) { fouten.push(`${t.id}: ${e.message}`); if (/geen antwoord/.test(e.message)) break; }
}
figma.root.setPluginData('voorverwarmd', [...klaar].join('\n'));
return { ms: Date.now() - t0, totaal: taken.length, alGedaan: klaar.size, dezeRonde: gedaan.length, resterend: taken.filter(t => !klaar.has(t.id)).length, traagste: gedaan.map(g => [g, Number(g.split(' ').at(-2))]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(g => g[0]), fouten };
