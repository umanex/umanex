// ---------------------------------------------------------------------------
// Eenmalige migratie: de app-achtergrond van de VARIANTEN naar hun ouder.
//
// WAAROM. Elke variant-component en elke losse component droeg `Theme/bg/base` als eigen
// vulling, zodat alpha-kleuren in dit bestand tegen de app-achtergrond lezen in plaats van
// tegen Figma's grijze canvas. Dat klopt voor een bewijsstuk en is fout voor een library: die
// vulling reist mee naar élke instance. Gemeten 2026-09-08 in `RowTrack - Design`: een
// Button-instance uit de library gaf `instanceFills: 1` — een ondoorzichtig donker vlak om de
// knop. Dat de SET in dit bestand een nette achtergrond heeft helpt daar niet, want alleen de
// vulling van de variant zélf reist mee.
//
// DE OPLOSSING PER GEVAL.
//  · Variant in een set  -> `fills = []`. De set is zelf een frame en schildert zijn (gebonden)
//    vulling achter zijn varianten, dus het beeld in dit bestand verandert niet.
//  · Losse component     -> `fills = []` plus één gebonden `achtergrond`-rechthoek erachter.
//    Zo'n component heeft geen ouder-frame dat de achtergrond kan schilderen.
//
// WAAROM GEEN `page.backgrounds`. Die accepteert geen variabele: *"in set_backgrounds: page
// backgrounds cannot be bound to variables"* (gemeten). Dat zou de app-achtergrond een
// hardcoded hex maken — precies wat de tokenregel verbiedt. Een RECTANGLE bindt wél.
//
// WAAROM IN-PLACE EN NIET VIA EEN HERBOUW. De 33 componenten zijn gepubliceerd. Een herbouw
// vervangt elke node door een nieuwe met een nieuwe key en zou elke geplaatste instance
// ontkoppelen — waar de poort in builder.js voor bestaat. Dit script raakt alleen `fills` en
// voegt rechthoeken toe; elke component-identiteit blijft, dus de publicatie overleeft. De
// bouwhash draagt type, naam, maat en tekst — geen verf — dus een volgende herbouw leest dit
// niet als handwerk. De builder is meeveranderd zodat een herbouw hetzelfde oplevert.
// ---------------------------------------------------------------------------
if (figma.fileKey !== 'QkRgMc7Quqtbow71DiYa1n') return { fout: 'verkeerde file: ' + figma.fileKey };
await figma.loadAllPagesAsync();

let BG = null;
for (const c of await figma.variables.getLocalVariableCollectionsAsync()) {
  if (c.name !== 'Theme') continue;
  for (const id of c.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (v.name === 'bg/base') { BG = v; break; }
  }
}
if (!BG) return { fout: 'Theme/bg/base niet gevonden — zonder binding zou de achtergrond een hardcoded hex worden' };
const bgPaint = () => figma.variables.setBoundVariableForPaint(
  { type: 'SOLID', color: { r: 0.0824, g: 0.0902, b: 0.1098 } }, 'color', BG);

const verslag = { sets: 0, variantenGestript: 0, losseGestript: 0, vlakkenGemaakt: 0, overgeslagen: [] };

for (const page of figma.root.children) {
  const sets = page.children.filter(c => c.type === 'COMPONENT_SET');
  const los = page.children.filter(c => c.type === 'COMPONENT');

  for (const set of sets) {
    // De set HOUDT zijn gebonden vulling — of krijgt hem als hij er geen heeft.
    if (!Array.isArray(set.fills) || !set.fills.length) set.fills = [bgPaint()];
    verslag.sets++;
    for (const v of set.children)
      if (Array.isArray(v.fills) && v.fills.length) { v.fills = []; verslag.variantenGestript++; }
  }

  if (los.length) {
    for (const c of los)
      if (Array.isArray(c.fills) && c.fills.length) { c.fills = []; verslag.losseGestript++; }
    // Eén vlak per pagina, achter alle losse componenten samen.
    const bestaand = page.children.find(c => c.type === 'RECTANGLE' && c.name === 'achtergrond');
    if (bestaand) bestaand.remove();
    const marge = 48;
    const x0 = Math.min(...los.map(d => d.x)) - marge;
    const y0 = Math.min(...los.map(d => d.y)) - marge;
    const x1 = Math.max(...los.map(d => d.x + d.width)) + marge;
    const y1 = Math.max(...los.map(d => d.y + d.height)) + marge;
    const r = figma.createRectangle();
    r.name = 'achtergrond';
    r.x = x0; r.y = y0;
    r.resize(Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    r.fills = [bgPaint()];
    r.locked = true;
    page.appendChild(r);
    page.insertChild(0, r);
    verslag.vlakkenGemaakt++;
  }

  for (const c of page.children)
    if (!['COMPONENT_SET', 'COMPONENT', 'RECTANGLE'].includes(c.type))
      verslag.overgeslagen.push(`${page.name}/${c.name}[${c.type}]`);
}

// Terugleze op de LIVE staat, niet op de tellers hierboven.
let variantMetVulling = 0, losMetVulling = 0, setZonderBinding = 0, vlakZonderBinding = 0;
for (const page of figma.root.children)
  for (const top of page.children) {
    if (top.type === 'COMPONENT_SET') {
      const f = top.fills?.[0];
      if (!f || !f.boundVariables || !f.boundVariables.color) setZonderBinding++;
      for (const v of top.children) if (Array.isArray(v.fills) && v.fills.length) variantMetVulling++;
    } else if (top.type === 'COMPONENT') {
      if (Array.isArray(top.fills) && top.fills.length) losMetVulling++;
    } else if (top.type === 'RECTANGLE' && top.name === 'achtergrond') {
      const f = top.fills?.[0];
      if (!f || !f.boundVariables || !f.boundVariables.color) vlakZonderBinding++;
    }
  }
return { fileKey: figma.fileKey, verslag,
         controle: { variantMetVulling, losMetVulling, setZonderBinding, vlakZonderBinding } };
