# Tokenlaag: `RowTrack - Design` naast de library

Gemeten 2026-09-08 via de Desktop Bridge, read-only, met de fileKey-assert erop.
Dit bestand is de **voorbereiding** van de samenvoeging uit spoor 1d — het beschrijft wat een
omzetting raakt, en voert er zelf niets van uit.

## Wat er staat

| | `RowTrack - Design` (`T1bGrvIzSNeLyh5CbarATZ`) | `RowTrack -  Design System` (`QkRgMc7Quqtbow71DiYa1n`) |
|---|---|---|
| rol | schermcompositie — *Screens*, *Components*, *Screens v2* | gepubliceerde library, gegenereerd uit de Storybook-render |
| variabelen | 237 lokaal (Theme 31 · Component 100 · Core 106) | 250 lokaal |
| nodes | 3 845 | 33 pagina's, 94 variant-nodes |

## De meting die de samenvoeging mogelijk maakt

- **14 399 bindingen** hangen aan een lokale variabele. **0** aan een remote variabele — de
  gekoppelde library wordt vandaag door geen enkele node gebruikt.
- Van de 237 lokale variabelen zijn er **84 in gebruik** en **153 dood**.
- **Alle 84 gebruikte variabelen hebben een tegenhanger met exact hetzelfde pad in de library.**
  Nul gaten. De 13 paden die alleen in de library bestaan zijn de 9 `letterSpacing`- en
  4 `lineHeight`-variabelen, die hier nergens gebonden zijn.

Dat laatste is het hele punt: de omzetting kan één-op-één op het **pad**, zonder inhoudelijke
keuzes en zonder waardeverlies. De 153 dode variabelen verdwijnen mee zonder iets te raken.

## De tien zwaarste bindingen

| pad | bindingen | velden |
|---|---:|---|
| `Core/spacing/0` | 1 373 | itemSpacing, padding* |
| `Core/fontFamily/albertSans` | 1 164 | fontFamily |
| `Theme/fg/secondary` | 764 | fills, strokes |
| `Theme/fg/quaternary` | 684 | fills, strokes |
| `Core/spacing/20` | 577 | padding*, itemSpacing |
| `Core/borderRadius/none` | 572 | *Radius |
| `Core/fontSize/16` | 504 | fontSize |
| `Theme/fg/primary` | 474 | fills |
| `Core/borderWidth/1` | 456 | stroke*Weight |
| `Theme/border/default` | 398 | strokes |

De volledige telling staat in de sessie-uitvoer; ze is met de walker hieronder te herhalen.

## Hoe de omzetting eruitziet

**Anders dan het plan aannam is dit volledig scriptbaar.** Het plan schreef "vraagt Jeroens hand
in Figma (variabelen omzetten naar een library-referentie kan de plugin-API niet volledig)".
Dat klopt niet: `figma.variables.importVariableByKeyAsync` haalt de library-variabele op, en
elke bindingsvorm die hier voorkomt is met de plugin-API te zetten —
`node.setBoundVariable(veld, v)` voor de scalairen, `setBoundVariableForPaint` voor een
`SOLID`-vulling, en voor een gradientstop de handmatige
`{ boundVariables: { color: { type: 'VARIABLE_ALIAS', id } } }` (gemeten in de vorige sessie:
`setBoundVariableForPaint` werkt daar niet).

De vorm van de migratie:

1. Lees per pad de **key** van de library-variabele (die staat niet in `figma/manifest.json`;
   één pas over het design-system-bestand levert hem).
2. `importVariableByKeyAsync` per gebruikte key — 84 stuks.
3. Walk `RowTrack - Design`, en herbind elke binding op pad-gelijkheid. 14 399 bindingen, in
   batches; de 30 s van `figma_execute` is een **wacht**limiet, geen uitvoerlimiet.
4. Verwijder de drie lokale collecties. Pas ná stap 3, en pas na een telling die 0 lokale
   bindingen overhoudt.
5. Publiceer opnieuw.

## Uitgevoerd 2026-09-08

Op expliciete opdracht (*"RowTrack - Design mag geen lokale variabelen hebben"*). Eindstand,
teruggelezen op de live staat: **0 lokale collecties, 0 lokale styles, 14 540 bindingen
allemaal remote**, en drie steekproefkleuren exact gelijk aan `tokens.json`
(`Theme/bg/base` #15171C, `Theme/fg/primary` #F2F4FA, `Theme/accent/default` #F05454).

Vier dingen die de migratie onderweg blootlegde en die het script nu draagt:

1. **Wezen.** Dertig Theme-variabelen waren uit hun collectie verwijderd maar leefden door
   omdat 4 397 bindingen eraan hingen. Een kaart uit `getLocalVariableCollectionsAsync()`
   mist die volledig — het pad wordt daarom per binding opgelost.
2. **Tekstvelden hangen per range.** `boundVariables.fontSize` is op een TEXT-node een array
   met één alias per stijlbereik; `setBoundVariable` raakt daar maar één van.
   `setRangeBoundVariable(0, lengte, veld, v)` klapt de array samen.
3. **Effecten dragen hun kleurbinding op het effect zelf**, net als een paint, en `effects`
   staat niet eens in de enum van `setBoundVariable`.
4. **`fontWeights` was als STRING getypeerd** terwijl Figma's veld `fontWeight` FLOAT eist —
   869 bindingen konden daardoor per constructie niet mee. Root cause lag in
   `scripts/figma-tokens-payload.mjs`, niet in Figma; opgelost door het type uit de waarde af
   te leiden.

En één valkuil in het meetgereedschap: **`teamLibrary.getVariablesInLibraryCollectionAsync()`
serveerde ná de publicatie nog de oude sleutels**, terwijl `importVariableByKeyAsync` op de
nieuwe sleutel prima de FLOAT-variabele gaf. De migratie leest daarom `figma/library-keys.json`
(gegenereerd uit het library-bestand) en gebruikt de listing nog enkel als tegenproef: elk pad
waar de twee verschillen komt in `sleutelVerschil`, zodat een verouderd sleutelbestand zichzelf
meldt.

## De walker (read-only, herhaalbaar)

```js
// figma_execute — telt bindingen per variabele, lokaal tegen remote
if (figma.fileKey !== "T1bGrvIzSNeLyh5CbarATZ") return { fout: "verkeerde file: " + figma.fileKey };
await figma.loadAllPagesAsync();
const lokaal = new Map();
for (const c of await figma.variables.getLocalVariableCollectionsAsync())
  for (const id of c.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    lokaal.set(id, c.name + "/" + v.name);
  }
const telling = new Map();
let remote = 0;
const noteer = (id) => {
  const p = lokaal.get(id);
  if (!p) { remote++; return; }
  telling.set(p, (telling.get(p) ?? 0) + 1);
};
function loop(n) {
  if (n.boundVariables) for (const w of Object.values(n.boundVariables)) {
    if (Array.isArray(w)) { for (const a of w) if (a && a.id) noteer(a.id); }
    else if (w && w.id) noteer(w.id);
  }
  for (const soort of ['fills', 'strokes']) {
    if (!Array.isArray(n[soort])) continue;
    for (const v of n[soort]) {
      if (v.boundVariables) for (const a of Object.values(v.boundVariables)) if (a && a.id) noteer(a.id);
      if (Array.isArray(v.gradientStops)) for (const st of v.gradientStops)
        if (st.boundVariables && st.boundVariables.color) noteer(st.boundVariables.color.id);
    }
  }
  if ('children' in n) for (const k of n.children) loop(k);
}
for (const p of figma.root.children) for (const k of p.children) loop(k);
return { lokaal: lokaal.size, gebruikt: telling.size, remote,
         gebruik: Object.fromEntries([...telling].sort((a, b) => b[1] - a[1])) };
```
