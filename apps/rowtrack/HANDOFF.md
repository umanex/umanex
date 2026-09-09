# HANDOFF.md — sessie-handoff (vooruitkijkend)

Dit bestand is de **vooruitkijkende tegenhanger** van `LEARNINGS.md`. Waar LEARNINGS de rauwe vangst van *fouten* is, houdt HANDOFF de open **onzekerheden, aannames, risico's, next steps en ideeën** bij die een sessie achterlaat — zodat een volgende sessie niet koud begint.

Entries komen erbij via de `sessie-reflectie` skill aan het einde van een sessie. De open items worden bij de start van een volgende sessie automatisch getoond via de user-level SessionStart-hook (`~/.claude/hooks/session-start-handoff.sh`). Niet handmatig bewerken tenzij je een status corrigeert.

## Waarom dit bestaat

Aan het einde van een sessie zit de meeste context in het hoofd van Claude en verdampt bij afsluiten: waar was ik het minst zeker over, welke aanname bleef onuitgesproken, wat breekt over 3 maanden, wat is de eerste zet volgende keer. HANDOFF vangt dat expliciet op zodat het meekomt.

Dit is **geen duplicaat van de eval-loop**. Een terugkerende *faalklasse* hoort in `LEARNINGS.md` (via `vastleggen`); een *durend feit* hoort in auto-memory. HANDOFF is enkel voor het vooruitkijkende, sessie-gebonden restant.

## Statussen

- `open` — vastgelegd bij reflectie, nog niet opgepakt. Wordt bij sessiestart getoond.
- `resolved` — opgepakt of beantwoord in een latere sessie; blijft staan als spoor, wordt niet meer getoond.

## Types

`onzekerheid` · `aanname` · `risico` · `next-step` · `idee` · `debt`

## Format

Elke entry staat onder een laag-header (`# Globaal`, `# Klant — {naam}`, `# Project — {app}`) en heeft deze vorm:

    ## YYYY-MM-DD — {korte titel} · [{type}]
    - **Bevinding:** {1-2 zinnen}
    - **Check:** {hoe je in één handeling vaststelt of dit nog openstaat}
    - **Volgende zet:** {concreet actiepunt of "-"}
    - **Status:** open

## Schrijf de check, niet de staat

`Bevinding` is per definitie een waarneming van toen: "de guard matcht alleen Tailwind-syntax", "CLAUDE.md is 32 123 chars". Zulke zinnen worden onwaar zodra de code eronder verandert, en niets in de lus merkt dat — de SessionStart-hook blijft het item elke ochtend tonen als openstaand werk, ook nadat het opgelost is. Op 2026-08-10 stond tien van de zesendertig rowtrack-entries zo verkeerd open; één ervan lokte vijf dagen na zijn oplossing alsnog een productvraag uit die al beantwoord was.

Daarom hoort er bij elke nieuwe entry een **`Check`**: hoe je in één handeling vaststelt of dit item nog leeft. Een commando is het beste (`grep -q 'periodType' apps/rowtrack/lib/period.ts`), een vraag met een eenduidig antwoord mag ook ("draaien `history/index.tsx` en `usePeriodGoal` door dezelfde `lib/period.ts`?"). Kun je er geen formuleren, dan is het item te vaag om over drie weken nog te beoordelen — herformuleer het tot je er wel een hebt.

De check wordt bij sessiestart mee getoond, en `sessie-reflectie` draait hem bij stap 1 vóór een item open blijft staan. Een check die door niets aangeroepen wordt, meet niets.

<!-- De sessie-reflectie skill voegt hieronder de juiste laag-header toe bij de eerste entry. -->
# Project — rowtrack

## 2026-08-16 — Twee calorieformules die elkaar kruisen, en de erg-waarde wordt weggegooid · [onzekerheid]
- **Bevinding:** De app rekent calorieën zelf uit en negeert het kcal-veld dat de erg meestuurt.
  Beide formules zijn nu uit de rauwe pakketten van twee volledige trainingen gereconstrueerd.

  **De app** (`apps/rowtrack/lib/calories.ts`) rekent via VO2:
  `vo2 = W·14,4/kg + 7`, `met = vo2/3,5`, `kcal = met·kg·h`. Dat vereenvoudigt tot
  **`kcal/h = 4,114·W + 2·gewicht`** — het gewicht komt er dus alleen via een constante term in,
  niet als schaalfactor. Terugrekenen uit de opgeslagen waarden geeft een impliciet profielgewicht
  van 85,9 kg (15/08) en 86,5 kg (16/08), consistent, dus de reconstructie klopt.

  **De erg** (FTMS Expended Energy, bit 8: totaal uint16 + per uur uint16 + per minuut uint8) volgt
  exact de Concept2-formule **`kcal/h = 3,442·W + 300`** — mediane afwijking 1,2 kcal/h over 1135
  slagen, en `perMin == floor(perHour/60)` in 1135 van 1135 gevallen. De parser slaat het veld
  bewust over: `apps/rowtrack/lib/ble/ftms-parser.ts:113` doet `offset += 5` met de comment
  *"Skipped — calories are calculated app-side"*.

  **De twee kruisen elkaar.** Bij 86 kg snijden ze op **189 W**: daaronder leest de app te laag,
  daarboven te hoog. "De app zit er 4-5% naast" is dus geen vaste uitspraak maar een functie van
  vermogen én lichaamsgewicht, met een tekenwissel erin. Het kruispunt schuift hard met gewicht:
  70 kg → 238 W · 80 kg → 208 W · 95 kg → 164 W · 110 kg → 119 W.

  Gemeten op de twee sessies (erg-teller eind-min-start tegen de opgeslagen `calories`):

  | Datum | Vermogen | Duur | Erg | App | Afwijking |
  |---|---|---|---|---|---|
  | 15/08 | 125 W | 1800 s | 363 kcal | 343 | −5,5% |
  | 16/08 | 138 W | 3416 s | 735 kcal | 703 | −4,4% |

  De erg-teller is **cumulatief sinds erg-reset**, niet sinds workoutstart: op 15/08 stond hij op 0
  bij aanvang, op 16/08 op 386. Overnemen vraagt dus eind-min-start, niet de absolute waarde.

  Eén verdachte die ná meting afvalt: `apps/rowtrack/lib/hooks/useWorkoutMetrics.ts:294-305`
  bemonstert elke 5 s puntsgewijs `currentWattsRef.current` in plaats van het intervalgemiddelde dat
  er vlak naast al bijgehouden wordt (`splitIntervalWattsSum/Count`). Nagerekend op 16/08 is dat
  137,84 W tegen 137,98 W tijd-gewogen — 0,5 kcal verschil op 703. Reëel maar verwaarloosbaar bij
  constant tempo; bij intervalwerk kan het kantelen, dus het blijft een latente kwestie, geen fout.

- **Volgende zet:** Niet meteen bouwen — dit is de diepe analyse die Jeroen apart wil doen. De
  open vragen: (1) welk getal is leidend voor een waterroeier, de C2-curve van de erg of een
  VO2-model, wetende dat de erg-formule gewichtsonafhankelijk is en dus per definitie fout voor
  lichte of zware roeiers; (2) is de VO2-formule in `calories.ts` überhaupt correct toegepast — hij
  gebruikt het gemiddelde vermogen over een interval, terwijl VO2 niet lineair in vermogen hoeft te
  zijn; (3) hoort er een `erg_calories`-kolom naast de eigen waarde te komen zodat de eigen formule
  ijkbaar wordt in plaats van onvergelijkbaar; (4) wat toont de app als het profielgewicht ontbreekt
  — `ActivePhase.tsx:396` zet er een asterisk bij, maar de default is 75 kg en dat verschuift het
  kruispunt naar 238 W. Ruwe data voor die analyse: de twee gedecodeerde opnames met het `kcal`-veld
  per pakket (de scratchpad van sessie 4632c7f0 is vluchtig — opnieuw opnemen kan via de opnameketen
  die in de referentiepagina staat beschreven).
- **Derde meting, live op de wire (2026-08-28).** Uit de Metro-log van een HR-debugsessie, dus
  zonder aparte opname: de Apollo XL stuurt het energieveld gewoon mee in elk type-B-pakket
  (`68 01 …`, flags `0x0168`, bit 8 gezet). Twee punten, rechtstreeks uit de bytes gelezen:
  `90 02` = **656 kcal/h bij 103 W** (C2-curve voorspelt 654,5 — Δ 1,5) en `26 03` = **806 kcal/h
  bij 147 W** (voorspeld 806,0 — Δ 0,03). De per-minuut-byte klopt in beide gevallen met
  `floor(perHour/60)` (10 resp. 13), en de totaalteller stond op 0 aan het begin van de sessie —
  wat de eerdere bevinding "cumulatief sinds erg-reset" bevestigt. De C2-curve is daarmee op drie
  onafhankelijke sessies bevestigd; de vraag is niet meer óf de erg een bruikbaar getal stuurt.
- **Check:** `grep -n "offset += 5" apps/rowtrack/lib/ble/ftms-parser.ts` — treffer = het
  energieveld wordt nog steeds overgeslagen en de vraag staat nog open; geen treffer = de parser
  leest het en er is een besluit gevallen. Aanvullend `grep -rn "erg_calories" apps/rowtrack` —
  treffer = de erg-waarde wordt naast de eigen bewaard en de formules zijn vergelijkbaar geworden.
- **Status:** open

## 2026-08-11 — Subtitle-action vuurt niet op synthetische taps; ALLE's a11y-frame staat scheef · [risico]
- **Bevinding:** Bij de sim-verify van #257-261: de `Subtitle`-action (WIJZIG op Home én Profiel)
  opent de GoalSheet niet bij Maestro/XCTest-taps — 4 pogingen, twee adresseer-modi (punt-tap op de
  exacte visuele positie én a11y-tekst-tap; WIJZIG's a11y-frame [299,195][382,211]pt klopt met de
  render, de tap landde op (340,203)pt, dead-center). Andere touchables (tabbar, Splits/Hartslag-
  toggle) vuren in dezelfde runs wél. Dit is exact het F3-symptoom uit de UX-audit van 2026-07-16
  ("5+ pixel-precieze robot-kliks vuurden nooit") — de hitSlop-fix uit `162eb45` heeft het dus níet
  weggenomen; die vergrootte het raakvlak, maar het mechanisme dat synthetische taps laat
  verdwijnen zit ergens anders. Daarbovenop een tweede defect: **ALLE's a11y-frame staat ~240pt te
  hoog** ([318,296][382,312]pt gerapporteerd terwijl de tekst op ~543pt rendert) — een tap op het
  a11y-frame landt midden in de doelkaart. VoiceOver gebruikt diezelfde frames: de focus-rechthoek
  tekent daar dus verkeerd en dubbeltik-activatie kan op beide plekken falen. Dat raakt de
  VoiceOver-pass die nog openstaat. Vinger-op-toestel vuurde WIJZIG wél (Jeroens waarneming,
  vóór de fix), dus het gebruikerspad werkt vermoedelijk — bewezen is dat niet.
- **Check:** Maestro-miniflow: `launchApp` → `tapOn: "(?i).*wijzig.*"` → opent de GoalSheet
  (Opslaan zichtbaar)? Nee = het item leeft. De flow-yamls van deze run staan niet in git; zes
  regels, zo herschreven.
- **Volgende zet:** Twee sporen. (a) Bij de VoiceOver-pass op het toestel expliciet WIJZIG en ALLE
  proberen te focussen en activeren — dat beslist of dit assistive tech raakt of alleen
  test-tooling. (b) BOUW-diagnose in `components/Subtitle.tsx`: waarom slikt de row synthetische
  taps in (Fabric/New-Arch touch-hittest?) en waarom rapporteert ALLE's node een verschoven frame;
  de `onEdit`-bedrading zelf is correct (`setGoalSheetOpen(true)`, app/(tabs)/index.tsx:216).
- **Status:** resolved (2026-09-09) — de Maestro-miniflow is niet gedraaid en vraagt een toestel of simulator. Verplaatst naar `apps/rowtrack/BACKLOG.md` (2026-09-09, toestel-ronde).

## 2026-08-11 — Adverteert de Apollo XL FTMS? · [onzekerheid]
- **Bevinding:** De rower-scan matcht sinds PR #276 primair op de geadverteerde FTMS UUID (0x1826), met naam-prefix "Rower" als vangnet. Of de Fluid Rower Apollo XL die UUID adverteert is niet vastgesteld — BLE-scan kan niet op de simulator. Adverteert hij hem wél, dan kan de prefix eruit en kan het filter op OS-niveau (`startDeviceScan([FTMS_SERVICE_UUID], …)`), wat scanruis en batterij scheelt.
- **Volgende zet:** Op de fysieke iPhone één scan starten met de Apollo XL aan en in de `[BLE]`-log de `adv:`-regel lezen. Let op: is `adv:` leeg, log dan ook `dev.overflowServiceUUIDs` vóór je concludeert dat hij niet adverteert — iOS parkeert service-UUIDs van sommige toestellen in de overflow area, en het predicaat leest alleen `serviceUUIDs`. De uitkomst documenteren in het commentaar van `apps/rowtrack/lib/ble/rowerCandidate.ts`, dan beslissen: prefix-vangnet houden of verwijderen.
- **Check:** `grep -n "is nog niet op het toestel" apps/rowtrack/lib/ble/rowerCandidate.ts` — treffer = de uitkomst is nog niet gedocumenteerd en dit item leeft; leeg = gedocumenteerd, item resolved.
- **Status:** resolved (2026-09-09) — check gedraaid: de zin staat nog in `rowerCandidate.ts`, dus de vraag leeft — maar hij is alleen op het toestel te beantwoorden. Verplaatst naar `apps/rowtrack/BACKLOG.md` (2026-09-09, toestel-ronde).

## 2026-08-05 — Unieke index op workouts staat nog niet in de database · [next-step]
- **Bevinding:** `supabase/migrations/add_workouts_unique_started_at.sql` staat op main maar is niet toegepast. Zolang die index ontbreekt, dekt de client alleen de race binnen één app-run: wordt de app afgesloten tussen een geslaagde insert en het wissen van de pending-slot, dan schrijft de volgende start dezelfde rit nog een keer weg en telt elke KPI-som hem dubbel.
- **Volgende zet:** Het bestand in de Supabase SQL Editor draaien (deze repo past migrations handmatig toe). Daarna controleren dat een tweede drain-poging netjes foutcode 23505 geeft in plaats van een tweede rij.
- **Status:** resolved — 2026-08-05: door Jeroen gedraaid in de SQL Editor. Geverifieerd via `pg_indexes`: `workouts_user_started_at_key` staat als UNIQUE btree op (user_id, started_at). De client vertaalt een tweede poging nu in foutcode 23505 en ruimt de pending-slot op in plaats van een duplicaat te schrijven.

## 2026-07-09 — IdlePhase merge + resterende varianten verifiëren · [next-step]
- **Bevinding:** IdlePhase goal-redesign zit op branch `feature/idlephase-goal-redesign` (commit `5635f6f`), niet gemerged. Enkel de Duur-variant is live op de simulator geverifieerd; none/distance/split/watts leunen op gedeelde-componenten-redenering.
- **Volgende zet:** De 5 doeltypes doorklikken op de simulator (m.n. Watt = actief segment uiterst rechts, en distance single-chip full-width + komma-decimaal), dan merge naar main + branch opruimen.
- **Status:** resolved — v1 gemerged (`9ce14f5`). Het variant-doorklik-punt keert terug in de v2 TC-EBC (branch `feature/idlephase-goal-suggestions`): enkel Duur live geverifieerd, geen idb voor auto-taps.

## 2026-07-09 — Scope-onzekerheid goal-redesign · [risico]
- **Bevinding:** De delta is afgeleid uit een Figma deep-read vs code, zonder zicht op het vórige design. Spacing (section 28, doel/picker 20), chip-hoogte 44→40 en de 0.20-fill kunnen bestaande drift zijn i.p.v. deel van "de aanpassing".
- **Volgende zet:** Bij Jeroen aftoetsen of enkel de nudge-bar/segments bedoeld waren; zo ja, de spacing/chip-extra's terugdraaien.
- **Status:** resolved — v2 (2026-07-09): Jeroen vroeg expliciet de toestel-, suggestie- én nudge-wijzigingen; de spacing/chip-drift is dus bewust deel van het design, niet terug te draaien.

## 2026-07-09 — 0.20 accent-selectie-fill zonder token · [debt]
- **Bevinding:** De actieve chip (Chip.tsx) én het actieve segment (GoalSegments.tsx) gebruiken `rgba(240,84,84,0.20)` hardcoded; er bestaat enkel `accent.muted` (0.12) en `accent.subtle` (0.06). Twee `// TODO`-markers wijzen ernaar.
- **Volgende zet:** Een `accent.selected` (0.20) token toevoegen via Tokens Studio → `tokens.json`, rebuilden, beide hardcodes vervangen.
- **Check:** `grep -rn "rgba(240, 84, 84, 0.20)" apps/rowtrack/components` — treffers = de hardcode staat er nog en `accent.selected` is niet gepusht; leeg = token gepusht en de plekken vervangen.
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — 0.20 accent-selectie-fill zonder token · [refactor]*; het is werk dat blijft liggen, geen handoff. De Check slaat nog aan: de 0.20-hardcode staat op drie plekken (Chip, GoalSegments en het gedeelde Segmented — de derde plek is sinds b19f521 van profile.tsx naar components/Segmented.tsx verhuisd),… — 2026-07-14: tint-richting bevestigd (0.20 wint van de audit-"solid"); token nog NIET toegevoegd. Er is nu een DERDE hardcode bij: het active segment in `profile.tsx`. Zodra de alias gepusht is → 3 plekken vervangen (Chip, GoalSegments, segmented).
  2026-08-06: opnieuw gecontroleerd na "tokens zijn aangepast" — er is **niets geland**.
  `tokens.json` staat nog op de push van 14 juli, geen tokens-sync-run, en een lokale
  `pnpm --filter rowtrack tokens:build` is een schone no-op. De wijziging is dus wel in Tokens
  Studio gemaakt maar niet naar GitHub gepusht. De hardcodes staan nu op vier plekken:
  `Chip.tsx:42`, `GoalSegments.tsx:157`, `Segmented.tsx:84` (elk met een `// TODO`) en
  `ActivePhase.tsx:686` (die laatste is bewust `accent.muted`, geen 0.20).

## 2026-07-09 — Chip value/unit-split is fragiele heuristiek · [risico]
- **Bevinding:** IdlePhase splitst de chip-value/unit met `label.endsWith(' ${unit}')`. Dit is gekoppeld aan het exacte label-formaat van de formatters; een wijziging daar breekt stil de italic-unit-rendering (of toont een verkeerde unit).
- **Volgende zet:** Overwegen om `{value, unit}` gestructureerd uit de WheelItem-builders door te geven i.p.v. het label te parsen.
- **Status:** resolved — v2 (2026-07-09): split gecentraliseerd in gedeelde `wheelItemParts(item)` (formatters.ts), nu de enige bron voor zowel WheelPicker als de chips. Nog steeds label-gebaseerd, maar op één plek i.p.v. gedupliceerd.

## 2026-07-09 — Out-of-scope design-vragen IdlePhase · [onzekerheid]
- **Bevinding:** (1) Figma toont Roeitrainer-dot + Hartslag-hartje in accent-rood, ook disconnected; code toont ze grijs (Ble/HrStatusBar state-logica). (2) `buttonTokens.primary.height` = 48 maar `Button.sizeLg` = `space['44']` (44) — Start-knop rendert 44.
- **Volgende zet:** Bij Jeroen bevestigen of (1) de indicator-kleur gelijkgetrokken moet en (2) `Button.sizeLg` naar `buttonTokens.primary.height` moet.
- **Check:** `grep -n "height:" apps/rowtrack/components/Button.tsx apps/rowtrack/constants/colors.ts | grep -E "space\['44'\]|height: 48"` — twee regels = 44 (Button.sizeLg) en 48 (buttonTokens.primary) staan nog uiteen; één regel = de keuze is gemaakt.
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — Out-of-scope design-vragen IdlePhase · [fix]*; het is werk dat blijft liggen, geen handoff. Deel (1) was al resolved. Deel (2) leeft: de Check geeft nog twee regels (Button.sizeLg = space['44'], buttonTokens.primary.height = 48). De kloof is intussen groter dan de entry wist: tokens.json… — (1) resolved in v2: nieuwe DeviceRow toont accent-rode dot/hart disconnected (Figma 32:374 bevestigde dit). (2) blijft open — Button.sizeLg (44) vs buttonTokens.primary.height (48) niet aangeraakt.

## 2026-07-10 — Reanimated toegevoegd: schone build vereist prebuild + pods · [next-step]
- **Bevinding:** De IdlePhase-animaties draaien nu op `react-native-reanimated` ~4.1 + `react-native-worklets` (native module, babel worklets-plugin). `/ios` + `/android` zijn gitignored (prebuild-patroon), dus de native module zit niet in git.
- **Volgende zet:** Op een verse checkout / na `pnpm install`: draai `expo prebuild` + `pod install` (of gewoon `expo run:ios`) vóór je bouwt — anders crasht de app op de ontbrekende native module. `pnpm install` alleen volstaat niet meer.
- **Status:** resolved — 2026-07-10 (eerdere "resolved: stale cache" was fout, herzien). De WorkletsError bleef terugkomen; na drie voorbarige root-cause-aannames (prebuild+pods → dubbele Metro → stale Metro-cache, elk gefalsifieerd) bleek het **doelwit** de sleutel. Op de **simulator** werkte de app schoon: de sim-binary bevat de native module wel degelijk (`nm RowTrack.debug.dylib` → 7330 worklets-symbolen incl. `WorkletsModule`), 3× screenshot-geverifieerd (10:11/10:24/10:32). De error kwam van de **fysieke iPhone 13 "umanex"** via de Expo dev-client (LAN `192.168.68.60`) — door Jeroen bevestigd. Die dev-client-build dateerde van vóór worklets → miste de native module. Config zelf overal correct (New Arch aan, babel-plugin `react-native-worklets/plugin` aanwezig, één install 0.5.1 binnen peer-range 0.5–0.8). Cache-clearen / sim-rebuild loste dit NIET op — de native module moest in de *toestel*-binary.
- **Fix (uitgevoerd + geverifieerd):** (1) Signing was onbestaand (0 identities, geen `DEVELOPMENT_TEAM`) → in Xcode via *Signing & Capabilities* een Apple ID + personal team gezet (cert "Apple Development: Jeroen Colpaert", team `7365H2CNR5`). (2) `npx expo run:ios --device "iPhone umanex"` → verse device-build compileerde de worklets-codegen (`rnworklets-generated.mm`), signde en installeerde op de telefoon. (3) Verificatie op het juiste doelwit: gelogde Metro op 8082 (poort die het toestel onthoudt) + app gelaunchd via `devicectl` → device haalde de app-bundle op (1541 modules) en voerde die uit met **0 Worklets-errors, 0 ERROR-regels, 0 "missing default export"-warnings** (die laatste wáren het crash-symptoom). Jeroen bevestigde visueel dat de app op de telefoon werkt. **Signing-caveat:** gratis cert vervalt na ~7 dagen → dan opnieuw `run:ios --device`.
- **Verfijning (diagnose-volgorde bij `WorkletsError`):** (0) **Identificeer eerst het doelwit** — sim én fysiek toestel kunnen tegelijk aan dezelfde Metro hangen; verifieer op hetzelfde toestel waar de gebruiker de fout ziet (deze hele saga kwam doordat ik op de sim verifieerde terwijl Jeroen op zijn telefoon keek). (1) Zit de native module in de draaiende binary? `nm <app>/RowTrack.debug.dylib | grep -ic worklet` (debug-code zit in de dylib, niet in het launcher-executable — `nm RowTrack` geeft misleidend 0). (2) `grep -i worklets babel.config.js` — plugin aanwezig? (3) `grep -i reanimated ios/Podfile.lock` — pod gelinkt? Mist de doelwit-binary de module → rebuild+install op dát toestel (`expo run:ios --device` voor fysiek, `expo run:ios` voor sim); op een verse checkout zonder `ios/` eerst `expo prebuild` + pods. Zie ook [[rowtrack-verify-render-path]].

## 2026-07-10 — Profile-datumpicker erft de wheel-restyle · [onzekerheid]
- **Bevinding:** `WheelPicker` wordt gedeeld door de Geboortedatum-BottomSheet in `profile.tsx` (dag/maand/jaar). Die erft nu 5 rijen (i.p.v. 3, hoogte 132→250) én de edge-fade naar `bg.base`, terwijl de BottomSheet-surface `bg.elevated` is (fade ~ΔE 2-3, quasi onzichtbaar). Review flagde dit als cosmetisch, niet-blokkerend (BottomSheet scrollt, geen clipping).
- **Volgende zet:** Bij Jeroen aftoetsen of de datumpicker de trainings-wheel-look mag erven, of een `surfaceColor`/`visibleRows`-prop verdient.
- **Status:** resolved — 2026-07-14: Jeroen koos de goal-wheel-look. WheelPicker kreeg exact de voorspelde `visibleRows` + `surface`-props (fade → bg.elevated in sheets) + `showPill`; datum = 3 kolommen zonder labels + één gedeelde band; lengte/gewicht ook naar wheels. Sim-geverifieerd (PR #124/#126).

## 2026-07-10 — Segment-breedte snapt (Fabric layout-animatie taboe) · [debt]
- **Bevinding:** De actieve goal-segment verbreedt instant (snap) i.p.v. vloeiend te morphen. Zowel RN `LayoutAnimation` als Reanimated `LinearTransition` herintroduceren de Fabric stale-width clipping (gedeactiveerd segment houdt label-breedte). Enkel de remount ruimt die op, en remount sluit een layout-animatie uit. Verschijning (pill+label) is wél buttery via Reanimated `entering`.
- **Volgende zet:** Bij een latere Reanimated/Fabric-versie opnieuw proberen, of een gelijk-brede-segmenten + schuivende-pill variant overwegen (wijkt af van de variabele-breedte Figma-look — nu bewust afgewezen door Jeroen).
- **Check:** `grep -nF '${selected === type}' apps/rowtrack/components/GoalSegments.tsx` — een treffer = de remount-key (en dus de snap) staat er nog; leeg = vervangen door een layout-animatie of door gelijk-brede segmenten.
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — Segment-breedte snapt (Fabric layout-animatie taboe) · [ux]*; het is werk dat blijft liggen, geen handoff. De remount-key staat er nog (GoalSegments.tsx:120, mét het commentaar waarom). De voorwaarde 'bij een latere Reanimated/Fabric-versie opnieuw proberen' is niet ingetreden: package.json pint nog…

## 2026-07-10 — Best-2000m: BLE-reconnect midden in workout re-baselinet niet · [debt]
- **Bevinding:** De nieuwe `{t,d}`-samplereeks (voor de exacte beste-2000m) baselinet `initialElapsed`/`initialDistance` enkel in `resetAll` (bij Start), niet op een auto-reconnect. `ble-service.attemptReconnect()` reset `lastMetrics` ook niet. Reset een erg zijn eigen elapsed/distance-tellers bij reconnect (onbekend voor Concept2, "sommige FTMS"), dan gaan post-reconnect samples negatief → `sanitize()` in `bestDistanceTime.ts` gooit ze weg. Faalmodus is veilig: **nooit een vals-snelle PR**, hooguit data-verlies van het na-reconnect-fragment (best-2k uit het vóór-fragment of `null`). Review reproduceerde de mechaniek maar zette het op `real=false` wegens onzekere trigger + veilige degradatie.
- **Volgende zet:** Als een reële erg dit ooit vertoont: op reconnect de baseline opnieuw zetten (of `lastMetrics` resetten) en de reeks bewust in een nieuwe run laten starten i.p.v. stil te droppen. Nu bewust niet gebouwd.
- **Check:** `grep -rn reconnect apps/rowtrack/lib/hooks/useWorkoutMetrics.ts` — geen treffer = het meetpad kent geen reconnect en zet de baseline dus niet opnieuw.
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — Best-2000m: BLE-reconnect midden in workout re-baselinet niet · [fix]*; het is werk dat blijft liggen, geen handoff. De Check bevestigt dat het meetpad nog geen reconnect kent: useWorkoutMetrics.ts baselinet initialElapsed/initialDistance alleen bij het eerste pakket en reset ze alleen in resetAll. ble-service.ts…

## 2026-07-10 — Best-2000m capture end-to-end onbevestigd op echte erg · [next-step]
- **Bevinding:** Het `bestTimeForDistance`-algoritme is machine-geverifieerd (19/19 unittests + 800k fuzz vs O(N²)-referentie), maar de capture in `useWorkoutMetrics` draaide nooit op echte hardware. Drie onbevestigde aannames: (1) Jeroens erg bundelt distance+elapsed in één packet (CLAUDE.md zegt ja, code is er defensief tegen); (2) notificatie-cadans zit ver onder de 3s-dropout-floor (~1Hz) — een trage erg rond 2-3s kan spurious splits geven; (3) de dedup-per-hele-seconde laat de laatste fractionele seconde vóór 2000m vallen (bewust, geschat <1s ruis). `samples`-payloadgrootte op een lange rit ook niet gemeten.
- **Volgende zet:** Eén echte ≥2000m rit op de fysieke iPhone-build → de opgeslagen `samples` in Supabase inspecteren (vorm, dichtheid, grootte, monotoon), best-2k tegen een handberekening checken, en bevestigen dat de tile een plausibele tijd toont. Bij trage cadans: de 3s-floor heroverwegen. **Dit is de #1 eerste zet.**
- **Status:** resolved — 2026-07-12: geverifieerd op een echte ≥2000m rit (workout `1cd91154`, 4269m/1288s, 1289 samples). `best_2k_seconds`=583.667 → tile toont **9:43.7** (2:25.9/500m) — happy-path getal rendert ✓. Samples exact 1Hz (min=max Δt=1s), monotoon (0 non-monotoon t, 0 dalende d), 0 dropouts >3s, first `[0,0]`/last `[1288,4269]`. Payload **9.4 KB** jsonb voor 4269m → ruim binnen grenzen (open vraag payloadgrootte beantwoord). Opgeslagen `best_2k_seconds` == herberekening met het échte `bestTimeForDistance` op de opgeslagen samples (delta **0.000s**) → sluit tegelijk de [aanname] dat de bevroren afgeleide betrouwbaar is. Bonus uit dezelfde reeks: 500m 2:24.0 / 1000m 2:24.6 (splits lopen fysiologisch plausibel op); 5000m → `null` (rit te kort, geen crash). Eerdere 657m-verificatie (2026-07-11, workout `ec6844d3`) dekte al de te-korte-sessie edge case en de conservatieve pauze-afhandeling.

## 2026-09-07 — best_2k_seconds is een bevroren afgeleide waarde (sinds 2026-07-10) · [aanname]
- **Bevinding:** `best_2k_seconds` wordt bij opslaan berekend en opgeslagen (net als `best_split`). De ruwe `samples` staan er ook, dus herberekening is mogelijk — maar niets herberekent automatisch. Wijzigt de algoritme- of pauze-/moving-time-semantiek later, dan houden bestaande rijen hun oude waarde tot een expliciete backfill.
- **Volgende zet:** Bij een semantiek-wijziging: een migratie/script dat `best_2k_seconds` (en toekomstige 500m/1k/5k) uit `samples` herberekent voor alle rijen. Nu niet nodig.
- **Check:** `git log --oneline 3b223b2.. -- apps/rowtrack/lib/bestDistanceTime.ts; git diff 3b223b2 HEAD -- apps/rowtrack/lib/hooks/useWorkoutMetrics.ts | grep -E '^[+-].*(samplesRef|initialElapsed|initialDistance|lastSampleSecond)'` — beide leeg = afleiding én sample-semantiek ongewijzigd, de bevroren best_2k_seconds-waarden kloppen nog; komt er uit één van beide een regel, dan is dat het startsein voor het herbereken-script over `workouts.samples`.
- **Herformuleerd:** 2026-09-07 — De Check is leeg: bestDistanceTime.ts is sinds 3b223b2 (2026-07-14) niet gewijzigd, dus de bevroren waarden kloppen nog met de afleiding. Ook de sample-producent (samplesRef.push, baselines, lastSampleSecond in useWorkoutMetrics.ts) is in die periode…
- **Status:** open

## 2026-07-13 — Actions read/write-rechten voor tokens-sync workflow · [next-step]
- **Bevinding:** `tokens-sync.yml` (nu live op `main`, PR #106) commit de gegenereerde `constants/*` + CSS terug via `GITHUB_TOKEN` met `permissions: contents: write`. Dat wordt gecapt als de repo-instelling op read-only staat → de auto-commit-stap faalt bij de eerste échte Tokens Studio-push (een no-op run zonder diff slaagt wél, dus de blocker is nu nog onzichtbaar).
- **Volgende zet:** GitHub → Settings → Actions → General → *Workflow permissions* → **"Read and write permissions"**. Jeroen-actie, buiten de repo. Optioneel daarna: één test-push vanuit Tokens Studio om de round-trip te bevestigen.
- **Status:** resolved — 2026-07-14: Jeroen zette de repo op "Read and write permissions" (geverifieerd `default_workflow_permissions: "write"` via `gh api`).

## 2026-07-13 — Active-workout redesign gemerged zonder live render-verify · [risico]
- **Bevinding:** F3 hero-labels + KPI/subtitle-resync + de Albert Sans-typografie zijn naar main gemerged (PR #106), maar het active-fase-scherm zélf is nooit live gerenderd — de sim bereikt de active workout niet zonder verbonden erg (BLE bridget niet naar de sim). Verificatie leunde op spec-parity tegen de Figma-frame-dumps + tsc + de build-guard, niet op een render. Home/idle zijn wél sim-geverifieerd.
- **Volgende zet:** De active workout op de fysieke iPhone met de erg doorlopen (5 doeltypes: hero-labels, KPI-rijen, de nieuwe Albert Sans op waardes/units), of het mock-pad hieronder bouwen. **#1 eerste zet.**
- **Status:** resolved — 2026-07-13: via het mock-pad hieronder (`app/dev-active.tsx`) alle 5 doeltypes op de sim gerenderd en visueel geverifieerd tegen de Figma-frames — F3 hero-labels, resync-KPI-labels (Totaal afstand/Kcal), None-5-rijen (F7), distance-"m", Albert Sans-typografie, split=groene / watts=amber divider. Portrait; landscape nog niet (vereist sim-rotatie).

## 2026-07-13 — __DEV__ mock-pad voor de active-fase ontbreekt (terugkerende blocker) · [idee]
- **Bevinding:** De active-fase kan enkel met een verbonden erg gerenderd worden; er is geen pad om `phase='active'` + een doel + fake metrics te forceren. Dit blokkeerde deze sessie de render-verify van F3, de resync én de typografie-sync, en blokkeerde eerder al redesign-iteraties. Meermaals aangeboden, nooit gebouwd.
- **Volgende zet:** Een klein `__DEV__`-mock-pad dat de active-fase (5 hero-varianten + KPI's) met testdata forceert, zodat elke active-workout-wijziging voortaan op de sim te verifiëren is zonder hardware.
- **Status:** resolved — 2026-07-13: gebouwd als `app/dev-active.tsx` (__DEV__-route). Deep-link `rowtrack://dev-active?goal=none|duration|distance|split|watts` (param-gedreven, schone screenshots) + een switcher-balk. Bypasst de BLE-gate via `bleStatus:'connected'` + mock metrics; rendert `ActivePhase` standalone. Uitbreidbaar naar summary/idle op dezelfde manier.

## 2026-07-13 — tokens-sync workflow nooit in echte CI gedraaid · [risico]
- **Bevinding:** `tokens-sync.yml` is lokaal gevalideerd (YAML, pnpm-filters, beide token-builds idempotent, DTCG-guard, guard-vuurt-test) maar nooit op GitHub Actions uitgevoerd. Onbevestigd in de echte omgeving: dat de `GITHUB_TOKEN`-auto-commit lukt (hangt aan de Actions read/write-instelling), dat die push géén loop triggert (paths-filter zou dat moeten voorkomen), en het gedrag bij eventuele branch-protection op main.
- **Volgende zet:** Ná het aanzetten van de Actions-schrijfrechten: één echte Tokens Studio-push observeren (Actions-tab) en bevestigen dat de constants correct terug-committen; faalt het → workflow-logs nakijken.
- **Status:** resolved — 2026-07-14: eerst via `workflow_dispatch` groen (run 29327011562, schone no-op commit-back), daarna een échte Tokens Studio-push (hero-tokens, `3646cff`) → CI committe de constants terug (`1b45aff`). Round-trip volledig dicht.

## 2026-09-07 — Live Figma text-style re-verify nog niet gedaan (sinds 2026-07-13) · [onzekerheid]
- **Bevinding:** De typografie-sync (8 typeStyles → Albert Sans) is bevestigd via mijn audit-lezing + jouw autoritaire `tokens.json`-push + de sim-render, maar niet tegen de *live* Figma text styles — de Desktop Bridge plugin was losgekoppeld. Delta klopte exact, dus laag risico, maar niet onafhankelijk tegen de huidige Figma gecheckt.
- **Volgende zet:** Heropen de Desktop Bridge plugin in Figma (hangt aan geen server-instance; 3 draaien op 9223/9224/9225 door reconnect-churn) → `figma_get_text_styles` lezen en diffen tegen de code-typeStyles.
- **Check:** Met Desktop Bridge actief (`figma_get_status`): `figma_get_text_styles` op file T1bGrvIzSNeLyh5CbarATZ lezen en per stijl fontFamily/fontSize/lineHeight/letterSpacing diffen tegen de 18 entries van `typeStyles` in `apps/rowtrack/constants/typography.ts` (regels 68-165); nul verschillen = resolved en de uitkomst in `apps/rowtrack/figma-map.md` vastleggen, anders is de delta het werk. Geen Bridge = `[NIET TE VERIFIËREN — geen Bridge]`, niet terugvallen op REST.
- **Herformuleerd:** 2026-09-07 — De Check geeft alleen de TODO- en HANDOFF-regels zelf, dus de live Figma-lezing is nooit gedaan. Erger: het doel is intussen verschoven — constants/typography.ts is ná 2026-07-13 nog drie keer gewijzigd (3646cff 'font size & hero' 07-14, tokens-sync 1b45aff…
- **Status:** open

## 2026-07-13 — Split/Watts DOEL-pill copy: code ≠ Figma · [onzekerheid]
- **Bevinding:** De frames tonen `DOEL | 2:20 split` en `DOEL | 180W`; de code houdt `2:20/500m` en `180 W` (`goalPillValue()` in ActivePhase.tsx). Bewust niet overgenomen — ambigue micro-copy op eerder-buiten-scope varianten, en `/500m` is preciezer. Render-geverifieerd dat de code de huidige format toont.
- **Volgende zet:** Beslissen of de code de frame-copy overneemt of blijft. Eén plek: `goalPillValue()`.
- **Status:** resolved — 2026-07-14: beslist op het `{waarde} {eenheid}`-spatie-patroon: split → `2:20 split` (frame-copy overgenomen), watts → `180 W` behouden (Figma's `180W` verworpen als spatie-slip). Dode `buildGoalLabel` opgeruimd (PR #115).

## 2026-07-13 — Landscape active-workout niet render-geverifieerd · [next-step]
- **Bevinding:** Het mock-pad (`app/dev-active.tsx`) rendert de active-fase in portrait; landscape (50/50-hero-kolom + verticale progress-bar) is niet gescreenshot — sim-rotatie is niet via `simctl` te automatiseren.
- **Volgende zet:** In de sim roteren (Cmd+→) met het mock-pad open en de 5 varianten in landscape checken, of een `?orientation`-forcering aan het dev-pad toevoegen (override useWindowDimensions).
- **Status:** resolved — 2026-07-14: landscape gerenderd via mock-pad + sim-rotatie tijdens de kolom-padding-fix (PR #127). Rotatie blijkt wél automatiseerbaar — via `osascript` System Events (Cmd+→), niet via `simctl`.

## 2026-07-14 — Segmented control (Geslacht/Doel-sheets) layout niet geverifieerd · [onzekerheid]
- **Bevinding:** Jeroen flagde "layout van de tabs binnen bottom sheets is niet correct". Zonder het sheet-design (Console was down) heb ik een best-guess container-`border.default`-frame op `segmentedRow` gezet. Niet getoetst tegen `52:9155` (Geslacht) / `52:9730` (Doel) — mogelijk fout of onvolledig.
- **Volgende zet:** `52:9155` deep-readen (Console na herstart, of native `get_design_context`), de segmented-track + active-pill-spec vergelijken en de frame-keuze bevestigen/corrigeren.
- **Status:** resolved — 2026-07-15: `52:9155`/`52:9730` + input `52:9892` deep-read via Desktop Bridge. Segmented gecorrigeerd naar de Figma-spec (track radius 8 / active-pill radius 4 genest, `bg.base`-fill + `border.strong`, inactief Regular `fg.tertiary`); inputs radius 12→8. Root cause van de "overflow" bleek de BottomSheet-`ScrollView` (hug-collapse, `flexShrink:0`), niet de radius. PR #131, op toestel geverifieerd (Geslacht + Email keyboard-open).

## 2026-07-14 — sheetFieldLabel-token niet tegen sheet-design geverifieerd · [aanname]
- **Bevinding:** `sheetFieldLabel` (PERIODE/TYPE/WACHTWOORD e.d.) teruggezet naar `fg.tertiary` op basis van het rij-label-patroon uit `52:8768` (main), niet tegen een sheet-frame. Sectie-labels bleken fg.secondary, rij-labels fg.tertiary — sheet-veld-labels zijn niet direct bevestigd.
- **Volgende zet:** Bij de segmented-check (`52:9155`/`52:9730`) meteen de veld-label-kleur bevestigen.
- **Check:** `grep -n -A3 'sheetFieldLabel: {' 'apps/rowtrack/app/(tabs)/profile.tsx'` — `fg.tertiary` = de profiel-sheets wijken nog af van de tegen Figma 388:2256 bevestigde veld-labelkleur `fg.secondary` (`components/GoalSheet.tsx:194-199`).
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — sheetFieldLabel-token niet tegen sheet-design geverifieerd · [fix]*; het is werk dat blijft liggen, geen handoff. De aanname leeft nog en het sluiten ervan is klein, concreet werk: één Figma-lezing van een profiel-sheet-frame en daarna (waarschijnlijk) één kleurwissel in profile.tsx. De sheet-frames bestaan…

## 2026-07-14 — figma-console (Desktop Bridge) MCP viel weg; native als fallback · [risico]
- **Bevinding:** Midden in de sessie dropte de figma-console MCP-**server**-connectie (harness↔server), niet enkel de plugin. De tools verdwenen uit de toolset en herverbinden van de plugin bracht ze niet terug — dat vergt een Claude Code-**herstart**. Native Figma MCP (`claude_ai_Figma`, fileKey `T1bGrvIzSNeLyh5CbarATZ`) wérkte wél als fallback en gaf getokeniseerde design-context.
- **Volgende zet:** Herstart Claude Code om Console (projectregel: primair) te herstellen vóór verder Figma-werk; anders bewust native gebruiken en het melden.
- **Status:** resolved — 2026-07-15: na herstart werkte figma-console (Desktop Bridge, poort 9223) weer volledig — `figma_get_status`/`figma_capture_screenshot`/`figma_execute`/deep-read succesvol gebruikt voor de segmented + input parity (#131). Console is primair, geen native fallback nodig geweest.

## 2026-07-14 — 4-jul audit-re-triage: resterende werkstromen · [next-step]
- **Bevinding:** De re-triage (`briefings/2026-07-14-retriage-audit-design-vs-code.md`, PR #117) zette 130/215 items als obsoleet; van de 7 werkstromen zijn de beslissings-ws (3/4/5/6) genomen en WS1 (Profile-polish) grotendeels gedaan. Open: WS2 (component-tokenlaag exporteren → Tokens Studio), WS7 (off-token design-waarden → Figma tokeniseren) en de dekkingsgaten (auth-schermen login/register zonder Figma-design; GoalSetupModal; connection-overlay).
- **Volgende zet:** WS2 + WS7 zijn grotendeels jouw Tokens Studio/Figma-hand; de coverage-gaten (auth-schermen designen) apart inplannen.
- **Check:** `grep -c goalPill apps/rowtrack/tokens/tokens.json apps/rowtrack/constants/colors.ts` — 1 in de bron en 0 in de build-output = WS2 (component-tokenlaag) ligt er nog; WS7 is Figma-zijde en niet uit de repo te lezen.
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — 4-jul audit-re-triage: resterende werkstromen · [refactor]*; het is werk dat blijft liggen, geen handoff. De Check zegt dat WS2 (component-tokenlaag) er nog ligt en tokens.json is sinds 2026-07-14 niet meer aangeraakt; WS7 is Figma-zijde en niet uit de repo te lezen. Van de drie dekkingsgaten is er één…

## 2026-07-15 — Geen privacybeleid / rechtsgrond / consent voor (gezondheids)PII · [next-step]
- **Bevinding:** Security-audit 2026-07-15 **P1-1** (`apps/rowtrack/audits/2026-07-15-security-audit-rowtrack.md`). RowTrack verzamelt e-mail + voornaam én gezondheids-nabije data (hartslag avg/max + volledige per-tick HR-tijdreeks in `workouts.samples`, gewicht/lengte/geboortedatum/geslacht in `profiles`) zonder privacybeleid, rechtsgrond (AVG art. 6), transparantie-notice (art. 13) of consent. Hartslag+biometrie kunnen als bijzondere categorie (art. 9) gelden.
- **Volgende zet:** Privacybeleid schrijven (verantwoordelijke = umanex/Jeroen, datacategorieën incl. hartslag, rechtsgrond, retentie, verwerker = Supabase) + linken bij signup en in Profiel; expliciete opt-in voor de gezondheidsdata. Niet-code werk — bij Jeroen.
- **Check:** `curl -sL -o /dev/null -w '%{http_code}' https://umanex.be/rowtrack/privacy` → 404 = beleid nog niet bereikbaar, 200 = rond. De `-L` is niet optioneel: umanex.be stuurt apex-verkeer met een 308 naar `www`, en zonder volgen leest de check die redirect als antwoord — een derde uitkomst die de legenda niet kent. (Gemeten 2026-08-11: 308 → `www.umanex.be/rowtrack/privacy` → 404.)
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — Geen privacybeleid / rechtsgrond / consent voor (gezondheids)PII · [infra]*; het is werk dat blijft liggen, geen handoff. Alles behalve de bereikbaarheid van het beleid is gebouwd (consent-scherm, beleidstekst, publieke pagina). Wat overblijft is infra-werk met een release-blokkerend karakter: rowtrack-web heeft geen… — sterk versmald. Gebouwd: het toestemmingsscherm met opt-in en intrekken (`451e251`), het privacybeleid (`812240f`) en een publieke pagina in `apps/rowtrack-web`. **Wat rest is één ding:** `PRIVACY_POLICY_URL` moet ook echt bereikbaar zijn — op 2026-08-07 gaf hij 404. Toestemming die naar een onbereikbaar beleid verwijst is niet "geïnformeerd", dus dit blijft de blocker.

## 2026-07-15 — Geen in-app account-verwijdering (AVG art. 17 + store-blocker) · [next-step]
- **Bevinding:** Security-audit 2026-07-15 **P1-2**. Geen verwijder-actie in de app; `profiles` heeft geen DELETE-RLS-policy, dus het datamodel ondersteunt het niet eens. AVG recht-op-vergetelheid niet invulbaar + **zekere** Apple (Guideline 5.1.1(v))/Play-afwijzing bij store-submission (niet enkel een risico). Vereist het eerste server-side stuk in dit project.
- **Volgende zet:** `Account verwijderen`-actie (Profiel) → Supabase **Edge Function** met `supabase.auth.admin.deleteUser(user.id)` (client mag admin-API niet); de bestaande `ON DELETE CASCADE` op workouts/profiles ruimt de rest op. Apart inplannen (introduceert server-side + service-role-key).
- **Status:** resolved — 2026-08-10. Gebouwd in commit `40568a2`; deze sessie geverifieerd tegen de code: `supabase/functions/delete-account/index.ts` leidt de gebruiker af uit het auth-token (niet uit de request-body), en `app/(tabs)/profile.tsx:381` roept hem aan. Het item stond alleen nog open omdat niemand hem sloot.

## 2026-07-15 — Sentry error-/crash-monitoring: koppeling uitgesteld · [next-step]
- **Bevinding:** Security-audit 2026-07-15 **P2-3** (geen error-/crash-monitoring). `@sentry/react-native` werd kort geïnstalleerd maar op vraag weer verwijderd — de eigenlijke Sentry-koppeling doen we in een **latere fase**. Er staat nu een console-gebaseerde `reportError()`-shim in `lib/monitoring.ts` die de voorheen stil ingeslikte read-/save-fouten opvangt (P2-2/P2-4); die functie is het aanhechtpunt.
- **Volgende zet:** Later: `pnpm --filter rowtrack add @sentry/react-native@~7.2.0` + `@sentry/react-native/expo` config-plugin in `app.json` + `Sentry.init({ dsn })` in `initMonitoring()` (DSN via `EXPO_PUBLIC_SENTRY_DSN`, Jeroen levert) + `reportError()` laten doorschrijven naar `Sentry.captureException` + een global `ErrorBoundary` + **native rebuild** (`expo run:ios --device` — cf. de worklets-les: een native module zit anders niet in de dev-client-binary, [[rowtrack-verify-render-path]]).
- **Check:** `grep -q '@sentry/react-native' apps/rowtrack/package.json` → geen hit = koppeling nog niet gelegd.
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — Sentry error-/crash-monitoring: koppeling uitgesteld · [infra]*; het is werk dat blijft liggen, geen handoff. Bewust uitgesteld werk met een volledig uitgeschreven bouwplan en een bestaand aanhechtpunt; er is sindsdien niets van gebouwd (geen Sentry-dependency, geen ErrorBoundary, de shim draagt nog de…

## 2026-07-15 — Wheel-sheets (#131 flexShrink + #133 pill/fade) niet op toestel geverifieerd · [next-step]
- **Bevinding:** De BottomSheet-herschrijving (`flexShrink:0`, #131) en de WheelPicker pill/fade-parity (#133) zijn naar main gemerged zonder dat ik de Lengte/Gewicht/Geboortedatum-sheets visueel heb gezien — enkel `tsc`-groen + Geslacht/Email geverifieerd. 2026-07-16: de Lengte-sheet is tijdens de UX-audit op de **sim** gezien — wheels clippen niet, pill/fade ok.
- **Volgende zet:** Op **toestel** Lengte/Gewicht/Geboortedatum naast Figma leggen (sim-check is gedaan, device-check blijft de open helft).
- **Check:** Alleen jij kunt dit beantwoorden: heb je Lengte, Gewicht en Geboortedatum op de iPhone naast Figma gelegd? Nee = open — geen commit of screenshot legt een toestel-check vast.
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — Wheel-sheets (#131 flexShrink + #133 pill/fade) niet op toestel geverifieerd · [test]*; het is werk dat blijft liggen, geen handoff. De toestel-check is nooit vastgelegd en de code die hij zou toetsen is sinds 2026-07-15 functioneel niet veranderd (enkel de i18n-extractie raakte BottomSheet). De sim-helft is gedaan (2026-07-16).…

## 2026-09-07 — BottomSheet flexShrink:0 — small-device keyboard-clip mogelijk (sinds 2026-07-15) · [risico]
- **Bevinding:** `bodyScroll` staat op `flexShrink:0` (fix voor de hug-collapse-clip die de segmented-track onderaan afkapte). Bij een keyboard-open sheet met veel content (Email) wordt de sheet omhoog getild (paddingBottom = keyboardhoogte); op een klein toestel kan (content + lift) `maxHeight:90%` overschrijden → de top clipt, want `flexShrink:0` scrollt niet. Niet gezien op iPhone 13/17 Pro (past net).
- **Volgende zet:** Email-sheet met keyboard testen op een klein toestel (SE); clipt het → body `flexShrink` conditioneel op 1 zetten wanneer keyboard open, of de lift cappen.
- **Check:** Twee stappen in één handeling: (1) `git log --oneline cd09074.. -- apps/rowtrack/components/BottomSheet.tsx` → leeg = het risico gaat nog over deze code; (2) op een iPhone SE (3rd gen, 667pt) simulator: Profiel → E-mail-sheet → wachtwoordveld focussen (toetsenbord open) → screenshot. Sheet-header (titel + sluitknop) volledig in beeld én `emailError` zichtbaar na een fout wachtwoord = resolved (risico bestaat niet op het kleinste toestel); clipt de bovenkant = omzetten naar een fix-item met de formule uit HANDOFF.md:304-308.
- **Herformuleerd:** 2026-09-07 — Het risico leeft en is nooit bevestigd: op iPhone 13/17 Pro past het net, en een clamp-fix van 2026-08-06 is na review bewust teruggedraaid omdat hij erger was dan het risico (onderkant afgekapt zonder scroll-affordance, foutmelding onder de vouw op iPhone…
- **Status:** open — 2026-08-06: een fix gebouwd (expliciete `maxHeight` op de body zolang het
  toetsenbord open staat, uit vensterhoogte − toetsenbord − safeTop − gemeten header/footer) en na
  review **teruggedraaid**. Drie bevestigde bevindingen maakten hem een slechtere ruil dan het
  risico zelf: (1) de clamp kapt de ÓNDERkant van de body af zonder scroll-affordance
  (`showsVerticalScrollIndicator={false}`) en zonder auto-scroll naar het gefocuste veld — op een
  SE valt het onderste veld van de e-mail-sheet buiten beeld; (2) `emailError` is het laatste kind
  van `bodyContent`, dus op een **iPhone 13** (het toestel waarop deze app geverifieerd wordt) valt
  de foutmelding bij een verkeerd wachtwoord onder de vouw — de gebruiker ziet de spinner stoppen
  en verder niets; (3) de rekensom was 8pt te ruim: `footer.marginTop` (space['16']) ontbrak en
  `bodyContent.paddingBottom` werd dubbel afgetrokken (die zit ín de contentContainer en dus al
  binnen de maxHeight).
- **Voor de volgende poging** (met een toestel/sim erbij, want zonder render-check is dit niet af
  te maken): de juiste ondergrens is
  `B <= windowHeight − K − safeTop − headerH − footerH − (32 + 16 + 16 + 20)`,
  en de clamp heeft twee begeleiders nodig — een zichtbare scroll-affordance zodra hij bijt, en
  feedback (foutmeldingen) buiten de scroll, bijvoorbeeld tussen ScrollView en footer.

## 2026-07-15 — secureStorage chunking-wrapper ongetest + nu live · [risico]
- **Bevinding:** De P2-1 `lib/secureStorage.ts` gechunkte Keychain-adapter is non-triviaal en zonder tests naar main gemerged (#132) op basis van `tsc`-groen + additief/degradeert-veilig-redenering; de native rebuild is intussen gedaan → hij is nu het actieve auth-storage-pad. Een bug in de chunk-read/write kan stil een sessie droppen (de AsyncStorage-fallback vangt enkel een ontbrekende native module op, geen logica-bug).
- **Volgende zet:** Let op onverwachte uitlog-events bij dagelijks gebruik; bij twijfel de chunk-splitsing in `secureStorage.ts` reviewen/unit-testen.
- **Status:** resolved — 2026-08-06: de splitsing is nagelopen en er zaten twee echte defecten in,
  allebei empirisch gereproduceerd vóór de fix. (1) `CHUNK_SIZE` telde JS-tekens terwijl de
  SecureStore-grens 2048 **bytes** is: 2000 accenttekens werden 4000 bytes, het dubbele. (2)
  `slice()` knipt op UTF-16 code units, dus een surrogaatpaar (emoji) precies op de grens ging
  gehalveerd de bridge over — elk halfje is op zich geen geldige UTF-8, dus de weer samengevoegde
  sessie kwam stil corrupt terug en de gebruiker werd zonder aanwijsbare reden uitgelogd.
  Nu wordt er op UTF-8 byte-grootte gesplitst, per code point (`for...of`), met 1800 bytes marge.
  Geverifieerd met een harness die de functies letterlijk uit de bron knipt en met Node's
  type-stripping draait: 10 gerichte cases (leeg, grens, accenten, emoji op de grens, CJK, gemengd)
  plus 300 fuzz-cases — elke chunk ≤ 1800 bytes en byte-identiek na een UTF-8 round-trip per deel.
  Vandaag is de sessieblob puur ASCII, dus geen van beide defecten was al zichtbaar; ze werden
  scherp zodra er ooit een naam of emoji in de `user_metadata` belandt.
- **Blijft open als aparte vraag:** er is nog altijd geen testrunner in deze repo (de verificatie
  hierboven was een wegwerp-harness in de scratchpad). Een vaste runner is een dependency-keuze
  voor Jeroen — hij zou ook `bestDistanceTime` en `formatters` afdekken.

## 2026-07-15 — CI Node-20-deprecation zit in de actions, niet in node-version · [onzekerheid]
- **Bevinding:** De `node-version: 20 → 22`-bump (#135) verhoogt het build-runtime, maar de deprecation-annotatie ("forced to run on Node.js 24") gaat over de *actions* zelf (`actions/cache@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4`) die intern Node 20 bundelen — niet over `node-version`. Die annotatie blijft dus waarschijnlijk verschijnen. Ik heb dit richting Jeroen aanvankelijk verkeerd toegeschreven aan de bump.
- **Volgende zet:** Monitoren; de action-majors bumpen zodra ze een Node-24-versie uitbrengen, of de niet-blokkerende warning bewust accepteren.
- **Check:** `grep -n 'actions/cache@\|actions/setup-node@\|pnpm/action-setup@' .github/workflows/ci.yml` → nog @v4 = de annotatie blijft komen.
- **Status:** resolved — 2026-09-07: verplaatst naar `BACKLOG.md` (repo-root) als *2026-09-07 — CI Node-20-deprecation zit in de actions, niet in node-version · [infra]*; het is werk dat blijft liggen, geen handoff. De onzekerheid uit de titel (toeschrijving aan node-version vs. de actions) is in de entry zelf al beslecht; wat overblijft is een dep-bump van drie GitHub Actions naar hun Node-24-majors zodra die…

## 2026-07-15 — rowtrack CLAUDE.md Supabase-schema is stale · [next-step]
- **Bevinding:** De schema-tabel in `apps/rowtrack/CLAUDE.md` lijst `created_at`/`distance_m`/`avg_split`; de echte kolommen zijn `started_at`/`distance_meters`/`best_split` (+ `best_2k_seconds`, `samples`) — bevestigd doordat de P2-6 perf-indexes op die kolommen zijn aangemaakt. De doc-tabel misleidt bij DB-werk.
- **Volgende zet:** De Supabase-tabellen-sectie in `apps/rowtrack/CLAUDE.md` bijwerken naar de echte kolomnamen.
- **Status:** resolved — de schematabel staat er niet meer; `apps/rowtrack/CLAUDE.md` zegt nu "lees het schema live via de `supabase-rowtrack` MCP-server (`list_tables`)". Deze entry vroeg om een fix die al gebeurd was.

## 2026-07-16 — Summary KPI-band toont ENERGIE dubbel (4e KPI ontbreekt) · [debt]
- **Bevinding:** In het samenvattingsscherm (`ActivePhase.tsx`, summary Modal KPI-band) staan AFSTAND/DUUR bovenaan en ENERGIE/ENERGIE eronder — de calorieën-cel is een copy-paste, de 4e KPI ontbreekt. Pre-existing op main (niet in de flow-diff), maar sinds de auto-save-flow is dit hét eindscherm dat elke rit toont (stop én doel-bereikt), dus nu prominenter (review 2026-07-16 wf_d16eec5f-075, P2).
- **Volgende zet:** Figma Summary (43:8278) KPI-band raadplegen voor de bedoelde 4e metriek en de tweede ENERGIE-cel vervangen.
- **Status:** resolved — Figma 43:8278 bevestigt de 4e KPI = **totale slagen**; tweede ENERGIE-cel vervangen door SLAGEN (`summaryTotalStrokes` + `correctSpm`, sim-geverifieerd → 95). Bridge was toen weer open.

## 2026-07-16 — MilestoneOverlay is dead code na verwijderen milestone-toasts · [debt]
- **Bevinding:** De 25/50/75%-milestone-toasts zijn verwijderd; `components/MilestoneOverlay.tsx` + de barrel-export in `components/workout/index.ts` blijven achter zonder gebruiker. tsc/lint blijven groen, maar het is maintenance-debt.
- **Volgende zet:** Bij bevestiging van Jeroen: `MilestoneOverlay.tsx` verwijderen + de export uit `components/workout/index.ts` halen (verwijderen vergt bevestiging, CLAUDE.md-regel).
- **Status:** resolved — 2026-07-16: Jeroen bevestigde, component + barrel-export verwijderd (PR #140).

## 2026-07-16 — Auto-save flow end-to-end onbevestigd op echte erg · [next-step]
- **Bevinding:** De nieuwe einde-flow (doel-bereikt → `disconnect()` + `saveWorkout()` → celebration → samenvatting → home; en handmatig stop → save → samenvatting) is per stuk geverifieerd (renders, tsc, adversariële review wf_d16eec5f-075, geen P0/P1), maar nooit als runtime-keten op een echte BLE-sessie gereden. Onbevestigd: exact-1×-opslaan, opgeslagen getallen == summary, BLE eindigt disconnected, en géén zichtbare "Zoeken naar roeier…"-flits achter de translucente celebration-card bij de disconnect.
- **Volgende zet:** #1 eerste zet — een echte rit op de fysieke iPhone/erg: doel-bereikt én handmatig stop, en bovenstaande vier punten naast elkaar leggen.
- **Status:** resolved (2026-07-16 — Jeroen reed beide paden op de echte erg: doel-bereikt én handmatig stop, beide slaan correct op via de auto-save)

## 2026-07-16 — Aanname: doel-bereikt beëindigt de rit (geen doorroeien) · [aanname]
- **Bevinding:** Jeroen koos "doel-bereikt → celebration → samenvatting", maar dat de rit dáár stopt (`disconnect()` in de goal-reached-effect, je roeit niet verder) is een eigen invulling, niet expliciet bevestigd.
- **Volgende zet:** Bij Jeroen aftoetsen. Wil hij ná het doel kunnen doorroeien → de goal-reached-effect (save + disconnect) herwerken (bv. save als checkpoint, pas stoppen op expliciete actie). UX-audit 2026-07-16 (**F7**) voegt toe: de celebration-knop "Ga verder" verhult dat de rit al beëindigd is — minstens de copy expliciet maken ("Bekijk samenvatting"), of de doorroei-optie bouwen.
- **Status:** resolved — 2026-08-07: Jeroen bevestigde dat een bereikt doel de rit hoort te
  beëindigen; doorroeien is bewust geen optie. De aanname was dus juist en de goal-reached-effect
  (save + disconnect + stopHR) blijft zoals hij is. De F7-helft is meteen weggewerkt: de
  celebration-knop heet nu "Bekijk samenvatting" i.p.v. "Ga verder" — die laatste suggereerde dat
  je nog verder kon roeien, terwijl de rit op dat moment al opgeslagen en losgekoppeld is. Eigen
  copy-sleutel (`workout.celebration.viewSummary`), want de samenvatting-knop houdt "Ga verder".

## 2026-07-16 — Translucente celebration-card gebruikt hardcoded rgba · [debt]
- **Bevinding:** `MotivationalToast.tsx` card-bg is `rgba(33, 36, 44, 0.75)` (= `bg.raised` @ 75%) met `// TODO` — er is geen token voor een translucente `bg.raised`. Drift-gevoelig als `bg.raised` wijzigt.
- **Volgende zet:** Een `bg.raised`-alpha-token (of overlay-token) toevoegen via Tokens Studio → `tokens.json`, rebuilden, de hardcode vervangen.
- **Check:** `grep -rn "rgba(33, 36, 44, 0.75)" apps/rowtrack/components` — één treffer (`MotivationalToast.tsx:196`) = er is nog geen translucente `bg.raised`-rol; leeg = token gepusht en vervangen.
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — Translucente celebration-card gebruikt hardcoded rgba · [refactor]*; het is werk dat blijft liggen, geen handoff. De hardcode staat er nog exact zoals beschreven en tokens.json heeft geen translucente bg.raised-/overlay-rol. Het is een token-push (Tokens Studio) plus één vervanging — bouwwerk dat blijft liggen,…

## 2026-07-16 — BLE-replay test-harness voor de workout-flow · [idee]
- **Bevinding:** De workout→save→summary-flow is niet testbaar zonder fysieke erg; deze sessie liep daar herhaaldelijk tegenaan (auto-save flow enkel per stuk geverifieerd).
- **Volgende zet:** Een harness die een opgenomen FTMS-packetreeks (fixture) door `useWorkoutMetrics` + `useGoalProgress` + de save-flow speelt, zodat dubbel-save/empty-guard/disconnect-timing deterministisch getest worden. Bouwt voort op de bestaande `dev-active`-harness.
- **Check:** `git ls-files apps/rowtrack | grep -Ei 'replay|fixture|\.test\.ts$'` — alleen `lib/ble/adapterReady.test.ts`, `lib/ble/hrLink.test.ts` en `lib/ble/rowerCandidate.test.ts` (BLE-bedrading, geen flow) = nog geen packetreeks die door `useWorkoutMetrics` en de save-flow loopt.
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — BLE-replay test-harness voor de workout-flow · [test]*; het is werk dat blijft liggen, geen handoff. Er is nog geen enkele fixture of packetreeks die door useWorkoutMetrics/useGoalProgress en de save-flow loopt; de zes committed tests zijn allemaal pure-logica/BLE-bedrading (adapterReady, hrLink,…

## 2026-07-16 — UX-audit P1: WIJZIG-doellink onraakbaar/mogelijk dood + sub-44pt targets · [risico]
- **Bevinding:** UX-audit 2026-07-16 **F3** (`audits/2026-07-16-ux-audit-rowtrack.md`). De Subtitle-action (WIJZIG op de doel-kaart) is ±16pt hoog zonder padding/hitSlop (`components/Subtitle.tsx:44-53`) en vuurde in 5+ pixel-precieze robot-kliks op Home én Profiel nooit, terwijl het identieke "ALLE" wél werkte. Ook sub-44: chevron-backs 40×40, password-reveal 36×36, Chips 40pt.
- **Volgende zet:** Eerst op toestel met een vinger checken of WIJZIG überhaupt werkt; daarna Subtitle-action padding + hitSlop ≥44pt geven (of de hele doel-kaart tappable maken) en de overige sub-44-targets meenemen.
- **Status:** resolved (code) — 2026-08-10, commit `162eb45`. `Subtitle` heeft hitSlop naar 44pt plus `accessibilityRole`/`Label`; wachtwoord-oog, detail-chevron en chips zijn mee. Jeroen bevestigde op de erg dat WIJZIG wérkt maar mikken vroeg — dat was de aanleiding. De vingertoets ná de fix staat in het toestel-blok.

## 2026-07-16 — UX-audit P1: a11y-pass (contrast + labels + dynamic type) · [next-step]
- **Bevinding:** UX-audit 2026-07-16 **F4**, exact berekend: inactieve tab-labels `fg.quaternary` op `bg.raised` = 2.47:1 (fail), witte 18px-knoptekst op `accent.default` = 3.44:1 (fail AA-klein), `status.error` op raised = 4.12:1, quaternary-chevrons 2.85:1 (non-text 3:1 fail). Accessibility-props op 6 van ±79 touchables; `Button.tsx` heeft er geen; geen `maxFontSizeMultiplier`-vangnet bij vaste hoogtes.
- **Volgende zet:** Inactieve tabs → `fg.tertiary` (4.73:1 ✓); knoptekst zwaarder/donkerder óf accent verdiepen (token-keuze Jeroen); `accessibilityRole/Label` op Button/TabLabel/rijen/backs; VoiceOver-pass op toestel.
- **Status:** resolved (code) — 2026-08-10, PR #259. `fg.quaternary` komt in app-code nergens meer voor, `accessibilityRole` staat op de gedeelde primitives en de profielrijen, en `maxFontSizeMultiplier` waar een vaste hoogte niet kan groeien. **Twee helften blijven bij jou:** de VoiceOver- en dynamic-type-pass (render-item 2026-08-10) en de knoptekst-contrastkeuze (token-item 2026-08-10).

## 2026-07-16 — UX-audit P1: vergelijkingszin split/watt loopt tegen de schermrand · [next-step]
- **Bevinding:** UX-audit 2026-07-16 **F5**, live gezien: de coaching-zin ("Je levert 10 W minder dan je doel", 36px) rendert edge-to-edge — `subtitleText` zonder horizontale padding in een `heroPanel` zonder paddingHorizontal (`ActivePhase.tsx` activeStyles). Copy-randje: "Je bent 0 seconden sneller" op exact doeltempo.
- **Volgende zet:** `paddingHorizontal: space['20']` op de zin of het paneel; copy-variant "Op doeltempo" bij verschil 0. Effort XS.
- **Status:** resolved (code) — 2026-08-10, PR #261. Eigen stijl met `paddingHorizontal: space['20']`, plus de "op doel"-copy bij verschil 0. Het kíjken staat in het render-item van 2026-08-10.

## 2026-07-16 — UX-audit P2: stille fouten rond het periode-doel · [next-step]
- **Bevinding:** UX-audit 2026-07-16 **F6**. `usePeriodGoal` exposeert geen error en Home leest ook `loading` niet — een gefaalde fetch is identiek aan "geen doel" (sectie verdwijnt stil); Home mist een "stel een doel in"-CTA (Profiel heeft die wél); GoalSheet-Opslaan zonder periode/type-keuze schrijft stil `NO_GOAL` (geen `disabled={!isValid}` zoals GoalSetupModal).
- **Volgende zet:** `error`/`loading` uit `usePeriodGoal` consumeren op Home (+ ErrorState/skeleton), doel-CTA op Home, validatie-guard op GoalSheet-Opslaan.
- **Status:** resolved (code) — 2026-08-10, PR #261. `usePeriodGoal` exposeert `error`, Home consumeert `error` én `loading`, de CTA staat er, en GoalSheet-Opslaan is disabled tot de keuze compleet is. Het kíjken staat in het render-item van 2026-08-10.

## 2026-07-16 — UX-audit P2: "Week/Maand" = rollend op Historiek vs kalender in het doel · [onzekerheid]
- **Bevinding:** UX-audit 2026-07-16 **F8**. Historiek filtert rollend (laatste 7 dagen/maand, `history/index.tsx:57-64`); `usePeriodGoal` rekent kalenderweek/-maand. Live staat "DEZE MAAND 22.3 km" naast Historiek-"Week 22.33 km" — leest als dezelfde stat met andere precisie.
- **Volgende zet:** Productkeuze Jeroen: één definitie kiezen, of de Historiek-labels expliciteren ("Laatste 7 dagen").
- **Status:** resolved — 2026-08-05, commit `e247059`. `lib/period.ts` is nu de enige bron voor zowel de historiek-filter als `usePeriodGoal`, allebei kalendergebaseerd; de labels zeggen "Deze week" / "Deze maand". De twee getallen kúnnen niet meer uiteenlopen. Dit item stond vijf dagen verkeerd op open en vroeg op 2026-08-10 nog om een productkeuze die al gemaakt was — de aanleiding voor deze opruiming.

## 2026-07-16 — UX-audit P2: laad-flits "roeier" + sectie-pop-in op Home · [next-step]
- **Bevinding:** UX-audit 2026-07-16 **F9**, live gezien: cold start toont "GOEDEMIDDAG, roeier" (fallback) die naar de echte naam flitst; DEZE MAAND- en PR-secties ontbreken tijdens de fetch en poppen in (layout-shift). Alleen de trainingslijst heeft een spinner.
- **Volgende zet:** Naam pas tonen ná de fetch (of skeleton), sectie-skeletons voor doel/PR-blok.
- **Status:** resolved (code) — 2026-08-10, PR #261. Skeletten voor de begroeting, de doelkaart en het PR-blok. Het kíjken staat in het render-item van 2026-08-10.

## 2026-07-16 — UX-audit P2: getal-/unitformattering inconsistent · [next-step]
- **Bevinding:** UX-audit 2026-07-16 **F10**. Decimaalpunt ("22.3 km", "9:10 min") naast duizendtal-punt ("7.515 m") — zelfde teken, twee betekenissen (NL zou komma-decimaal zijn); "0:17 min" voor een 17-seconden-rit; "2.500m" (zonder spatie) vs "7.515 m" (met).
- **Volgende zet:** Eén formatter-conventie kiezen (komma-decimaal of consequent punt-duizendtal) + unit-spatie gelijktrekken; zit geconcentreerd in `lib/formatters.ts`.
- **Status:** resolved (code) — 2026-08-10, PR #260. Punt = duizendtal, komma = decimaal, één spatie vóór de eenheid; beide scheiders staan nog op twee plekken (`t.format` en `formatInt`/`formatDecimal`). Het kíjken staat in het render-item van 2026-08-10.

## 2026-07-16 — UX-audit P2: geen datavisualisatie (HR-verloop, split-trend) · [idee]
- **Bevinding:** UX-audit 2026-07-16 **F11** (was F8 op 13/07): nul grafieken in een data-product, terwijl `workouts.samples` (1Hz t/d/hr-reeks) er al ligt. Grootste zichtbare waardesprong na de P0's: Useful 4→5, Desirable 4→5.
- **Volgende zet:** Detail-Hartslag: HR-over-tijd + zones; Detail-Splits: staafjes per 500m; Home: mini-trend. Design eerst (Figma), dan `figma-naar-code`.
- **Check:** `grep -c react-native-svg apps/rowtrack/package.json` — 0 = geen tekenlaag in de app, dus nog steeds nul grafieken.
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — UX-audit P2: geen datavisualisatie (HR-verloop, split-trend) · [feature]*; het is werk dat blijft liggen, geen handoff. Nog steeds geen tekenlaag en geen grafieken; niets in de git-historie sinds 2026-08-06 raakt dataviz. Dit is een feature (design eerst in Figma, dan figma-naar-code), geen onzekerheid.

## 2026-07-16 — UX-audit P2: mid-workout doel wijzigen is gebouwd maar onbereikbaar · [onzekerheid]
- **Bevinding:** UX-audit 2026-07-16 **F12**. `GoalSetupModal` is volledig bedraad in `ActivePhase` (state, handlers, render), maar niets roept `setShowGoalModal(true)` aan — de DOEL-pill is een kale View. Feature bestaat in code, geen gebruiker kan hem triggeren.
- **Volgende zet:** Productkeuze Jeroen: DOEL-pill tappable maken (feature aan) óf het pad verwijderen (dead weight weg).
- **Status:** resolved — 2026-08-10, PR #260. Jeroen koos het dode pad weg te halen; `GoalSetupModal` en zijn config zijn verwijderd. Er valt niets meer te beslissen.

## 2026-07-16 — Lopende BLE-scan overleeft disconnect() (ghost-reconnect mogelijk) · [risico]
- **Bevinding:** Review-vondst bij de P0-fixes (cross-file tracer): `RowerBleService.disconnect()/cleanup()` roept nooit `manager.stopDeviceScan()` aan — dat gebeurt alleen ín de scan-callback. Pre-existing gat, maar de nieuwe overlay-Stop naast "Opnieuw proberen" geeft het een tweede ingang: Retry-scan starten → meteen Stop → de scan loopt door en kan later alsnog verbinden → spook-status 'connected' op het Idle-scherm.
- **Volgende zet:** `stopDeviceScan()` toevoegen aan `cleanup()`/`disconnect()` in `lib/ble/ble-service.ts` (klein, maar dat bestand is nu in de i18n-flight — na die merge oppakken); daarna Retry→Stop-scenario op toestel naspelen.
- **Status:** resolved (code) — 2026-08-06: één eigenaar voor de scan-staat (`stopScan()`), gebruikt
  in `cleanup()`, bij scan-start, in de timeout, in de error-tak en bij een gevonden toestel.
  Twee dingen kwamen pas in de review boven, en zonder allebei was de fix een verslechtering:
  **(a)** `BleManager` is een procesbrede **singleton** (`static sharedInstance`) — deze service en
  `HRBleService` delen letterlijk één manager, één native scan en één `_scanEventSubscription`. Een
  onvoorwaardelijke `stopDeviceScan()` in `cleanup()` sloopte dus een lopende **hartslag**-scan, die
  daarna stil "geen hartslagmeter gevonden" meldt. Er is nu een `scanActive`-vlag: we stoppen alleen
  onze eigen scan. **(b)** `startScan()` deed drie awaits (module laden, adapterstatus, op Android de
  permissiedialoog) vóór `startDeviceScan()`, zonder abort-check — een `disconnect()` in dat venster
  liet de scan alsnog starten, precies de spookscan die dit item beschrijft. Daar staat nu een
  `intentionalDisconnect`-check.
- **Nog te doen:** het Retry→Stop-scenario en een HR-scan-naast-roeier op **toestel** naspelen; dit
  is statisch geverifieerd tegen de ble-plx-bron, niet gereden.

## 2026-08-06 — HR- en roeier-dienst delen één BleManager-singleton · [debt]
- **Bevinding:** Bovengekomen bij de scan-fix hierboven. `RowerBleService.getManager()` en
  `HRBleService.getManager()` doen allebei `new BleManager()`, maar ble-plx geeft door
  `static sharedInstance` hetzelfde object terug. Er is dus één native scan en één
  `_scanEventSubscription` voor twee diensten die denken dat ze hun eigen scanner hebben. De
  `scanActive`-vlag dekt nu één richting af (wij slopen de HR-scan niet meer); de andere richting
  staat nog open: `HRBleService.startDeviceScan()` overschrijft de gedeelde subscription van een
  lopende roeier-scan. Pre-existing, ouder dan de fix van vandaag.
- **Volgende zet:** ~~Eén gedeelde scan-arbiter voor beide diensten~~ — gebouwd op 2026-08-22
  (`fix/gedeelde-ble-scan`). `scan-lock.ts` serialiseert nu het *starten*: `requestScan` zet een
  tweede aanvraag in de wachtrij in plaats van te verdringen, en beide diensten starten hun scan
  én hun timers binnen die callback. De `ownsScan`-bail in `decide()` is weg — dát was het
  mechanisme waardoor de verliezer nooit meer een status publiceerde.
- **Wat de aanleiding scherper maakte dan dit item wist:** het is niet alleen de verliezer die
  stilvalt. Gemeten op 2026-08-22 (JS-console van de dev-client): HR-scan om 12:35:57.543, roeier
  om 12:35:57.988, en dáárna 25 seconden lang geen enkele treffer — tot een verse scan er binnen
  150 ms twee vond. MultiplatformBleAdapter disposet de oude scan-subscription pás ná het starten
  van de nieuwe, en die dispose doet `centralManager.stopScan()`; de winnaar gaat dus mee onderuit.
  Notificeren van de verdrongen dienst zou dat niet hebben opgelost, serialiseren wel.
- **Nog te doen:** op **toestel** naspelen. De lijst is met de merge van
  `fix/hr-verbinding-na-app-wissel` (2026-08-22) langer geworden, want die bracht een tweede
  verbindingspad mee:
  1. Twee taps binnen een seconde — hartslag, dan roeier — en de omgekeerde volgorde.
  2. Stop tikken terwijl een herstelpoging aan het verbinden is. De rij hoort op 'idle' te
     blijven; vóór de fix kwam ze ná de samenvatting weer groen terug met een levende BPM.
  3. Tijdens een lopende herstelpoging zelf op Verbinden tikken en een ánder toestel kiezen.
     De oude lus mag daarna niet alsnog met het vorige toestel verbinden (generatie-token).
  4. Verbinden tikken terwijl de roeier scant, en dan wachten: de wachtende scanaanvraag mag
     ná een geslaagde directe verbinding geen 'geen hartslagmeter gevonden' meer opleveren.
  Statisch getoetst met `npm run test` (51 tests, beide suites; met het oude verdringende
  gedrag vallen er 5 om, dus de suite meet echt) en `tsc --noEmit`.
- **Check:** `grep -c 'requestScan' apps/rowtrack/lib/ble/scan-lock.ts` — 0 = de arbiter is weg of
  teruggedraaid en de HR-scan kan een lopende roeier-scan weer overnemen; ≥1 = de serialisatie staat
  er nog.
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — HR- en roeier-dienst delen één BleManager-singleton · [test]*; het is werk dat blijft liggen, geen handoff. De code-kant is af en niet teruggedraaid (scan-lock-arbiter staat, plus latere deterministische-test-fix en de HR-meetbaarheidsfix van 28/08). Wat rest is uitsluitend het naspelen van de vier… — code staat, toestel-verificatie ontbreekt

## 2026-07-16 — UX-audit P3-verzamellijst (F13–F19) · [next-step]
- **Bevinding:** UX-audit 2026-07-16, §5 P3: "← OVERZICHT"-backlink botst met de tab "Overzicht" (F13); icon-only inactieve doelsegmenten (F14); BPM-rij is onzichtbaar tappable (F15); Android-back genegeerd op 3 modals (F16); geen-doel-variant toont afstand dubbel (F17); dode/ongebruikte UX-lagen — paceZone/pulseAnim/prFlags-props, KPI.tsx, SectionHeader.tsx, live SplitsList, 3× rgba-0.20-hardcode, confetti-kleuren (F18); kcal-asterisk zonder legende (F19).
- **Volgende zet:** Backlog — oppakken per gelegenheid; details en aanbevelingen staan per item in `audits/2026-07-16-ux-audit-rowtrack.md`.
- **Check:** `ls apps/rowtrack/components/KPI.tsx apps/rowtrack/components/SectionHeader.tsx && grep -c "backLink: 'OVERZICHT'" apps/rowtrack/i18n/translations/nl.ts` — beide bestanden plus 1 = er is niets van F13–F19 opgepakt; verandert er iets, hertriageer de zeven tegen `audits/2026-07-16-ux-audit-rowtrack.md`.
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — UX-audit P3-verzamellijst (F13–F19) · [ux]*; het is werk dat blijft liggen, geen handoff. De Check slaat nog volledig aan: beide dode componenten bestaan en worden nergens geïmporteerd, de '← OVERZICHT'-backlink rendert nog op het detailscherm (F13), en paceZone/pulseAnim worden nog…

## 2026-07-16 — Live-metric "bevriest" bij rust i.p.v. → 0 · [onzekerheid]
- **Bevinding:** Sinds de KPI/hero de huidige gesmoothe waarde tonen (i.p.v. gemiddelde), houden watts/spm/split hun laatste actieve waarde vast bij een mid-workout rust: ble-service nult watts/spm/pace bij idle, de EMA stapt dan niet, dus "Huidige kracht" blijft bv. 180 W tonen terwijl je rust. Matcht het pre-existing hero-hold-gedrag; opslag/summary zijn onaangeroerd (P3, review 2026-07-16 wf_5c5eced8-52c).
- **Volgende zet:** Product-keuze bij Jeroen — wil je dat de "huidige" waarde bij een echte idle-transitie (beide 0) naar 0 zakt (waarheidsgetrouwer, maar toont 0 tijdens rust), of bewust vasthoudt? Zo "naar 0": bij het idle-packet (`instantaneousPower==null && strokeRate==null`) `wattsSmoothed/spmSmoothed` op 0 zetten + EMA-refs resetten; split kan vasthouden (pace ongedefinieerd bij stilstand).
- **Status:** resolved — 2026-08-07: Jeroen koos "naar 0". Watts en spm zakken nu naar 0 bij rust
  en de EMA-refs gaan mee leeg, zodat de eerste haal daarna vers seedt in plaats van vanaf de oude
  waarde omhoog te kruipen. **Split gaat níet naar 0** maar naar `Infinity` → `formatSplit` toont
  "—": bij stilstand is het tempo ongedefinieerd, en "0:00" zou "oneindig snel" betekenen. Om
  dezelfde reden start `splitSmoothed` nu ook op `Infinity` i.p.v. 0 (vóór de eerste haal stond er
  "0:00"). De omslag vereist **twee** opeenvolgende idle-packets, zodat een erg die tijdens de
  recovery even niets rapporteert geen flikkering geeft.
- **Op toestel bevestigd — 2026-08-10.** Geen flikkering, maar wel merkbaar traag. Dat bleek uit
  drie lagen te bestaan, niet één. Twee zijn weg (PR #248): de bevestigings-packet bleef in de
  dedupe van `ble-service` hangen en kwam alleen door als een ongerelateerd veld toevallig bewoog —
  op een erg die zijn klok bij pauze stilzet was de tegel dus nóóit naar 0 gegaan; en staat
  `totalDistance` stil, dan is bevestiging overbodig (een recovery laat het vliegwiel draaien, een
  pauze niet). Jeroen bevestigde de nieuwe timing op de erg. De derde laag staat hieronder.

## 2026-07-16 — Keychain-accessibility auth-refresh-fix nog device-verificatie nodig · [next-step]
- **Bevinding:** De red-box "Calling 'getValueWithKeyAsync' has failed → User interaction is not allowed" bij de GoTrue auto-refresh (gelockt scherm) is gefixt: de auth-token wordt nu geschreven met `keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` (`lib/secureStorage.ts`, PR #146). Op de sim niet reproduceerbaar (geen echt keychain-lock-gedrag); enkel geverifieerd dat auth niet regresseert (app boot ingelogd).
- **Volgende zet:** Op de fysieke iPhone bevestigen: inloggen → app één keer op de voorgrond laten verversen (zodat bestaande items met de nieuwe accessibility herschreven worden) → scherm vergrendelen → wachten op een refresh-tick → red-box mag niet meer verschijnen.
- **Check:** Alleen jij kunt dit beantwoorden: heb je op de iPhone na inloggen het scherm vergrendeld en een refresh-tick zonder red-box gezien? Nee = open.
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — Keychain-accessibility auth-refresh-fix nog device-verificatie nodig · [test]*; het is werk dat blijft liggen, geen handoff. De fix staat nog in de code en is sinds PR #146 niet teruggedraaid; de toestel-bevestiging (gelockt scherm → refresh-tick zonder red-box) is nergens vastgelegd. Dat is geen open onzekerheid over de…

## 2026-07-16 — Profiel-`handleSave` wordt nergens aangeroepen (velden persisteren mogelijk niet) · [risico]
- **Bevinding:** Ontdekt tijdens de GoalSheet-refactor: `handleSave()` in `app/(tabs)/profile.tsx` (de enige `supabase.from('profiles').update(...)` voor naam/geslacht/lengte/gewicht/geboortedatum/spm_halved) heeft **geen call-site** — de veld-sheets (saveVoornaam/…) stpage'n enkel naar state, er is geen hoofd-save-knop. Enkel email persisteert apart (handleEmailChange). Vermoedelijk persisteren die profiel-velden dus **niet**. Het doel is nu wél veilig (de nieuwe zelf-persisterende GoalSheet, PR ná #147). Grep-geverifieerd, niet op toestel getest.
- **Volgende zet:** Op toestel testen: een profielveld (bv. lengte) wijzigen → app herstarten → blijft de wijziging? Zo nee: elke veld-sheet zelf laten persisteren (zoals GoalSheet), of een hoofd-save toevoegen die `handleSave` aanroept. Buiten scope van de GoalSheet-taak.
- **Status:** resolved — 2026-07-16: bevestigd als UX-audit **P0-F1** en gefixt (branch `fix/rowtrack-audit-p0`): per-sheet `persistProfile`-write (patroon GoalSheet), sheet sluit pas na succes, `loading` op de Opslaan-knoppen, SPM-switch optimistic + rollback; dode `handleSave` verwijderd. Live geverifieerd op de sim: Voornaam-Opslaan bumpte `profiles.xmin` 1882→2084 + `updated_at` → nu (write bewezen), sheet sloot. Device-check (wheel-waarde wijzigen → herstart) blijft nuttig als na-controle.

## 2026-08-04 — RowTrack dwingt de hele monorepo in één platte node_modules · [debt]
- **Bevinding:** De root `.npmrc` zet `node-linker=hoisted` + `shamefully-hoist=true` omdat Metro slecht omgaat met pnpm-symlinks. Gevolg: de héle workspace deelt één platte `node_modules` met één `react`. RowTrack pint `react@19.1.0` (Expo 54), de vier Next 14-apps willen `^18` — react 19 wint aan de root terwijl `react-dom` op 18.3.1 blijft, en een postinstall-script in de root `package.json` symlinkt daarom elke app-`react` naar `next/node_modules/react`. Die constructie breekt zodra een nieuwe dependency de resolutie verschuift: `pnpm add recharts` in cashflow liet `next/node_modules/react` verdwijnen en elke Next-build viel om met `ReactCurrentDispatcher of undefined`. Omgekeerd geprobeerd (branch `chore/react-resolutie`, PR #170): met de geïsoleerde layout resolven alle vier de Next-apps correct hun eigen react 18 + react-dom 18 en slagen alle builds (`turbo build type-check lint --force`, 14/14) — maar Metro faalt dan op `Unable to resolve module @expo/metro-runtime`, want dat pakket staat **niet** in `apps/rowtrack/package.json` en werd enkel gevonden dankzij de hoisting. Phantom dependency; er zitten er vermoedelijk meer.
- **Correctie op die diagnose (2026-08-05):** `@expo/metro-runtime` was geen phantom dependency — de oorzaak lag één laag dieper, in `apps/rowtrack/metro.config.js`: `config.resolver.disableHierarchicalLookup = true`. Dat dwong Metro om uitsluitend in `apps/rowtrack/node_modules` en de workspace-root te kijken en nooit omhoog te lopen vanaf het importerende bestand. Onder de platte layout stond alles in de root en viel dat niet op; onder de geïsoleerde layout staan de dependencies van een package náást dat package in `.pnpm/`, en is dat omhooglopen precies het mechanisme. `whatwg-fetch` bijvoorbeeld staat gewoon gedeclareerd in `@expo/metro-runtime`, maar Metro mocht er niet kijken. De regel was ooit toegevoegd om te voorkomen dat Metro een tweede React zou vinden — een probleem dat onder de geïsoleerde layout per constructie niet meer bestaat.
- **Opgelost met:** hierarchical lookup weer aan; `@babel/runtime` en `expo-modules-core` (die wél echt niet gedeclareerd waren, `lib/orientation.ts` importeert de tweede rechtstreeks) toegevoegd aan `apps/rowtrack/package.json`; root `.npmrc` en het symlink-postinstall weg; `apps/rowtrack/.npmrc` leeggemaakt omdat pnpm `node-linker` workspace-breed behandelt en een per-package waarde negeert.
- **Geverifieerd:** schone install (`rm -rf node_modules apps/*/node_modules packages/*/node_modules` + `CI=true pnpm install`), `turbo build type-check lint --force` 14/14, `tsc --noEmit` in rowtrack schoon, en een volledige Metro-bundle voor iOS én Android (`expo export`). Nog niet bevestigd: een runtime-start op toestel — de resolutie is bewezen, het draaien van de app niet.
- **Let op bij de eerste native build hierna:** `ios/Podfile.lock` wijst nog naar de oude platte paden (`../../../node_modules/expo-constants/ios` e.d.), die onder de geïsoleerde layout niet meer bestaan. `pod install` regenereert ze — `expo run:ios` doet dat zelf — maar reken op een grote Podfile.lock-diff bij die eerste build. Autolinking zelf is wel geverifieerd: `expo-modules-autolinking` vindt 23 Expo-modules en de RN-kant vindt alle zeven native packages (waaronder `react-native-ble-plx`) via hun `.pnpm`-paden.
- **Status:** resolved (2026-08-05) — behalve de toestel-bevestiging hierboven.

## 2026-08-06 — Account verwijderen is gebouwd maar de Edge Function is niet uitgerold · [next-step]
- **Bevinding:** PR #209 zet de volledige keten neer (rij + sheet in Profiel, re-auth met wachtwoord,
  `supabase/functions/delete-account`). Tot die functie uitgerold is, staat er wél een zichtbare
  "Account verwijderen"-actie in de app die op een 404 valt — de UI meldt dan netjes "verwijderen
  lukt nu niet", maar de knop doet niets. Daarom is de PR bewust níet gemerged.
- **Volgende zet:** `supabase functions deploy delete-account --project-ref vvncomyfmvuzyicqhnzj`
  (de drie env-vars injecteert Supabase zelf, geen secrets in te stellen), dan #209 mergen, dan één
  echte verwijdering op een testaccount. Die run sluit de twee laatste acceptatie-items in
  `briefings/2026-08-06-feature-account-verwijderen.tcebc.md`; de briefing staat nu op `gebouwd`.
- **Status:** resolved — 2026-08-07: Jeroen rolde de functie uit via de dashboard-editor (geen CLI
  en geen Docker op de machine; voor één functie is dat de kortste weg, de bron blijft in git).
  Buitenkant getoetst: `POST` zonder token → 401 `UNAUTHORIZED_NO_AUTH_HEADER`, `OPTIONS` → 204 met
  de volledige CORS-headers incl. `apikey`/`x-client-info` — dat laatste bewijst meteen dat de
  uitgerolde code de actuele versie is. Daarna een echte verwijdering met een wegwerp-account:
  `auth.users` en `profiles` van 2 terug naar 1, `workouts` onaangeroerd op 11, nul wees-rijen aan
  beide kanten. De briefing staat op `gevalideerd`.
- **Wat níet gereden is:** de faalpaden van het verwijderen — verkeerd wachtwoord, offline, en een
  verlopen sessie. Die zijn statisch geredeneerd en door twee reviewrondes bevestigd, maar nooit op
  het toestel uitgelokt. Mee te nemen bij een volgende gelegenheid, geen blocker.

## 2026-08-06 — De Edge Function wordt door niets getypecheckt · [risico]
- **Bevinding:** `apps/rowtrack/tsconfig.json` sluit `supabase/functions` uit — noodzakelijk, want
  Deno-code (`Deno.serve`, een `jsr:`-import) haalt de React-Native-config niet. Gevolg: die functie
  valt buiten `tsc`, buiten CI en buiten elke lint. Een tikfout erin komt pas boven bij `supabase
  functions deploy` of, erger, pas bij de eerste echte aanroep — op een pad dat data onherroepelijk
  verwijdert.
- **Volgende zet:** Bij een tweede Edge Function een aparte `deno check` in CI zetten (of
  `supabase functions deploy --dry-run` als rooktest). Voor deze ene functie is de deploy zelf de
  gate; het punt is dat dat niet schaalt.
- **Check:** `grep -rq 'deno' .github/workflows/` → geen hit = `supabase/functions` wordt door niets getoetst.
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — De Edge Function wordt door niets getypecheckt · [infra]*; het is werk dat blijft liggen, geen handoff. Het risico leeft ongewijzigd: geen deno-stap in CI, de functie valt buiten tsc. De entry stelt de fix uit tot een tweede Edge Function, maar de CI-stap is klein en verandert niet met het aantal…

## 2026-08-06 — Verloren antwoord bij verwijderen is principieel dubbelzinnig · [aanname]
- **Bevinding:** Slaagt de verwijdering server-side maar gaat het antwoord verloren (verbinding valt
  weg), dan kan de client niet weten of het gelukt is — een delete is niet idempotent en er is geen
  statuscode om op te lezen. Een tweede poging meldt dan "wachtwoord klopt niet", want GoTrue kent
  de gebruiker niet meer. Bewust niet weggeprogrammeerd: de eindtoestand klopt (account weg, sessie
  dood), alleen de melding kan verwarren. De copy is daarop eerlijk gemaakt: "de verbinding viel weg
  tijdens het verwijderen — kun je straks niet meer inloggen, dan is je account wél verwijderd."
- **Volgende zet:** Alleen heropenen als dit in de praktijk opduikt. Een echte oplossing vraagt een
  idempotency-key of een status-endpoint, en dat is voor deze app overkill.
- **Check:** `grep -c 'verbinding viel weg' apps/rowtrack/i18n/translations/nl.ts` — 1 = de eerlijke copy staat er nog en er is nog steeds geen idempotency-key; dit item slaapt tot iemand de melding in het echt ziet.
- **Status:** resolved — 2026-09-07 (triage sessie-reflectie stap 1, 32 d open): Dit is een genomen en in de code gedocumenteerde ontwerpbeslissing, geen levende onzekerheid: de `uncertain`-uitkomst bestaat expliciet als type met rationale in lib/auth.ts, en de copy in nl.ts draagt een comment die uitlegt… Bewijs: `grep -c 'verbinding viel weg' apps/rowtrack/i18n/translations/nl.ts` → 1 (nl.ts:333, met comment regels 331-332: 'Verzoek vertrok, antwoord kwam niet aan… Doen alsof er niets gebeurd is zou…

## 2026-08-10 — Watt-tegel dooft nog uit; de meting die dat beslist staat klaar · [next-step]
- **Bevinding:** De derde laag van de rust-traagheid: tussen "je stopt met halen" en "de erg meldt
  0 spm" zakt de watt-tegel via de EMA naar 0 (α 0.4 → 90% na ~4,5 s bij 1 Hz), terwijl spm en split
  in datzelfde venster bevriezen. Weg te halen door de tegel meteen op 0 te zetten zodra de erg 0 W
  meldt — maar dát mag alleen als deze erg tijdens het roeien nooit 0 W rapporteert. FTMS laat beide
  interpretaties toe (slaggemiddeld vs momentaan); bij de tweede zou de tegel bij elke haal
  knipperen. Uit code niet af te leiden.
- **Volgende zet:** Een paar minuten roeien met `rowtrack://dev-ble` open en "0 W bij slagen"
  aflezen (`lib/ble/ergProbe.ts` telt het mee tijdens elke rit). Staat er 0 → de EMA-staart mag weg
  in `useWorkoutMetrics` (watts-tak, snap bij `instantaneousPower === 0`). Staat er een getal → laten
  staan en dit item sluiten.
- **Status:** resolved — 2026-08-10, maar met een ander antwoord dan de vraag veronderstelde. Die
  meting beslist niets: 0 W ná je laatste haal en 0 W in een recovery zijn dezelfde gebeurtenis, bij
  1 Hz allebei twee à drie packets, dus er ligt geen drempel tussen. De apparaat-afhankelijke
  variant die het recovery-gat per erg leert is gebouwd én weggegooid — een pauze die eindigt door
  te hervatten vóór de spm nul haalt, leert een gat dat de drempel permanent boven het bruikbare
  venster tilt, gepersisteerd, met de dev-route als enige herstel. **Probeer dat niet opnieuw.**
  Opgelost via `lib/ble/strokeIdle.ts` (PR #249): de slagenteller staat stil zodra jij stilstaat,
  dus "te lang geen slag voor je eigen cadans" meet het rechtstreeks, zonder te leren of te
  onthouden. De teller op het dev-scherm blijft staan, maar is nu puur informatief over hoe deze
  erg vermogen rapporteert.
- **Op de erg gereden en teruggedraaid — 2026-08-10.** De slagenteller-variant deed technisch wat
  hij moest (geen enkele valse nul tijdens het roeien, ook niet bij laag tempo), maar Jeroen vond
  het resultaat slechter. Wat je bij een stop ziet is: de waarde blijft even op de laatste échte
  meting staan — de erg stuurt dan geen vermogen meer mee, en `mergeMetrics` houdt daardoor de
  vorige waarde vast — en klapt daarna naar 0. Die laatste échte waarde vasthouden is bruikbaarder
  dan een vroege nul: tijdens een adempauze wil je zien wat je net trok, niet dat je stilstaat.
  Teruggedraaid in PR #251; `strokeIdle.ts` bestaat niet meer.
- **De grens die hieruit volgt** — en die het overwegen waard is vóór iemand hier weer aan begint:
  naar 0 gaan is goed wanneer de **erg zelf** zegt dat je stilstaat (dat blijft, keuze van
  2026-08-07), maar niet wanneer de app dat zelf afleidt en de erg nog niets gezegd heeft. Beide
  eerdere pogingen struikelden over die grens, langs verschillende wegen.
- **Nabeschouwing:** bewust geen verdere actie (tweede statusregel omgezet op 2026-09-07 — één Status per entry).

## 2026-08-10 — De roeier meldt 'verbonden' op dezelfde onbewezen grond als de band deed · [risico]
- **Bevinding:** Bovengekomen bij de HR-fix. `ble-service` stuurt 'connected' vlak na een
  fire-and-forget `startMonitoring()`; de enige data-gerelateerde uitweg is de 403-afhandeling
  (terugvallen op 2ACC, dan `no_data`), en die vuurt wanneer de erg het abonnement **weigert** —
  nooit wanneer hij het accepteert en vervolgens zwijgt. `app/(tabs)/workout.tsx` hangt de hele
  rit aan diezelfde status, dus een stille erg laat je een training starten die nullen opneemt.
  Precies dezelfde klasse als de hartslagmeter, alleen minder zichtbaar omdat een erg via de
  gefilterde scan verbonden wordt en dus meestal echt praat.
- **Volgende zet:** Nog niet bouwen. De voor de hand liggende vorm — dezelfde deadline als
  `HR_DATA_TIMEOUT_MS` — heeft hier een faalmodus die de HR-kant niet heeft, en die is erger dan
  het probleem. `status === 'connected'` is de poort waarachter `handleStart` zit, dus een
  detector die te vroeg afgaat blokkeert het starten van een training. En of een verbonden erg in
  rust blíjft notificeren weet niemand: de 1 Hz die in de opgeslagen `samples` zichtbaar is, is
  gemeten tijdens het roeien. Stuurt jouw erg niets terwijl je stilstaat, dan valt de rij na de
  deadline om precies wanneer je op Start wil drukken. Dat is niet uit de bron af te leiden — de
  dedupe in `ble-service` verbergt juist of er packets binnenkomen.
- **Wat het wél zou ontgrendelen:** één meting. Tel in de notificatie-callback (vóór de dedupe)
  hoeveel packets er binnenkomen terwijl de erg stilstaat, en lees dat af op `rowtrack://dev-ble`.
  Blijft die teller lopen bij stilstand, dan is een deadline veilig en is ~15 s ruim. Staat hij
  stil, dan moet de detector aan de actieve fase hangen in plaats van aan de verbinding, en is het
  een grotere ingreep dan hij lijkt.
- **Waarom dit hier stopt:** vandaag zijn twee wijzigingen op deze as teruggedraaid — een
  leerregel die niet kon werken en een detector die correct werkte maar ongewenst gedrag gaf.
  Allebei gingen ze over de app die iets afleidt wat het apparaat niet gezegd heeft. Een derde
  gok, op het pad dat het starten van een rit bewaakt, zonder de meting die hem zou dragen:
  dezelfde fout, groter oppervlak.
- **Check:** `grep -rn DATA_TIMEOUT apps/rowtrack/lib/ble/` — alleen treffers in `hr-service.ts` = de roeierkant heeft nog geen datadeadline.
- **Status:** resolved (2026-09-09) — check gedraaid: `DATA_TIMEOUT` staat nog alleen in `hr-service.ts`, dus het gat leeft — maar het is werk dat blijft liggen tot er een toestel is, geen sessie-context. Verplaatst naar `apps/rowtrack/BACKLOG.md` (2026-09-09, toestel-ronde), triage volgens `sessie-reflectie` stap 1: ouder dan 30 dagen. — bewust, met een meetbare volgende stap in plaats van een ontwerp.

## 2026-08-10 — Vier gemergede PR's zijn nog nooit gerenderd · [next-step]
- **Bevinding:** #257 (HR-bedrading), #259 (a11y/F4), #260 (formattering/F10 + dood pad/F12) en
  #261 (doel-states/F5+F6+F9) staan alle vier op main met `tsc` groen, 18/18 node:test en een
  volledige iOS-bundle — maar geen enkel scherm is bekeken. Bij #259 en #261 is dat het meest
  wringend: die veranderen wat je zíet, en juist dat is niet getoetst.
- **Volgende zet — op de simulator, geen hardware nodig:**
  1. **Getalweergave (#260):** `rowtrack://dev-active?goal=distance` en `…?goal=split`, plus
     `?summary=1`. Let op duizendtal-punt (`7.515 m`), komma-decimaal (`22,3 km`) en één spatie
     vóór de eenheid. De historiekschermen vragen echte data — daar de KPI's, de GEM/PIEK-tabel en
     de splits-tabel naast elkaar leggen.
  2. **Coaching-zin (#261/F5):** `rowtrack://dev-active?goal=watts` — de zin mag de schermrand niet
     meer raken. Forceer verschil 0 om de nieuwe "op doel"-copy te zien.
  3. **Home-states (#261/F6+F9):** testaccount `rowtrack-test@umanex.be` resetten met
     `supabase/seed/test-account.sql` → geen doel → de nieuwe CTA. Vliegtuigmodus → de foutstaat
     in plaats van een stil verdwenen sectie. Cold start → skeletten, en let op de verticale
     positie van "Recente trainingen" op t=0 en t=1s (dat is de layout-shift die weg moest).
  4. **GoalSheet-guard (#261):** sheet openen zonder doel → Opslaan grijs; één segment → nog grijs;
     beide → actief. Tegenproef in beide richtingen, met de hand te doen.
- **Volgende zet — vraagt jouw oog of je toestel:**
  5. **Inactieve tabs (#259):** die zijn nu lichter (`fg.tertiary`). Rekenkundig correct, maar of
     het contrast actief-vs-inactief nog leest is een designoordeel dat alleen jij kunt vellen.
  6. **Dynamic type (#259):** grootste iOS-tekstinstelling, dan tabbar, segmentlabels en DeviceRow
     nakijken. De caps moeten clippen wegnemen; dat is niet uit code te bewijzen.
  7. **VoiceOver-pass:** de nieuwe `accessibilityRole`s doorlopen. Let vooral op de profielrijen:
     die horen "Voornaam, Jeroen, knop" te zeggen — hoor je alleen "Voornaam", dan schrijft ergens
     een expliciet label de waarde weg.
- **Check:** Alleen jij (of een sessie met de sim) kunt dit beantwoorden: heb je dev-active, de Home-states en de GoalSheet-guard bekeken? Nee = open — niets in git legt een render vast.
- **Sim-run 2026-08-11 (verify, dev-client + verse Metro-bundle):** punten 1 t/m 3 grotendeels
  gehaald, punt 4 geblokkeerd. **(1) Getalweergave ✓** — dev-active distance toont `7.500` /
  `2.500 m | 25%` (punt-duizendtal + spatie), summary toont `2,50 km` (komma-decimaal) naast
  `48 kcal`/`95 SLAGEN`; historiek-detail (rit 9 aug) toont `12,00 km` naast `1.137` slagen op één
  scherm, en de Splits-tab `2:16,1 /500m` met komma-decimalen in de hele tabel. GEM/PIEK-tabellen
  renderen, `—` voor lege waarden, geen crash. **(2) Coaching-zin ✓** — watts-variant: "Je levert
  10 W minder dan je doel" netjes binnen de marges; split-variant (verschil 0): "Je zit op
  doeltempo". **(3) Home-states deels** — in 12 frames over 3 cold starts géén "roeier"-flits en
  géén sectie-pop-in; het skelet zelf was niet te vangen (datavenster < 150 ms op de sim) en de
  foutstaat vergt netwerk-knippen (niet gedaan). Geen-doel-CTA en GoalSheet-guard niet toetsbaar:
  de sim is ingelogd op het échte account (jeroen@ikbenjeroen.be, doel aanwezig) — geen writes.
  **(4) GoalSheet-guard geblokkeerd** — zie de Subtitle-entry van 2026-08-11 hieronder: de
  WIJZIG-actie vuurt niet op synthetische taps, dus de sheet is met Maestro niet te openen.
  Punten 5 t/m 7 (tabs-oordeel, dynamic type, VoiceOver) blijven bij jou.
- **Status:** resolved (2026-09-09) — de vier-PR-formulering is achterhaald — de componenten die #259 en #261 raakten zijn in ingreep 2 in veertien nieuwe componenten gesneden, elk met story, en alle 257 stories renderen en worden tegen Figma gemeten. Wat overblijft is het simulator-deel (dev-active deep links, getalweergave op echte data), en dat staat nu in `apps/rowtrack/BACKLOG.md` (2026-09-09, toestel-ronde). — rest: skelet/foutstaat, geen-doel-CTA + guard (vergt testaccount op de sim), en jouw punten 5-7

## 2026-08-10 — HR-verbinding: de regel is bewezen, de bedrading gelezen · [risico]
- **Bevinding:** `hrLink.ts` heeft elf scenario's en een tegenproef (de bug terugzetten laat er 9
  vallen). Dát een aanroeper die regel correct bereikt is nagelopen in #257, niet bewezen — het is
  bedrading rond een `BleManager` en een timer, en die zijn buiten een toestel niet te draaien.
- **Volgende zet:** vier gevallen op het toestel, met je horloge:
  (1) horloge niet aan het casten → rij kort oranje met spinner, daarna terug op "Verbinden",
  nooit groen; (2) wél casten → groen zodra de eerste hartslag binnenkomt, BPM toont een getal;
  (3) casten midden in een rit uitzetten → binnen ~12 s valt BPM terug op "—" in plaats van te
  bevriezen (dít is het geval dat verzonnen hartslag in de opgeslagen rit voorkwam);
  (4) toestemming op "Weigeren" → autoconnect raakt de band niet aan.
- **Check (herbasislijnd 2026-09-08):** Vraag, geen commando: zijn de vier gevallen met het horloge op het toestel gereden? Nee zolang dit item geen toestel-blok met datum heeft. De tweede helft van de check is op 2026-09-08 gedraaid en gaf **niet leeg**: sinds `f8f9bc5` zijn er vier commits op deze twee bestanden (`43714ad`, `23432f0`, `0b21d93`, `928f7e7`), samen +408/-59 regels, waarvan het leeuwendeel in `hr-service.ts`. De vier scenario's hierboven beschrijven dus bedrading die intussen herschreven is — lees ze opnieuw vóór je ze rijdt, met name geval (3), want `928f7e7` raakt precies het meetbaar maken van het HR-pad en de disconnect-listener. Nieuwe basislijn: `git log --oneline 928f7e7.. -- apps/rowtrack/lib/ble/hrLink.ts apps/rowtrack/lib/ble/hr-service.ts` moet leeg zijn.
- **Status:** resolved (2026-09-09) — de vier gevallen met het horloge zijn nog niet gereden en dat kan alleen op een toestel. Verplaatst naar `apps/rowtrack/BACKLOG.md` (2026-09-09, toestel-ronde); ouder dan 30 dagen.

## 2026-08-10 — Twee tokenkeuzes die code niet kan maken · [next-step]
- **Bevinding:** Uit de a11y- en skeleton-passes rolden twee waarden die geen bestaande rol hebben.
  (1) Witte 18px-knoptekst op `accent.default` = **3,44:1** — faalt AA voor kleine tekst. Geen
  bestaande rol lost dit op: het is knoptekst zwaarder/donkerder óf het accent verdiepen.
  (2) Er is geen skeleton-/placeholder-rol. `components/Skeleton.tsx` leent `bg.raised` als vulling
  en `radii.xs` — allebei bestaand, dus geen verzonnen hex, maar wel een rol die iets anders
  betekent dan waarvoor hij hier gebruikt wordt.
- **Volgende zet:** Beide via Tokens Studio, in **beide** mode-sets (de build faalt op asymmetrie).
  Daarna `Skeleton.tsx` op de nieuwe rol zetten — één plek. Let op: er staan al twee andere
  token-items open (`accent.selected` 0.20 en een `bg.raised`-alpha), dus dit kan in één push mee.
- **Check:** `grep -ic skeleton apps/rowtrack/tokens/tokens.json` — 0 = de skeleton-rol ontbreekt en `Skeleton.tsx` leent nog `bg.raised`; staat `buttonTokens.primary` daarnaast nog op wit op `#F05454` (3,44:1), dan is ook de knoptekst-keuze niet gemaakt.
- **Status:** resolved (2026-09-09) — check gedraaid: `grep -ic skeleton tokens/tokens.json` → 0, dus beide keuzes staan nog open. Het is een Tokens Studio-beslissing van Jeroen, dus werk dat blijft liggen: verplaatst naar `apps/rowtrack/BACKLOG.md` (2026-09-09, tokenkeuzes); ouder dan 30 dagen.

## 2026-08-10 — Eerste committed node:test in de repo · [next-step]
- **Bevinding:** `lib/ble/adapterReady.test.ts` is het eerste testbestand dat blijft staan in plaats
  van in de scratchpad te verdwijnen (`node --test`, geen dependency; `tsconfig.json` excludeert
  `**/*.test.ts`). Daarmee heeft de invariant-as uit het Verify-pad voor het eerst een echt bestand,
  maar niets roept hem aan: hij staat niet in CI, dus hij meet alleen wanneer iemand eraan denkt.
- **Volgende zet:** Een `test`-stap in `ci.yml` die `node --test` over `apps/rowtrack/**/*.test.ts`
  draait. Dan kunnen `bestDistanceTime`, `secureStorage` en `formatters` er meteen bij — die hebben
  alledrie al een wegwerp-harness gehad. Raakt het bredere testrunner-item hieronder, maar vraagt
  geen dependency-keuze.
- **Status:** resolved — 2026-08-10, PR #256. De stap heet "Guard — invarianten (node:test)" en
  draait `node --experimental-strip-types --test $(git ls-files '*.test.ts')`, dus elk nieuw
  testbestand rijdt vanzelf mee en een lege lijst is een fout in plaats van een stille pass.
  Tegenproef gedraaid: één omgedraaide assert geeft exit 1, herstellen geeft exit 0.
  `bestDistanceTime`, `secureStorage` en `formatters` hebben nu een plek om naartoe te groeien —
  dat blijft het open item hieronder.

## 2026-08-06 — Geen testrunner in de repo · [debt]
- **Bevinding:** De chunk-fix in `secureStorage.ts` is geverifieerd met een wegwerp-harness in de
  scratchpad die de functies letterlijk uit de bron knipt en met Node's type-stripping draait — dat
  werkte (10 gerichte cases + 300 fuzz-cases), maar het is niet herhaalbaar en staat niet in CI.
  Hetzelfde gold eerder voor `bestDistanceTime` (19 tests + 800k fuzz, ook ad hoc). Er zijn nu
  minstens drie modules met pure, goed toetsbare logica: `bestDistanceTime`, `secureStorage` en
  `formatters`.
- **Volgende zet:** Beslissing bij Jeroen — een testrunner is een dependency (`vitest` ligt het meest
  voor de hand, `test`-task in `turbo.json`, stap in `ci.yml`). Zonder die keuze blijft elke
  verificatie eenmalig.
- **Check:** `git ls-files 'apps/rowtrack/lib/bestDistanceTime.test.ts' 'apps/rowtrack/lib/secureStorage.test.ts' 'apps/rowtrack/lib/formatters.test.ts'` → leeg = geen van de drie modules heeft een committed test.
- **Status:** resolved — 2026-09-07: verplaatst naar `apps/rowtrack/BACKLOG.md` als *2026-09-07 — Geen testrunner in de repo · [test]*; het is werk dat blijft liggen, geen handoff. De beslissing waar de entry op wachtte is genomen: er is een testrunner zonder dependency (node:test met type-stripping, `npm run test` in package.json, en een CI-stap die faalt als er géén *.test.ts…

## 2026-09-08 — Het bestand is een machinetranscriptie, geen library om uit te componeren · [aanname]
- **Bevinding:** Ik heb het design-system-bestand geoptimaliseerd voor *bewijsbaarheid* — elke node herleidbaar tot de browser-render — en nooit uitgesproken dat dat een andere eis is dan *bruikbaarheid*. Gemeten: 82% van de 1288 frames draagt een machinenaam ("0" 608×, "1" 278×, "2" 78×), en geen enkele van de 15 component sets heeft slot-properties (boolean, instance-swap, text) — alleen varianten. Nu het bestand als library gepubliceerd is en er schermen uit samengesteld worden, telt die tweede eis pas echt: niemand componeert een scherm uit lagen die "0" heten.
- **Check:** `figma_execute` op `QkRgMc7Quqtbow71DiYa1n`: tel de FRAME/GROUP-nodes waarvan de naam matcht op `/^(\d+|Frame|Group)$/` tegen het totaal. Boven ~20% is het bestand nog machinaal benoemd.
- **Volgende zet:** Vóór er iets aan toegevoegd wordt: het bestand openen als designer en per component beoordelen of hij composeerbaar is. Kandidaten voor herstel: laagnamen uit de component-structuur afleiden in plaats van uit de index, en slots (icoon aan/uit, labeltekst) als component-property in plaats van als variant.
- **Status:** resolved (2026-09-09) — eigen check gedraaid via `figma_execute`: **0 van 1 875** FRAME/GROUP-nodes draagt een machinale naam (`/^(\d+|Frame|Group)$/`), tegen een drempel van ~20%. En de premisse is weerlegd: op 2026-09-09 zijn 24 schermframes uit **100 instances** van dit bestand samengesteld — er is dus wél uit te componeren.

## 2026-09-08 — Vijf van de 33 componenten zijn met het oog bekeken · [onzekerheid]
- **Bevinding:** De tellingen zijn volledig — 613/613 tekstnodes, 1066 geometrie-velden gelijk, tien guard-assen groen. Maar ik heb Button, Chip, SplitsList, HealthConsentScreen en WheelPicker daadwerkelijk bekéken; de andere 28 niet. Twee keer vandaag was iets zichtbaar fout terwijl elke telling klopte: tekst die buiten het frame liep, en knoplabels die over twee regels braken. Beide gevonden door te kijken, geen van beide door te meten.
- **Check:** `ls apps/rowtrack/figma/parity-beelden/ 2>/dev/null | wc -l` — het aantal componenten waarvan een browser-screenshot bestaat; ver onder 33 betekent dat de beeldronde niet af is.
- **Volgende zet:** De resterende 28 in één ronde langslopen met `figma_capture_screenshot` naast `scripts/render-shot.mjs`. Begin bij de componenten met de meeste meldingen uit de builder (ActivePhase 90, IdlePhase 154, WheelPicker 104) — daar is de kans op een zichtbaar verschil het grootst.
- **Status:** open

## 2026-09-08 — De twee schermpagina's worden overbodig zodra Screens v2 uit instances wordt opgebouwd · [next-step]
- **Bevinding:** `ActivePhase` (5 frames, 105 teksten) en `IdlePhase` (4 frames, 188 teksten) staan als afgeplatte bomen in het design-system-bestand. Jeroen bouwt de schermen op de pagina *Screens v2* in `T1bGrvIzSNeLyh5CbarATZ`, uit de gepubliceerde library. Twee schermrepresentaties naast elkaar die niet aan elkaar gekoppeld zijn, is een tweede bron van waarheid — en de afgeplatte versie is de zwakste van de twee.
- **Check:** `figma_execute` op `T1bGrvIzSNeLyh5CbarATZ`: staat er inhoud op de pagina *Screens v2*? Zo ja, dan hebben de twee schermpagina's in het design-system-bestand geen functie meer.
- **Volgende zet:** De eerste helft is gebeurd: de twee pagina's zijn op 2026-09-08 uit het design-system-bestand gehaald (33 → 31 pagina's, 786 nodes weg), en `Screens v2` draagt sinds 2026-09-09 **24 frames over 9 schermen** uit gepubliceerde instances — de Check is dus gevuurd en de premisse *"nu weghalen is te vroeg"* geldt niet meer. Wat overblijft is de tweede helft, en die is bewust blijven staan: de `SCHERMEN`-uitsluiting leeft nog in `scripts/schermen.mjs` en wordt op negen plekken in `figma-sync-check.mjs` gebruikt. Die is géén rest maar de bron die de schermen uit de library-assen houdt — hij hoort te blijven zolang schermen en componenten twee bestanden zijn.
- **Status:** resolved (2026-09-09) — beide helften beantwoord: pagina's weg, uitsluiting bewust behouden.

## 2026-09-08 — Drie van de vier Storybook-rails zijn met het zwakke instrument getoetst · [onzekerheid]
- **Bevinding:** De tegenproef van `e854daa` draaide per rail een probe van zes stories. Diezelfde
  sessie bewees dat een klein probe-stel liegt: de rail voor de reanimated-versiestub gaf 4/4 groen
  waar `dev-sweep` 55 van 197 rood gaf. Die ene rail is daarna met de volle sweep overgedaan; de
  rails voor de optimizer-exclude, de pnpm-bewuste babel-`exclude` en `disableSourceMaps` niet. Hun
  rode uitkomst was ondubbelzinnig (server dood, 404, `WorkletsError`), dus een omkering is
  onwaarschijnlijk — maar het is dezelfde soort verwachting die deze sessie twee keer fout bleek.
- **Check:** `git log --oneline e854daa.. -- apps/rowtrack/.storybook/main.ts` — leeg = de vier
  ingrepen staan nog exact zoals ze gemeten zijn, dus de vraag hoe ze gemeten zijn leeft nog.
- **Volgende zet:** Bij de eerstvolgende aanraking van `.storybook/main.ts`: per ingreep één regel
  weghalen en `node scripts/dev-sweep.mjs` draaien in plaats van een probe. Koude cache
  (`rm -rf apps/rowtrack/node_modules/.cache/storybook` — let op de map, niet de repo-root) en
  controleer dat de patch écht toepaste (`git diff --quiet` moet fálen), anders meet je de
  ongewijzigde config; dat is precies wat er die dag misging.
- **Status:** open

## 2026-09-08 — parity en figma:spec zijn niet hermeten na de Storybook-configwijziging · [next-step]
- **Bevinding:** `e854daa` laat babel nu wél over `react-native-reanimated` en
  `react-native-worklets` lopen, en verandert wat de dependency-optimizer bundelt. Beide sweeps
  (dev en build) staan op 197/197, dus álles rendert — maar dat is geen uitspraak over de
  gemeten getallen. `figma:spec` en `parity` lezen dezelfde gebouwde Storybook en vergelijken
  hoogtes, padding, gaps en radii; die zijn na de wijziging niet opnieuw gedraaid.
- **Check:** `pnpm --filter rowtrack parity` — exit 0 = de geometrie is ongewijzigd en dit item is
  resolved. Vereist `figma/geometry.figma.json`; ontbreekt die, dan is het item nog open en is het
  verversen van de bouwspec de eerste stap.
- **Volgende zet:** `pnpm --filter rowtrack build-storybook` (staat al), dan `parity`. Wijkt er
  iets af: eerst nagaan of het verschil uit de babel-wijziging komt (vergelijk tegen `4bb9484`,
  de commit vóór de fix) vóór je de Figma-kant aanpast.
- **Status:** resolved (2026-09-09) — de eigen Check gedraaid: `parity` exit 0, *Geen verschil over 3 516 nodes* over 220 varianten en 27 480 velden. De geometrie is sindsdien meermaals hermeten, o.a. na de dieptekap-fix.
  **Aanvulling 2026-09-09, ándere sessie — de conclusie klopt, de Check droeg hem niet.** `parity`
  exit 0 kán deze wijziging per constructie niet vinden: de refactor merged om 14:06 (`63b425e`) en
  `figma/geometry.figma.json` is om 14:23 opnieuw gecommit (`df1e0fe`), dus de Figma-kant is
  herbouwd vanaf een build mét de nieuwe config. Was er geometrie verschoven, dan zat die
  verschuiving in béide kanten en bleef parity groen. Een parity-baseline die ná de wijziging
  ververst is, meet de wijziging niet — dat is een eigenschap van elke guard met een meebewegende
  referentie, niet iets eenmaligs.
  De isolatie is daarom apart gemeten, zonder Figma ertussen: per story de bounding boxes van alle
  DOM-nodes onder `#storybook-root`, uit twee builds die uitsluitend in `.storybook/main.ts`
  verschillen (`9e2a7b8` tegen de huidige). 13 508 nodes over 257 stories aan beide kanten, en
  **nul verschillen buiten de ruisvloer**. Die ruisvloer is zelf gemeten in plaats van aangenomen:
  dezelfde build twee keer bemonsterd geeft 18 afwijkende stories, precies de spinner-stories die
  `scripts/instabiele-nodes.mjs` al als niet-reproduceerbaar kent; de 17 afwijkingen tussen de twee
  builds vallen alle 17 binnen die 18. De conclusie *geometrie ongewijzigd* staat dus, nu op bewijs
  dat rood had kunnen worden.
  Eén valse treffer onderweg, vermeld omdat hij bijna als P0 gerapporteerd werd: de eerste meting
  gaf voor de vijf SplitsList-stories 1 node in plaats van 18/2/9/36/12 — een lege render. Een
  tweede meting op dezelfde config gaf de volle aantallen en `render:sweep` gaf 257/257. De
  momentopname wachtte te kort op een lijst die zijn layout nog moest doen.

## 2026-09-08 — Babel ín de optimizer draaien is nooit als keuze voorgelegd · [aanname]
- **Bevinding:** Drie van de vier ingrepen in `.storybook/main.ts` (optimizer-exclude,
  babel-`exclude`, `disableSourceMaps`) bestaan omdat de dependency-optimizer geen babel draait.
  Er is één mechanisme dat dat rechtstreeks oplost: een rolldown-plugin in
  `optimizeDeps.rolldownOptions.plugins` die `@babel/core` met `react-native-worklets/plugin`
  over reanimated en worklets haalt. Dat vraagt `@babel/core` als devDependency van rowtrack —
  een "eerst bevestigen"-actie — en die afweging is in de sessie zelf gemaakt en niet aan Jeroen
  voorgelegd. De gekozen route werkt en is gemeten; ze is alleen breder dan nodig.
- **Check:** `node -e "require.resolve('@babel/core',{paths:['apps/rowtrack']})"` — gooit een
  fout = de dependency ontbreekt nog en de drie-ingrepen-route staat nog overeind.
- **Volgende zet:** Alleen oppakken wanneer `.storybook/main.ts` tóch open moet (bijvoorbeeld bij
  het BACKLOG-item over `vite-plugin-rnw@0.0.12`). Leg de keuze dan expliciet voor: één
  babel-plugin in de optimizer tegenover drie losse compensaties, met de extra dependency als prijs.
- **Status:** resolved — 2026-09-09. Voorgelegd, en Jeroen koos de dependency. `@babel/core@^7.29.0`
  staat nu als devDependency van rowtrack (pinnen op `^7` was nodig: een kale `pnpm add` haalde 8.0.1
  en dupliceerde daarmee `react-native-worklets` onder een tweede peer-resolutie). De plugin
  `rowtrack-worklets-in-optimizer` draait babel over reanimated en worklets binnen de optimizer, en
  vervangt **vier** dingen in plaats van de drie die dit item noemde: de `optimizeDeps.exclude`, de
  pnpm-bewuste babel-`exclude`, `disableSourceMaps` in de app-pipeline, én de reanimated-versiestub
  met zijn Node-check — die laatste bestond alleen omdat worklets extern gemarkeerd was. `main.ts`
  ging van 306 naar 245 regels. Gemeten met de dev-sweep op koude cache: 251/257, en de basislijn
  (`origin/main`-config, wissel bevestigd vóór de meting) geeft exact dezelfde 251/257 met dezelfde
  zes uitvallers. Build-pad 257/257, `tsc` exit 0.

## 2026-09-09 — `dataSet` is alleen op web gemeten, niet op het toestel · [onzekerheid]
- **Bevinding:** Ingreep 3b zet `dataSet={{ laag: … }}` op vier Reanimated-nodes in `WheelPicker` en `GoalSegments`. Dat het aankomt is gelezen in de geïnstalleerde bron (react-native-web 0.21.2 `createDOMProps/index.js:756-766` schrijft `data-laag`; react-native-reanimated 4.1.7 `PropsFilter.js` geeft onbekende props ongewijzigd door) en gemeten op web: 4 unieke `data-laag`-waarden bereiken de DOM, 172 nodes dragen er een naam van. Op **native** reist de prop mee naar de view manager, en iOS/Android negeren een onbekende prop normaal stil — maar dat is hier niet gemeten. Er is geen dev-client-run achter deze wijziging. `types/react-native-dataset.d.ts` draagt de reden.
- **Check:** Draai de dev-client (`pnpm dev:rowtrack`, dan `expo run:ios --device`) en loop één keer door start → active workout → historiek → workout-detail → profiel. Grep de Metro-log op `dataSet`: geen regel = de prop wordt door de view manager genegeerd zoals bedoeld, een warning = hij bereikt native en dit item leeft nog.
- **Bereik bijgesteld 2026-09-09:** de entry schreef *"vier Reanimated-nodes in WheelPicker en GoalSegments"*. Sinds `7209f3d` draagt élk component met variant-assen een `dataSet`; gemeten: `grep -rn "dataSet=" --include="*.tsx" components lib app | wc -l` → **31 voorkomens over 18 bestanden**, waaronder Button, DeviceRow, FormField, PrBadge, Segmented, EmptyState, BottomSheet en de vier workout-componenten. Het ongetoetste oppervlak is dus bijna acht keer zo groot als toen de entry geschreven werd, en de oude check (alleen het startscherm) kon dat per constructie niet zien.
- **Volgende zet:** Bij de eerstvolgende toestel-run meenemen. Bijt het wél, dan is het alternatief `accessibilityLabel` of een `nativeID` — geen van beide is gratis, dus eerst meten.
- **Status:** open

## 2026-09-09 — Verse library-imports hangen in RowTrack - Design · [risico]
- **Bevinding:** De schermen-export plaatst library-instances met `figma.importComponentByKeyAsync`. Gemeten op 2026-09-09, drie toestanden en alle drie reproduceerbaar: (1) een **ongepubliceerde** key geeft meteen een duidelijke fout (*"Could not find a published component with the key"*); (2) een key die al eens in dít bestand geïmporteerd is, komt terug in **5–39 ms**; (3) een gepubliceerde key die nog **niet** in dit bestand zit, **hangt onbeperkt** — geen fout, geen console-regel, ook niet na 25 s en ook niet na een `figma_reload_plugin`. Het begon ná een afgebroken bouw die 72 imports tegelijk openzette; het vermoeden is dat de importwachtrij van de plugin daardoor wedged staat. Niet bewezen — de plugin-UI herladen laat `code.js` doorlopen, dus dat toetst het niet.
- **Check:** Sluit de Desktop Bridge-plugin in Figma volledig af en start hem opnieuw (Plugins → Development → Figma Desktop Bridge). Draai dan in `RowTrack - Design`: `figma.importComponentByKeyAsync(<key van Dot uit figma/library-component-keys.json>)`. Komt hij binnen een seconde terug met een node, dan was het de wachtrij en is dit resolved. Hangt hij nog steeds, dan is het geen wachtrij maar iets aan de library-koppeling van dat bestand — controleer dan in Figma of `RowTrack - Design System` onder Libraries van dit bestand aan staat.
- **Volgende zet:** Na een geslaagde check `node scripts/figma-serve.mjs` starten en `figma/bouw-schermen.js` per frame draaien (één frame per aanroep — een netwerk-import overleeft de 30 s wachtlimiet van `figma_execute` niet, gemeten: fire-and-forget bleef hangen, awaited duurde 39 ms).
- **Status:** resolved (2026-09-09) — opgelost door de plugin-herstart. Deze sessie zijn alle 45 componenten geïmporteerd en 100 instances geplaatst over 24 frames, met 0 meldingen over een hangende import; één awaited import duurde 39 ms. Het was de wachtrij, zoals de check vermoedde.

## 2026-09-09 — De ratels zijn eenrichtingsverkeer en niets duwt ze omlaag · [risico]
- **Bevinding:** `scripts/figma-sync-check.mjs` draagt vijf `BEKENDE_*`-constanten die een gemeten gat vastleggen. Elke keer dat een as rood wordt, is de goedkoopste uitweg de constante ophogen mét een reden — en dat is vandaag drie keer gebeurd. `BEKENDE_VOORKOMENS` ging in één dag van 2 144 naar 3 760 (+75%), `BEKENDE_GATEN` van 49 naar 52, `BEKENDE_GRENSNODES` van 243 naar 305. Elke ophoging was terecht en gemotiveerd, maar er bestaat geen mechanisme dat er ooit één omlaag duwt: een gat dat gedicht wordt laat de ratel te hoog staan, en daarna is hij blind voor precies zoveel nieuwe gaten als er gedicht zijn.
- **Check:** `node -e 'const o=require("./figma/ongebonden.json"); console.log(o.aantalUniek, o.aantalVoorkomens)'` in `apps/rowtrack`, naast `grep -n "BEKENDE_GATEN\|BEKENDE_VOORKOMENS" scripts/figma-sync-check.mjs` — staat de constante hóger dan de meting, dan is dat verschil het aantal nieuwe gaten dat ongemerkt binnen kan.
- **Volgende zet:** De as ook laten falen op een TE HOGE ratel: `if (gemeten < BEKEND) fail("winst — zet de constante op <gemeten>")`. `[laagnaam]` doet dat al (hij meldde vandaag zelf *"winst; zet BEKENDE_GRENSNODES op 305"*), `[binding]` niet. Gelijktrekken kost weinig en maakt de ratel tweezijdig.
- **Status:** open

## 2026-09-09 — De 24 schermframes zijn door niemand bekeken, en parity kan de drie dingen die ertoe doen niet zien · [onzekerheid]
- **Bevinding:** Alles wat vandaag groen werd is geometrie en structuur. `parity` vergelijkt hoogte, padding, gap, radius, randbreedte, opacity en de aanwezigheid van vulling/rand/effect — **niet** kleurwaarde, icoonvorm of `text-transform`. Dat laatste is bewezen misleidend: de browser rendert "500M" waar `textContent` "500m" is, over 42 nodes in 12 componenten (CLAUDE.md, eigenaardigheid 5). Er staan nu 24 frames uit 100 instances in `RowTrack - Design` en niemand heeft er één bekeken.
- **Check:** `ls apps/rowtrack/figma/parity-beelden/ 2>/dev/null | wc -l` — 3 op 2026-09-09, tegen 45 componenten en 24 schermframes; ver onder dat aantal betekent dat de beeldronde niet af is.
- **Volgende zet:** `pnpm --filter rowtrack render:shot <story-id>` bestaat sinds vandaag en is de helft van het instrument; de andere helft is `figma_capture_screenshot` (runtime, niet REST — een REST-render is na een verse bouw per definitie stale). Begin bij de vier schermen met de meeste tekst: HistoryScreen, WorkoutDetailScreen, ProfileScreen en ActivePhase/Samenvatting, want daar bijt `text-transform` het hardst.
- **Status:** open

## 2026-09-09 — De zebra-als-variant-as kantelt zodra er een derde data-gedreven vorm komt · [aanname]
- **Bevinding:** `WorkoutCard` kreeg vandaag een variant-as `index` met de waarden [0, 1], omdat de zebra-tegel uit `index % 2` een zichtbare vorm is die de library anders niet kan uitdrukken. Dat werkt zolang het aantal data-gedreven vormen klein blijft — en dat is de onuitgesproken aanname. Elke extra as vermenigvuldigt de variant-nodes (Button staat al op 4 assen), en op enig moment is "de builder mag de gemeten vulling als override op de instance zetten" goedkoper. Die tweede weg is vandaag bewust niet gekozen omdat een override het bewijs uitwist: parity wordt dan groen doordat de builder eroverheen schildert.
- **Check:** `node -e 'const m=require("./figma/manifest.json"); console.log(Object.values(m.pages).filter(p=>p.primary?.variantProperties).map(p=>[p.primary.name,(p.primary.varianten||[]).length]).sort((a,b)=>b[1]-a[1]).slice(0,3))'` in `apps/rowtrack` — komt een component boven ~32 varianten, of krijgt een tweede component een as die uit dáta volgt in plaats van uit een prop-union, dan is dit het moment om de afweging opnieuw te maken.
- **Volgende zet:** Niets, tot de check vuurt. Dan de twee wegen naast elkaar zetten in het BACKLOG-item over de instance-terugvallen — die twee beslissingen hangen samen.
- **Status:** open

## 2026-09-09 — Twaalf schermframes en drie text styles wachten op de library-publicatie · [next-step]
- **Bevinding:** De tekst-fix (hug/blok + uitlijning) is in de library én in de 24 schermframes gebouwd, maar een instance toont de **gepubliceerde** library-versie. De twaalf frames waarvan alle tekst in instances zit (ActivePhase ×6, IdlePhase ×4, ResetPassword ×2 — die laatste twee zaten al op de vloer) staan in de beeld-as daardoor op exact hetzelfde getal als vóór de fix. Daarbovenop stonden `type/activeProgress`, `shadow/buttonOutline` en `type/labelGoalPrefix` in de nagebouwde subbomen tijdelijk **ongebonden** omdat de import-wachtrij van de plugin vastzat (eigenaardigheid 9 in CLAUDE.md, hypothese "ongepubliceerde library" verworpen); na de herstart van de plugin importeren ze in 350 tot 410 ms en binden ze bij de eerstvolgende schermherbouw.
- **Check:** in de library: `figma:check` groen op `[publicatie]` én `[eigenschappen]` met een vers manifest = alle 45 gepubliceerd en geen wees-property; in RowTrack - Design: `(await figma.importStyleByKeyAsync('332d6d5667ebbc4ff595b66fc47aabf382b0ebea')).name` binnen 4 s, anders zit de plugin-wachtrij vast en moet hij herstart. En `node scripts/beeld-parity.mjs | grep ActivePhase__Playground` — staat er nog 3,04 %, dan zijn de schermen na de publicatie niet herbouwd.
- **Volgende zet:** Jeroen publiceert `RowTrack -  Design System` (45 componenten op `CHANGED`). Daarna in deze volgorde: de 24 frames herbouwen met `figma/bouw-schermen.js` (één scherm per aanroep past nu ruim in de wachtlimiet: 1,4 tot 5,5 s), schermgeometrie uitlezen, `parity`, `figma/exporteer-beelden.js`, `pnpm --filter rowtrack beeld --schrijf`. Verwacht: de twaalf frames dalen, en de drie styles binden weer (0 × `niet te importeren` in de meldingen).
- **Status:** resolved (2026-09-09) — gepubliceerd (eerst 23 van 45: de andere 22 droegen 73 wees-properties en werden als invalid asset geweigerd; na de property-reparatie alle 45 op `CURRENT`). Daarna voorverwarmd (315 imports in twee rondes), 24 frames herbouwd binnen budget, geometrie, `parity` 0, export, beeld: tegen de stand ná de tekst-fix dalen ActivePhase Landscape −0,40, Samenvatting −0,34, Playground en Zonder Hartslagband −0,22, Doel Afstand −0,05 en IdlePhase ×3 −0,02 tot −0,04; 0 × `niet te importeren`. Tegen het origineel van 14:40: 16 frames beter, 7 gelijk, 1 slechter (Doel Bereikt +0,12: de confetti is gerandomiseerd, `figma/niet-reproduceerbaar.json`). Som grof 77,82 → 74,10.
