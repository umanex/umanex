# Van bewijsbare spiegel naar bruikbare library — laagnamen en slots

| | |
|---|---|
| **Datum** | 2026-09-08 |
| **Type** | feature |
| **Project** | rowtrack |
| **Klant** | umanex |
| **Status** | gepland |

---

```
TASK:        Het gegenereerde Figma design system leesbaar en bedienbaar maken: elke laag
             draagt zijn code-naam in plaats van een broer-index, en de tekstvelden van een
             component zijn als component property te overschrijven zonder te ontkoppelen.

CONTEXT:     `RowTrack -  Design System` (QkRgMc7Quqtbow71DiYa1n) is gepubliceerd als library
             en hangt als asset in `RowTrack - Design` (T1bGrvIzSNeLyh5CbarATZ), waar Jeroen op
             *Screens v2* schermen uit de componenten samenstelt. Het bestand is vandaag een
             machinetranscriptie: 82% van 1288 frames heet `0`/`1`/`2`, tekstnodes heten naar
             hun eigen copy, en 15 component sets dragen samen nul component properties. Voor
             bewijs (parity, guard) volstaat dat; voor compositie niet.

ELEMENTS:    33 component sets in Figma · 94 variant-nodes · de walker
             (scripts/figma-build-spec.mjs) · de snoeier (figma-build-prune.mjs) · de builder
             (figma/builder.js) · een nieuwe aftap-module in .storybook/ · twee nieuwe guard-
             assen in figma-sync-check.mjs.

BEHAVIOUR:   In Figma: een designer sleept een component uit de library, kiest een variant via
             de bestaande variant-properties, en overschrijft de tekst via een component
             property in het rechterpaneel — niet door de tekstlaag te selecteren en te
             detachen. In de laagboom leest hij `Chip > row > value` in plaats van
             `Chip > 0 > 1`. Bij een herbouw blijven die namen gelijk zolang de code gelijk
             blijft.

CONSTRAINTS: Geen wijziging aan productiecode — het aftappen van de StyleSheet-sleutels gebeurt
             uitsluitend in .storybook/. Een laagnaam mag NIET per variant verschillen, anders
             is de component set onbruikbaar. Een tekstnode krijgt een expliciete naam die
             nooit zijn eigen copy is (leesbaarheidscontract regel 1). Iconen blijven
             placeholders — INSTANCE_SWAP is geblokkeerd op de ontbrekende Ionicons-TTF
             (BACKLOG). De herbouw passeert de publicatiepoort uit figma/builder.js.
```

---

## Open vragen

Geen. De vier kritische items zijn beantwoord in de Aannames en de Acceptatie hieronder.

## Aannames

- `[ASSUMPTION]` **Component-typologie**: dit levert geen nieuw app-component op. De typologie
  is de Figma-kant: één COMPONENT_SET per RowTrack-component, variant-properties zoals ze er nu
  al zijn, plus TEXT- en BOOLEAN-component-properties als slots. Schermen (ActivePhase,
  IdlePhase) blijven losse COMPONENT-frames zonder set — hun assen zijn in beeld niet
  orthogonaal, dat besluit staat al in de guard.
- `[ASSUMPTION]` **Interactie-modaliteit**: alle interactie zit in Figma, niet in de app —
  variant kiezen in het rechterpaneel, tekst overschrijven via de property. Geen enkele
  interactie in RowTrack zelf verandert.
- `[ASSUMPTION]` De drempel `d/n ≥ 0,34` voor het koppelen van een StyleSheet-sleutel aan een
  DOM-node is gefit op drie gelezen gevallen, niet op een verdeling. Hij wordt herijkt op het
  `dekkingHistogram` uit `figma/laagnamen.json` vóór hij vast komt te staan.
- `[ASSUMPTION]` Slots beginnen bij Button (`title` als TEXT, `icon` als BOOLEAN) en rollen pas
  uit na de meting dat een instance in een ánder bestand de tekst kan overschrijven zonder te
  ontkoppelen.

## Acceptatie

**Laagnamen — spoor 2**

- [x] Geen enkele node in `figma/build-spec.min.json` heet een kaal cijfer — bewijs: `indexNamen: 0` in `figma/laagnamen.json`, tegen 82% van 1 288 frames vóór deze ronde
- [x] Geen enkele TEXT-node draagt zijn eigen copy als naam — bewijs: `copyNamen: 0` in `figma/laagnamen.json`
- [x] Voor elk isomorf variantpaar is de namenlijst per positie identiek — bewijs: `instabiel: []` in `figma/laagnamen.json`; vóór de stabilisatiepas waren het 14 gevallen over Button, DeviceRow en KPI
- [x] Het aandeel nodes met een naam uit de code (`sleutel` + `gefold` + `component`) is **75,1%** (1 453/1 934) — bewijs: `figma/laagnamen.json`, gemeten op de gesnoeide boom
- [x] Nog eens **10,0%** draagt een waargenomen rolnaam (`icon`, `label`, `progressbar`); **14,9%** valt terug op een structurele naam — bewijs: `perBron` in `figma/laagnamen.json`
- [x] De terugval is een plafond van het mechanisme, geen drempelkwestie — bewijs: van de 2 436 nodes zonder gekozen sleutel hadden er **15** een kandidaat ónder de drempel; de rest heeft er nul
- [ ] Dezelfde vier assen gemeten op de gebouwde Figma-nodes zelf, via de runtime (`figma_execute`), niet op de spec — de spec is de invoer van de builder, niet zijn uitvoer
- [ ] De sleutelkaart is een instrument dat kan uitvallen: met `?rnwKeysUit=1` faalt `figma:spec` met "sleutelkaart uitgeschakeld" in plaats van een spec met 100% terugval af te leveren — de walker draagt de faalconditie, de doorvoer van de vlag naar de story-URL nog niet
- [x] Positieve instrumentcontrole: `window.__RNW_KEYS__` bevat bron `components/Chip.tsx` met sleutel `chip` (6 klassen) — bewijs: precies **1** DOM-node draagt alle zes, gemeten in de gebouwde Storybook
- [ ] Vier nieuwe mutaties in `figma-sync-selftest.mjs` maken elk precies één naam-as rood
- [ ] Twee controle-mutaties laten alle naam-assen groen: een hernoeming in álle varianten, en een extra kind in één variant (niet-isomorf, dus legitiem)

**Slots — spoor 3**

- [ ] `Button` heeft een TEXT-property `title` en een BOOLEAN-property `icon`, gelezen terug via `componentPropertyDefinitions` op de live node
- [ ] Een instance van `Button` in een ánder bestand overschrijft `title` zonder te detachen — gemeten op `instance.type === 'INSTANCE'` ná de override
- [ ] Tegenproef: met de property verwijderd is diezelfde override niet meer mogelijk
- [ ] Een story-arg-waarde die niet precies één keer als tekstnode voorkomt, levert een melding in plaats van een gok — dezelfde discipline als de tokenmatching

**Rails die niet mogen breken**

- [ ] `render:sweep` blijft 197/197 zonder console-fout en zonder lege render — de aftap-module draait in de preview van elke story
- [ ] `figma:check` blijft groen op de bestaande elf assen, met een vers manifest ná de herbouw en vóór `figma:links`
- [ ] `parity` blijft op 0 verschillen — laagnamen raken geen enkele maat
- [ ] `figma:poort:selftest` blijft 16/16 — de herbouw passeert de poort, hij omzeilt hem niet
- [ ] `tsc` en `build-storybook` groen

**Afgeschreven assen**

- [ ] States n.v.t. — dit spoor voegt geen data-laag toe; loading, empty en error bestaan al als eigen componenten (`Skeleton`, `EmptyState`, `ErrorState`) met hun eigen stories, en veranderen hier niet
- [ ] Edge case *iconen* afgeschreven — INSTANCE_SWAP blijft geblokkeerd op de ontbrekende Ionicons-TTF, bestaand BACKLOG-item; iconen blijven gestippelde placeholders, maar krijgen wél de naam `icon` in plaats van `Icon 24`

## Beslissingsgeschiedenis

- 2026-09-08: spoor 2 en 3 samen in één briefing, conform het goedgekeurde plan — ze raken
  dezelfde vier bestanden en dezelfde herbouw.
- 2026-09-08: laagnamen worden per **component** gekozen, over alle varianten tegelijk, niet per
  node. Variant-stabiliteit is daarmee een constructie-eigenschap in plaats van een hoop; per
  variant kiezen loopt aantoonbaar vast op `containerLg`/`containerSm` in `ErrorState`.
- 2026-09-08: de sleutels worden afgetapt door `StyleSheet.create` te wrappen in `.storybook/`,
  niet door `testID` in productiecode te zetten. `testID` blijft de chirurgische escape-hatch
  voor de nodes die de meting als ambigu aanwijst.
