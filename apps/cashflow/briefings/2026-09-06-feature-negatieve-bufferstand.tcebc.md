# Negatieve bufferstand in de maandfooter

- **Datum:** 2026-09-06
- **Type:** feature
- **Project:** cashflow
- **Klant:** umanex
- **Status:** gevalideerd

---

```
TASK:        De maandfooter toont de bufferpositie — potstand plus vrij saldo, dus
             negatief zodra het tekort de pot overstijgt — in plaats van € 0,00 met het
             restant op een aparte regel "Niet gedekt".

CONTEXT:     Cashflow-prognose, BalanceFooter onder elke MonthCard + de rekenkern
             (calculator.ts, buffer.ts, subtotals.ts) en de afgeleide analyse. Verfijnt
             briefings/2026-08-05-feature-buffer-sweep-footer.tcebc.md: daar is de opname
             begrensd tot het potsaldo, landt de pot op €0 en rolt het restant door als
             negatief vrij saldo. Gemeten op Jeroens oktober 2026: "Deze maand −€ 40,13 ·
             Niet gedekt −€ 792,57 · Buffer € 0,00", terwijl de maand €832,70 tekortkomt
             en de positie op −€792,57 staat. Het prominentste getal meldt nul bij een
             tekort, en het tekort verschijnt in de volgende kolom nóg eens als "Vorig
             saldo" (IncomeSection.tsx:169).

ELEMENTS:    - BalanceFooter, regel "Deze maand": maandstroom i.p.v. potbeweging
             - BalanceFooter, regel "Buffer": positie, mag negatief
             - BalanceFooter, regel "Niet gedekt": vervalt — tweede naam voor dezelfde stand
             - RunwayCard: leest de positie, waardoor de bestaande tak `buffer < 0`
               ("Buffer staat negatief") voor het eerst om de juiste reden loopt
             - BufferChart: leest de positie, ook voor de historie — afgeleid uit
               `snap.data`, zodat het bevroren veld `snap.buffer` onaangeroerd blijft
             - IncomeSection/StartBalanceRow: blijft staan en blijft het vrije saldo
               tonen — dat is een andere grootheid (positie min potstand)

BEHAVIOUR:   De rekenkern blijft ongewijzigd: de opname blijft begrensd tot het potsaldo,
             het restant blijft doorrollen als negatief vrij saldo. `BufferSummary` krijgt
             er twee afleidingen bij — `position = potstand + endBalance` en
             `movement = −netBurn(data)` — en `delta`/`total`/`uncovered` houden hun
             huidige betekenis, zodat snapshots en de bestaande leesplekken niet stil van
             betekenis veranderen.
             `movement` is bewust `netBurn` en niet `position(t) − position(t−1)`: dat
             verschil klopt vanaf t=1, maar in de ankermaand is `startBalance` het
             banksaldo — mét de potten erin en met de afgevinkte betalingen er al af —
             dus is er daar geen vorige positie om van af te trekken. Gevolg: in de
             ankerkolom betekent "Deze maand" voortaan de maandstroom in plaats van de
             potbeweging. Beide formules gelden ook voor bevroren maanden uit het oude
             model, dus geen migratie.
             Zonder gemarkeerde bufferpot verandert er niets (hint-staat blijft).

CONSTRAINTS: Desktop-first, bestaande rollaag-utilities, geen nieuwe dependencies, geen
             `any`. Eén bron: `lib/cashflow/buffer.ts` leidt af, de footer rekent niet
             zelf, de analyse dupliceert geen buffer-math. De drie footers blijven even
             hoog. Afgesloten maanden (snapshots) blijven bevroren: hun `MonthData`
             wordt niet aangeraakt en `MonthSnapshot.buffer` houdt zijn betekenis.
             `deficitUncovered` blijft bestaan — de suite gebruikt hem als tegenhanger
             van de positie — maar verdwijnt uit de UI.
```

---

## Open vragen

_(leeg — alle kritische items beantwoord)_

## Aannames

- `[ASSUMPTION: states]` Geen loading/empty/error — de footer leest synchroon uit de
  Zustand-store en erft de states van `MonthCard`. Relevante toestanden: geen bufferpot ·
  opbouw · opname · stand negatief.
- `[ASSUMPTION: interactie]` Read-only, geen klik/keyboard/hover-affordance. Beide regels
  zijn volledig afgeleid.
- `[ASSUMPTION: typologie]` Geen nieuw component — twee regels binnen de bestaande
  `BalanceFooter`, plus twee afleidingen in `lib/cashflow/buffer.ts`.
- `[ASSUMPTION: kleur]` De bestaande epsilon-drempel blijft: boven −0,005 groen, daaronder
  rood — anders kleurt afrondingsruis een maand die exact uitkomt.
- `[ASSUMPTION: runway]` `netBurn` blijft de bufferstroom buiten beschouwing laten; enkel
  de stand die de runway deelt wordt de positie en kan dus negatief zijn.

## Acceptatie

_Invarianten over het hele model (afhankelijke berekeningen — scherm-per-scherm valideert hier niets):_

- [x] **I1** — vanaf de tweede kolom sluit de maandstroom op de positiereeks — bewijs: de
      gelijkheden `movement == (potstand + eindsaldo) − (beginstand pot + beginsaldo)` en
      `positie(t) − positie(t−1) == movement(t)` staan als de checks
      `beweging == positieverschil` en `positie-doorrol` in `invariant()`, over alle 31
      scenario's; `pnpm --filter cashflow scenarios` geeft 794/794 + 48/48, met de
      tegenproef per suite bewezen faalbaar. In de ankermaand geldt de gelijkheid **niet**
      en wordt ze ook niet getoetst: `startBalance` is daar het banksaldo mét de potten
      erin en met de afgevinkte betalingen er al af. Dat verschil staat in BEHAVIOUR en
      draagt sinds de review een `title` op de regel zelf.
- [x] **I2** — `positie == −niet gedekt` zolang de potstand niet negatief staat — bewijs:
      check `positie == −niet gedekt` in `invariant()`, groen over dezelfde
      scenario's; de guard `b.total > -0.005` sluit de andere faalklasse uit (S10, een
      betaling groter dan de pot — zie `BACKLOG.md`)
- [x] **Tegenproef** — de nieuwe checks dragen het defect zelf — bewijs: met het oude
      gedrag geïnjecteerd (`position: total`, `movement: delta`) zakt de suite met 15 rode
      checks, waaronder `S27 · oktober staat negatief: verwacht -792.57, kreeg 0.00` en
      `S27 · oktober beweegt het volle tekort: verwacht -832.70, kreeg -40.13` — letterlijk
      de twee getallen die op het scherm stonden. Onafhankelijk gereproduceerd door de
      reviewer. Herstellen geeft weer groen
- [x] **De maandstroom mist geen uitstroom** — bewijs: `netBurn` telde de `teveel`-term
      niet (een betaling boven het potsaldo komt van de rekening). Vastgelegd in S28 en
      S23b; met de term weer weggehaald zakt de suite met 4 rode checks, met de term erin
      794/794. Gevonden door het reviewpanel, niet door de bouwronde

_Gedrag:_

- [x] Tekort groter dan de pot toont een negatieve stand en de volle maandstroom — bewijs:
      `S27` in de rekenkern (positie −792,57 · beweging −832,70 · potstand blijft
      0 · potbeweging blijft −40,13) én op een gerenderd scherm in de flow-harness:
      kolom 2 leest `Deze maand −€ 1.600,00 Buffer −€ 237,42`
- [x] De regel "Niet gedekt" bestaat niet meer — bewijs: `grep -c "Niet gedekt"
      .screens-preview.html` = 0 (positieve controle: "Deze maand" geeft daar wél
      treffers), en de harness-regex eist dat "Buffer" direct op "Deze maand" volgt; een
      tussenliggende regel laat het scenario vallen
- [x] Drie tekortmaanden op rij cumuleren in de stand — bewijs: S31 meet de reeks
      −500 / −1000 / −1500 bij een beweging van −500 per maand. Het eerdere bewijs (S5 en
      S9) was fout: S5 heeft één negatieve maand en S9 herhaalt dezelfde stand bij een
      beweging van €0 — geen van beide kon het verschil tussen optellen en stilstaan zien
- [x] Een latere maand met overschot toont hetzelfde getal als vóór de wijziging — bewijs:
      harness kolom 1 (`Deze maand +€ 500,00 · Buffer € 1.362,58`); in een latere
      maand veegt de pot het hele overschot op, dus vallen potbeweging en maandstroom
      samen. **In de ankerkolom niet:** daar verandert het getal per constructie (S4 ging
      van +€ 9.200,00 naar +€ 2.000,00), want de potbeweging droeg daar de opgebouwde
      stand en de maandstroom niet
- [x] Maand die exact uitkomt: € 0,00, neutraal gekleurd, geen teken — bewijs: gemeten op
      béíde kanten van élke afrondingsgrens: `formatAmount(-0.0049)` = `"€ 0,00"` tegen
      `(-0.005)` = `"−€ 0,01"`, en `formatCurrency(-0.4999)` = `"€ 0"` tegen `(-0.5)` =
      `"−€ 1"`. De eerste versie van deze fix gaf op de grens zelf `"€ 1"` voor een
      negatief bedrag — gevonden door het reviewpanel; het teken volgt nu de getoonde
      magnitude in plaats van een eigen afronding
- [x] Zonder bufferpot: de footer toont de hint en geen enkel bedrag — bewijs: het
      harness-scenario `buffer — hint zonder bufferpot` leest alle drie de kolommen op de
      standaardfixture: "Geen buffer" aanwezig én de footer-regex nergens raak. Twee
      signalen uit dezelfde DOM in tegengestelde richting
- [x] `RunwayCard` toont "Buffer staat negatief" op de footer-drempel — bewijs: vijfde fixture in `render-screens.tsx`
      (`buffer: -792.57`) rendert die tak en de sweep meet hem (302 elementen boven AA);
      de drempel is `< -0.005`, want zonder epsilon meldde de kaart "staat negatief" bij
      een float-residu van −5,6e−17 terwijl de footer in dezelfde toestand "€ 0,00" toont
- [x] `/analyse` leest dezelfde stand als de footer — bewijs: S30 toetst dat
      `computeRunway(...).buffer` gelijk is aan `bufferSummary(maand).position`, dat de
      grafiek diezelfde waarde plot voor historie én prognose, en dat het bevroren veld
      `MonthSnapshot.buffer` de potstand blijft (0). Beide leespaden hadden vóór deze
      ronde nul dekking
- [x] Afgesloten maanden blijven bevroren — bewijs: `git diff lib/cashflow/snapshot.ts
      lib/cashflow/calculator.ts lib/cashflow/subtotals.ts` is leeg; de historie wordt
      afgeleid uit `snap.data`, niet herschreven
- [x] Eén notatie voor een negatief bedrag — bewijs: `.screens-preview.html` en
      `.charts-preview.html` bevatten samen 20× U+2212 en 0× het ASCII-koppelteken ná het
      symbool; er bestaan geen andere geldformatters (grep op `Intl.NumberFormat` en
      `toLocaleString`)
- [x] `type-check` slaagt, geen `any` — bewijs: `tsc --noEmit` zonder uitvoer; grep op
      `: any`, `as any` en `<any>` over alle aangeraakte bestanden geeft nul treffers
- [x] De volledige harness slaagt — bewijs: `flow:selftest`, alle 22 scenario's, waarvan
      10 tegenproeven die hóren te falen; 3 schrijfpogingen onderschept, 0 verzoeken naar
      buiten

- [x] Jeroens eigen kolommen op de draaiende app — bewijs: na merge + rebuild
      (`BUILD_ID KL-mU92CyB73vkSImEUY0`, HTTP 200 op `:3000`) uitgelezen in de browser:
      oktober `Deze maand −€ 832,70 · Buffer −€ 792,57`, exact de verwachte getallen.
      November toont `Vorig saldo −€ 792,57 · Deze maand −€ 12.574,13 · Buffer
      −€ 13.366,70` — die drie sluiten op de cent (−792,57 − 12.574,13 = −13.366,70), dus
      de begin → beweging → einde-lezing houdt op echte data. "Niet gedekt" komt in geen
      enkele kolom nog voor, en `/analyse` rendert zonder fout met de koppen "Runway",
      "Van beginsaldo naar eindsaldo", "Bufferstand" en "Begroot tegenover werkelijk"
- [x] `pnpm --filter cashflow build` — bewijs: CI op PR #362, "Type-check, lint, build"
      geslaagd (3m48s); lokaal herhaald met `NEXT_DIST_DIR=.next` vóór de PM2-restart

_De ankerkolom blijft een open ontwerpvraag_ — zie `BACKLOG.md` 2026-09-06. Gemeten op de
draaiende app: september toont `Beginsaldo € 22.078,72 · Deze maand −€ 11.774,03 · Buffer
€ 40,13`. Die drie tellen niet op, en het gat is structureel: het beginsaldo is het
banksaldo mét álle potten erin, terwijl de bufferstand alleen de bufferpot plus het vrije
saldo is. De regel draagt een `title` die dat uitlegt.

## Beslissingsgeschiedenis

- 2026-09-06: Aanleiding — Jeroen las "Deze maand −€ 40,13" in oktober als een doorgeschoven
  septemberbuffer. Dat getal is de potbeweging, niet het maandresultaat; de samenloop is
  structureel zodra het tekort de pot overstijgt (dan geeft de pot per definitie precies
  zijn hele saldo). De footer toont drie getallen waarvan er geen enkel de vraag
  beantwoordt "hoe diep sta ik".
- 2026-09-06: Eerst gekozen om het tekort in de pot te laten doorrollen (cap eraf). Na de
  meting teruggedraaid — **kantelpunt**. "De cap eraf" bleek geen enkele guard maar vier,
  verspreid over `calculator.ts` en `subtotals.ts`, plus een vijfde in de testharnas:
  `recomputeEindsaldo` in `buffer-scenarios.ts` reproduceert dezelfde `Math.max(0, …)` en
  is dus niet onafhankelijk van wat hij hoort te controleren. Alleen `calculator.ts:566`
  weghalen telt het tekort dubbel (pot −500 én eindsaldo −500 voor een gat van €500) en
  laat de suite daarbij 534/546 groen. Volledig doorgevoerd is het model consistent, maar
  het kost 29 checks waarvan S9/S10/S19 echte regressies zijn, het laat de invariant
  `potBalance >= 0` vallen — de guard die de P0 uit de augustus-review vastlegt — en het
  verplaatst het tekort naar de enige grootheid die niet uit de store te reconstrueren is
  (`calcPotBalance` gaf +300 waar de waarheid −800 was). Beide modellen tonen dezelfde
  twee getallen op het scherm; Jeroen koos daarop voor de afleiding.
- 2026-09-06: `position` en `movement` zijn *toegevoegd* aan `BufferSummary` in plaats van
  `total`/`delta` te herdefiniëren. Een herdefinitie van `delta` zou 69 bestaande checks
  omvergooien en een herdefinitie van `total` zou stil doorlekken naar `snapshot.ts` en
  `analysis.ts` zonder dat één check dat opvangt.
- 2026-09-06: `movement` komt uit `netBurn`, niet uit een saldoverschil. In de ankermaand
  is `startBalance` het banksaldo mét de potten erin, en zijn de afgevinkte betalingen er
  al af — een saldoverschil gaf daar −200 waar de maand −600 bewoog. `netBurn` verhuisde
  daarvoor naar `lib/cashflow/burn.ts`: `buffer.ts` en `analysis.ts` zouden elkaar anders
  circulair importeren.
- 2026-09-06: `/analyse` mee herijkt. `RunwayCard` en `BufferChart` lazen de potstand en
  meldden "€ 0,00" en "0 maanden" op het moment dat de footer −€ 792,57 toont — twee
  schermen die elkaar tegenspreken over dezelfde pot. Beide lezen nu de positie; het label
  "Bufferpot" werd "Buffer", want het is de pot niet meer.
- 2026-09-06: Reviewronde met drie lenzen (diff · falsificatie van het bewijs · UX), elk
  adversarieel. Eén P0 die de bouwronde miste: `netBurn` telde de `teveel`-term niet, dus
  een betaling boven een potsaldo gaf een te gunstige maandstroom en de stand van de vorige
  maand plus die stroom sloot niet meer op de nieuwe stand. De invariant die dat vangt
  bestond al — er was alleen geen scenario dat een bufferpot met zo'n betaling combineerde.
  Verder: de epsilon op `RunwayCard`, het teken op de afrondingsgrens (`formatCurrency(-0,5)`
  gaf "€ 1"), de `present`-poort die een maand vóór de startmaand van de pot op €0 zette, en
  een harness-regex die een overschotmaand niet kon matchen. Drie afgevinkte acceptatie-items
  bleken op bewijs te rusten dat het defect niet kón opwekken; die zijn herschreven met
  scenario's die het wél doen (S28, S30, S31).

## Beoordeling

Panel van drie lenzen met de acceptatielijst als toetssteen, na een meetronde van vier lenzen
vooraf. Bevindingen opgelost bij de oorzaak, elk met een check die zonder de fix rood wordt:

- **P0** `netBurn` miste de `teveel`-term (`lib/cashflow/burn.ts`) → S28 + S23b.
- **P1** `position`/`movement` stonden achter `present`, terwijl `hasBuffer` vensterbreed is
  → poort weg; de invarianten gelden nu ook in een maand zonder bufferpot.
- **P1** `RunwayCard` sloeg om op `buffer < 0` zonder epsilon → dezelfde halve cent als de footer.
- **P1** In de ankerkolom telt `Beginsaldo + Deze maand` niet op tot `Buffer`; het gat is exact
  wat je hebt afgevinkt → `title` op de regel, en de open ontwerpvraag hierboven.
- **P1** Het woord "Buffer" botste op `/analyse`: de waterfall-stap heet nu "Naar de buffer",
  de grafiek "Bufferstand" met de positie als ondertitel.
- **P2** Teken op de afrondingsgrens → het teken volgt de getoonde magnitude.
- **P2** Harness-regex kon een overschot niet matchen → `[+−]?`, en de fixture heeft nu een
  overschotmaand zodat die tak ook echt gedraaid wordt.
- **P2** Nul dekking op de twee gewijzigde leespaden van `/analyse` → S30.
- **P3** Verweesde JSDoc, de rename niet doorgetrokken, een overbodige re-export → opgelost.

Drie bevindingen zijn pre-existing en staan in `BACKLOG.md` in plaats van hier meegepatcht.
