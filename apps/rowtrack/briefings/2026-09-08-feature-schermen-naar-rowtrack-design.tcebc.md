# Schermen naar RowTrack - Design

| | |
|---|---|
| **Datum** | 2026-09-08 |
| **Type** | feature |
| **Project** | rowtrack |
| **Klant** | umanex |
| **Status** | gebouwd |

---

```
TASK:        De schermen horen niet in de componentenbibliotheek. Haal ActivePhase en
             IdlePhase uit `RowTrack -  Design System` en zet alle RowTrack-schermen in
             `RowTrack - Design`, op de pagina *Screens v2*.

CONTEXT:     `RowTrack -  Design System` (QkRgMc7Quqtbow71DiYa1n) is de gepubliceerde library:
             33 pagina's, 15 component sets + 18 losse componenten, 24 slots, leesbare
             laagnamen. Twee van die 33 pagina's zijn géén component maar een scherm —
             ActivePhase (5 frames) en IdlePhase (4 frames). Ze staan er omdat de builder ze
             als "scherm" modelleert (representatieve frames, geen variant-assen), niet omdat
             ze in een library thuishoren. `RowTrack - Design` (T1bGrvIzSNeLyh5CbarATZ) draait
             sinds vandaag volledig op de library-variabelen en heeft een lege pagina
             *Screens v2* die hiervoor bedoeld is.

ELEMENTS:    Pagina *Screens v2* in RowTrack - Design · de 9 bestaande schermframes
             (ActivePhase ×5, IdlePhase ×4) · de overige RowTrack-schermen (aantal en
             samenstelling: OPEN VRAAG) · de gepubliceerde library als bron van instances ·
             de builder (figma/builder.js) en de bouwspec.

BEHAVIOUR:   Een designer opent *Screens v2* en ziet de schermen naast elkaar, elk met zijn
             naam. Wat hij daar aanraakt, hoort te reageren zoals de library het bedoelt:
             een knop in een scherm is een instance van Button, geen platte kopie.

CONSTRAINTS: De library blijft gepubliceerd en mag niet opnieuw breken — pagina's verwijderen
             raakt de publicatiestatus, dus dat gaat door dezelfde poort als een herbouw.
             Schermen zijn geen component sets: hun assen zijn in beeld niet orthogonaal
             (dat staat al als uitsluiting in `figma:check`). De guard verwacht per story-
             component één Figma-pagina in het library-bestand; twee pagina's weghalen raakt
             de `[dekking]`- en `[pagina]`-as.
```

---

## Open vragen

Geen. De vier kritische items zijn beantwoord — zie Beslissingen hieronder.

## Beslissingen (2026-09-08, door Jeroen)

**1. Uit library-instances.** Een knop in een scherm wordt een échte `Button`-instance met zijn
slots gevuld; wijzigt Button in de library, dan schuiven de schermen mee. Dat vraagt een nieuw
mechanisme, want de bouwspec is een DOM-boom zonder componentgrenzen. **De haak bestaat al:**
de naamgevingspas markeert nodes met `naamBron === 'component'` wanneer de winnende
StyleSheet-sleutel uit een ánder componentbestand komt — dat is precies een componentgrens.
Gemeten na reviewronde 1: 12 zulke paren, alle twaalf tegen de broncode getoetst, waaronder
`IdlePhase > Chip` (12×), `IdlePhase > DeviceRow` (8×), `ActivePhase > Button` (5×).

**2. Alle elf routes.** Niet alleen de negen frames die al een render-pad hebben. Zeven routes
hebben er geen: vier auth-schermen (145–192 regels, alleen een router-mock nodig) en drie
data-schermen (`profile` 1003 regels, `history/index` 308, `history/[id]` 683 — supabase,
auth, route-parameters en data-fetch). Voor elk daarvan komt er eerst een story.

**3. Pagina's uit de library verwijderen, guard aanpassen.** `[dekking]` en `[pagina]` eisen nu
één Figma-pagina per story-component. Schermen krijgen daar een **expliciete uitsluiting** met
reden — telbaar, zoals de bestaande uitsluitingen — in plaats van dat de assen stil zachter
worden.

**4. Interactie-modaliteit: geen.** Statische schermweergaven, geen prototype-bedrading.

## Aannames

- `[ASSUMPTION]` **Component-typologie**: schermen worden `FRAME`s op *Screens v2*, geen
  COMPONENT en geen COMPONENT_SET. Een scherm is geen herbruikbaar ding; er hoeft niets van
  geïnstantieerd te worden.
- `[ASSUMPTION]` **States**: de bestaande 9 frames zijn de states (Playground, Niet Verbonden,
  Doel Afstand, Toestel Keuze, Zonder Hartslagband, Doel Bereikt, Samenvatting). Loading,
  empty en error zijn eigen componenten en horen niet als schermvariant terug.
- `[ASSUMPTION]` De verplaatsing gaat via een herbouw in het doelbestand plus verwijderen in
  de bron, niet via kopiëren-plakken tussen bestanden — dat laatste is niet scriptbaar en
  breekt de bouwhash.

## Acceptatie

**Fase 1 — render-pad voor de zeven routes zonder story**

- [ ] Een `expo-router`-mock in `.storybook/` vangt `useRouter`, `Link`, `useLocalSearchParams` en `Stack` af — bewijs: de vier auth-stories renderen zonder console-fout
- [ ] De supabase-mock levert vulbare data in plaats van alleen `{data:null,error:null}` — bewijs: `history/index` toont rijen, niet zijn empty state
- [ ] Een auth-context-mock levert een ingelogde gebruiker — bewijs: `profile` rendert zijn ingelogde vorm
- [ ] Zeven nieuwe stories, elk met minstens één benoemde frame-story naast Playground
- [ ] `render:sweep` blijft groen op álle stories, oud en nieuw, zonder lege render

**Fase 2 — het instance-mechanisme**

- [x] De builder plaatst op elke node met een GEDECLAREERDE grens een instance in plaats van de subboom na te bouwen — bewijs: 88 instances over 10 frames, exact het aantal buitenste grenzen dat vooraf uit de bouwspec gemeten werd (teruggelezen via `figma_execute` in RowTrack - Design). De haak is `data-testid`/`data-bron` geworden, niet `naamBron === 'component'`: die heuristische tak bestaat sinds ingreep 1 niet meer.
- [x] De slots worden gevuld uit wat de spec op die plek meet — bewijs: de zes KpiRow-instances in ActivePhase/Playground tonen Split 01:52, Watt 208, SPM 26, BPM 148, Totaal afstand 5.000 m, Totaal Kcal 238, elk zijn eigen waarde. Niet via de `slot`-markering (die komt uit story-args en staat niet op een schermnode) maar via het PAD waar die markering in de eigen variant zat, gerekend vanaf de componentgrens.
- [x] Een geplaatste instance is en blijft `type === 'INSTANCE'` met een `remote` main component — bewijs: teruggelezen via de runtime, 88 van 88 `remote: true`, 0 lokaal.
- [x] Elke instance die de builder NIET kan plaatsen komt in `meldingen` — bewijs: de tak bestaat en is onderweg gezien (15 meldingen toen de slotpaden nog één niveau te hoog stonden); de eindbouw geeft er 0 voor ActivePhase en 2 voor IdlePhase, en die twee gaan over een ontbrekende text style, niet over een instance.
- [x] De variantkeuze is gemeten, niet gegokt — bewijs: `data-variant` uit `lib/variantData.ts`, en de teruglezing toont per instance de gekozen as-waarden (KpiRow `divider=false` op de laatste rij, `disabled=true` op de BPM-rij, ProgressBar `fillKind=gradient, richting=h`). Een afdruk op de gemeten geometrie is expliciet verworpen: op de buitenmaat botsen 11 van de 21 componenten, en diep matchte hij 1 van de 88.

**Fase 3 — de verhuizing**

- [x] `Screens v2` draagt alle schermframes, elk met zijn naam — bewijs: 10 frames, `ActivePhase / Playground` t/m `IdlePhase / Toestel Keuze`, teruggelezen als FRAME met de juiste maat (430x932, landscape 932x430).
- [x] De pagina's ActivePhase en IdlePhase zijn weg uit de library — bewijs: 33 → 31 pagina's, 786 nodes verwijderd, `resterendMetSchermnaam: 0` (fase 0a, 2026-09-08).
- [x] `[dekking]` en `[pagina]` sluiten schermen expliciet uit mét reden, telbaar in de uitvoer — bewijs: `scripts/schermen.mjs` is één bron en de guard toont twee `[uitgesloten]`-regels; `[pagina]` FAALT bovendien zolang een scherm nog een library-pagina heeft.
- [x] De resterende library-componenten blijven bruikbaar — bewijs: 45 van 45 `gepubliceerd` in `figma/library-component-keys.json`, en alle 88 instances hebben een `remote` main component.
- [x] `figma:check` groen op alle assen met een vers manifest — bewijs: 13 van 13 assen, 44 van 44 tegenproef-mutaties.
- [x] `parity` meet de schermen in hun nieuwe bestand — bewijs: `figma/geometry.schermen.json` wordt samengevoegd met de library-geometrie; 205 varianten, 2 807 nodes, 22 227 velden. **42 verschillen blijven**, alle drie van één soort: een instance draagt de library-variant, dus wat geen variant-as en geen tekst-slot is (een numerieke layout-prop, een portal die in zijn eigen story leeg meet, een Reanimated-opacity) reist niet mee. Dat staat als ratel `BEKENDE_SCHERMVERSCHILLEN` — tweezijdig getoetst: zes mutaties gaven 47 en exit 1, hersteld weer 42 en exit 0.

**Afgeschreven assen**

- [ ] States n.v.t. voor de verhuizing zelf; de bestaande 9 frames ZIJN de states van het workout-scherm, en de zeven nieuwe routes krijgen hun states uit hun eigen stories
- [ ] Interactie n.v.t. — statische weergaven, geen prototype-bedrading

## Beslissingsgeschiedenis

- 2026-09-08: briefing geopend. Vraag 1 (instances of plat) is de kantelvraag; de rest volgt eruit.
- 2026-09-09: fase 2 en 3 gebouwd. Besluit 1 (instances) is uitgevoerd met een andere haak dan gedacht: de briefing rekende op `naamBron === 'component'` — 12 gemeten paren — maar die heuristiek bestaat niet meer. Ingreep 1 gaf elk component een gedeclareerde grens, en dat werden er 88 in plaats van 12. Wat de briefing niet voorzag: de variantkeuze vroeg een derde annotatie (`data-variant`), want uit de gemeten geometrie is hij niet af te leiden. **Fase 1 — de zeven routes zonder render-pad — is niet gedaan**; dat is een eigen brok met drie mocks.
- 2026-09-08: alle drie beantwoord — instances, alle elf routes, pagina's weg uit de library. De
  scope groeide daarmee van "twee pagina's verplaatsen" naar "zeven render-paden bouwen plus een
  nieuw bouwmechanisme"; dat is drie fasen, niet één.
