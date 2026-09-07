# BACKLOG.md — gemeld, niet gebouwd

Dit bestand vangt het werk dat **buiten scope** viel: wat er benoemd is maar niet gedaan, plus de P3-bevindingen uit `ux-audit` en `security-audit`. Zonder deze lijst is "buiten scope gelaten" alleen een zin in een antwoord dat wegscrollt — de melding bestaat dan wel, het werk niet, en niemand kan er later op terugkomen.

Entries komen erbij **op het moment van de melding**, niet aan het einde van de sessie. Een sessie die zonder reflectie afloopt mag geen scope-drop verliezen; dat is precies de vorm waarin ze vandaag verdwijnen.

## Waarom dit geen HANDOFF is

Een handoff-item is **sessie-gebonden**: het zorgt dat de volgende sessie niet koud begint en verdwijnt zodra het opgepakt is. Een backlog-item is **werk** — het blijft bestaan tot het gebouwd of bewust verworpen is, ook als er tien sessies overheen gaan. Ze in één bestand gooien maakt het sessiestart-signaal onbruikbaar: de handoff-lijst hoort kort te zijn, een backlog mag lang worden.

| Soort bevinding | Huis |
|---|---|
| Werk dat benoemd is maar niet gebouwd (scope-drop) | **hier** |
| P3 / nice-to-have uit `ux-audit` of `security-audit` | **hier** |
| Waargenomen fout van een skill of werkprincipe | `LEARNINGS.md` (via `vastleggen`) |
| Onzekerheid, aanname, risico, next-step van déze sessie | `HANDOFF.md` (via `sessie-reflectie`) |
| Durend feit over Jeroen of het project | auto-memory |

## Statussen

- `open` — vastgelegd, nog geen beslissing over genomen. Telt mee bij sessiestart.
- `gepland` — dit gebeurt; het wacht op een plek in de planning.
- `gebouwd` — gedaan. Blijft staan als spoor, met commit of PR erbij.
- `verworpen` — bewust niet doen. **Reden verplicht**, anders komt hetzelfde voorstel over drie maanden terug en begint de afweging van nul.

## Types

`feature` · `refactor` · `fix` · `test` · `infra` · `ux` · `security` · `docs`

## Format

Elke entry staat onder een laag-header (`# Globaal`, `# Klant — {naam}`, `# Project — {app}`) en heeft deze vorm:

    ## YYYY-MM-DD — {korte titel} · [{type}]
    - **Wat:** {1-2 zinnen — wat er gebouwd zou worden}
    - **Waarom niet nu:** {waarom het buiten scope viel}
    - **Eerste zet:** {concreet startpunt of "-"}
    - **Status:** open

<!-- De eerste entry maakt hieronder de juiste laag-header aan. -->

# Project — rowtrack

## 2026-08-28 — Dubbele `destroy()` op één gedeelde BleManager · [fix]
- **Wat:** `lib/ble/ble-context.tsx:146-148` roept in de effect-cleanup eerst `service.destroy()` en dan `hrService.destroy()` aan. Beide diensten delen één `BleManager` — de constructor van ble-plx geeft de bestaande instance terug (`BleManager.js:78-81`, geverifieerd in de geïnstalleerde 3.5.1-bron), en `BleManager.destroy()` zet `sharedInstance` op null (`:162-164`). De tweede aanroep vernietigt dus een al vernietigde client, en de eerste sloopt de manager onder de HR-dienst vandaan terwijl die nog operaties in de lucht kan hebben.
- **Waarom niet nu:** gevonden tijdens de HR-diagnose van 2026-08-28; die opdracht was instrumentatie plus het listener-lek. Dit raakt de levenscyclus van beide diensten en verdient een eigen ronde met een toestel ernaast — de faalmodus is vandaag niet waargenomen, alleen uit de bron afgeleid.
- **Eerste zet:** één eigenaar voor de gedeelde manager aanwijzen (de context, niet de diensten), zodat `destroy()` op een dienst alleen zijn eigen abonnementen opruimt. Toets daarna dat een provider-teardown gevolgd door een remount opnieuw kan verbinden — dat is de tak die vandaag per toeval goed gaat omdat `sharedInstance` genulld wordt.
- **Status:** open

## 2026-08-28 — Mislukte hartslagpoging is tijdens een rit niet van een dode knop te onderscheiden · [ux]
- **Wat:** `app/(tabs)/workout.tsx:355-373` geeft `hrError` niet door aan `ActivePhase`. In de idle-fase toont `IdlePhase.tsx:286` de foutzin onder de rij; midden in een training ziet de roeier alleen een BPM-tegel op "—" en een spinner, ongeacht of de band niet gevonden werd, geen data stuurde, of de knop niets deed.
- **Waarom niet nu:** de opdracht van 2026-08-28 was de meetbaarheid van het HR-pad, niet de weergave. Het is bovendien een ontwerpvraag — een foutzin midden in een inspanning concurreert met de metrics, dus het is geen kwestie van de prop doorgeven en klaar.
- **Eerste zet:** beslissen wat de active-fase toont bij `hrError`: de rij rood met "Opnieuw", een korte toast, of niets tot de rit voorbij is. Pas daarna de prop doorgeven.
- **Status:** open

## 2026-08-17 — `spm_halved`-toggle heroverwegen nu de aanleiding een andere oorzaak blijkt te hebben · [fix]
- **Wat:** De per-profiel 'SPM halveren'-instelling (`profiles.spm_halved`, `correctSpm`, `useSpmHalved`, migratie, profielscherm, 5 weergavepunten) is gebouwd omdat de slagfrequentie te hoog oogde. De meting van 2026-08-16 wees uit dat de Apollo XL enkelvoudig telt; de doc-comment van `correctSpm` codificeert de aanname nog steeds als feit ("trainers die de slagfrequentie dubbel tellen"). Beslissen: verwijderen, of laten staan met een eerlijke omschrijving voor ergs die het wél doen.
- **Waarom niet nu:** Gebruikersgerichte beslissing met een datamigratie eraan vast (bestaande profielen met de toggle aan), en de vandaag gefixte noemer-bug verklaarde de lage *gemiddelden* — of de live-tegel óók afwijkt hangt af van de FTMS-parser (`/2`) en de bit 0/bit 1-substitutie, en dat vraagt een meting op het toestel.
- **Eerste zet:** Live-tegel tegen een handtelling van 30 s leggen. Wijkt die af → parser-oorzaak; klopt hij → de toggle heeft geen grond meer en kan weg.
- **Status:** open

## 2026-08-17 — Som en teller als één accumulator, zodat de verkeerde noemer niet meer kán · [refactor]
- **Wat:** `wattsSum`/`wattsCount`, `spmSum`/`spmCount`, `splitSum`/`splitTickCount`, `heartRateSum`/`heartRateCount` zijn vier losse ref-paren die per conventie bij elkaar horen. Vervang ze door één type — `{ sum, count }` met `add(acc, v)` en `mean(acc)` — zodat een gemiddelde structureel niet meer door een vreemde teller kán delen.
- **Waarom niet nu:** De fix van vandaag corrigeert alle vijf de foute call-sites en is met een enumererende sweep geverifieerd, maar houdt de conventie in stand: een nieuwe som die een teller vergeet, herhaalt de klasse. Dat is een refactor over alle accumulatoren, breder dan de gemelde bug.
- **Eerste zet:** `lib/accumulator.ts` met `type Accumulator = { sum: number; count: number }`, `add`, `mean`; eerst watts en spm omzetten, daarna split en hartslag.
- **Status:** open

## 2026-08-17 — Guard: elk gemiddelde deelt door de teller uit zijn eigen guard · [test]
- **Wat:** Een check die alle `*Sum.current /`-delingen enumereert en faalt zodra de noemer niet de bijhorende `*Count`/`*TickCount` is. Vandaag met de hand gedraaid; dat vond één call-site méér (`useGoalProgress.ts:94`) dan de analyse had gemeld.
- **Waarom niet nu:** De fix zelf was de vraag; een guard is de duurzame helft en hoort in `scripts/` + CI, wat een eigen beslissing over de rowtrack-CI vraagt (die heeft vandaag geen testrunner-stap).
- **Eerste zet:** `scripts/check-averages.sh` naar het model van `umanex-os/scripts/test-guards.sh`, met een tegenproef op béide kanten: een bewust foute noemer moet hem doen afgaan, de huidige code moet hem doen zwijgen.
- **Status:** open

## 2026-08-15 — `correctSpm` corrigeert ook een teller, geen frequentie · [refactor]
- **Wat:** `correctSpm(spm, halved)` uit `apps/rowtrack/lib/formatters.ts` wordt óók losgelaten op `total_strokes` — in `apps/rowtrack/app/(tabs)/history/[id].tsx:241` en `apps/rowtrack/components/workout/ActivePhase.tsx:621`. Dat is een correctie voor een *frequentie* toegepast op een *aantal*. Splits het in een eigen functie met eigen naam en eigen redenering, ook al is de rekensom vandaag dezelfde.
- **Waarom niet nu:** Kwam boven bij de spm-meting van 2026-08-15, waar de vraag "telt de erg dubbel?" de aandacht opeiste. De semantische fout staat daar los van: welke kant die vraag ook opvalt, een rate-correctiefunctie hoort niet op een teller. Buiten de scope van die analyse.
- **Eerste zet:** `correctStrokeCount(count, halved)` naast `correctSpm` zetten, beide call-sites omzetten, en in de doc-comment vastleggen waaróm ze toevallig hetzelfde doen.
- **Status:** open

## 2026-08-15 — Sla spm en watt op in `samples`, niet enkel `[t, d, hr]` · [feature]
- **Wat:** `samples` bevat per seconde alleen tijd, afstand en hartslag (`apps/rowtrack/lib/hooks/useWorkoutMetrics.ts:286`). Daardoor is een slagfrequentie- of vermogensverloop achteraf niet te reconstrueren uit de database — enkel de eindwaarden (`avg_spm`, `max_spm`) overleven.
- **Waarom niet nu:** Bleek pijnlijk op 2026-08-15: de vraag of de erg dubbel telt was uit de opgeslagen ritten *niet* te beantwoorden. Het antwoord moest uit een live Metro-log met rauwe FTMS-hex komen, wat een draaiende dev-client naast de training vereist. Uitbreiden van de payload raakt opslagformaat en `bestDistanceTime.ts`, dus geen bijzaak van een analyse.
- **Eerste zet:** De tuple-vorm in `apps/rowtrack/app/(tabs)/workout.tsx:126` is positioneel (`[t, d]` of `[t, d, hr]`) en dus niet uitbreidbaar zonder versieveld. Eerst beslissen: sleutel-object per sample, of een versienummer naast de array. Daarna pas velden toevoegen.
- **Status:** open

## 2026-08-11 — Scanfilter verfijnen op machine-type uit FTMS service data · [feature]
- **Wat:** De FTMS-advertentie bevat naast de service UUID een Service Data-veld (0x1826) met een Fitness Machine Type-bitfield; bit 4 = rower. Daarmee kunnen fietsen en loopbanden uit de keuzelijst geweerd worden in plaats van elk FTMS-toestel te tonen. Aanknopingspunt: `dev.serviceData` in de scan-callback, naast `isRowerCandidate` in `apps/rowtrack/lib/ble/rowerCandidate.ts`.
- **Waarom niet nu:** Een vals-positief is hier goedkoop (het toestel verschijnt hooguit in de `DeviceSelectionModal` en de connect-fase eist alsnog de Rower Data characteristic), terwijl een te streng filter een niet-conforme roeier onzichtbaar maakt. Eerst op echte toestellen zien welke advertenties binnenkomen (de nieuwe `adv:`-log), dan pas verfijnen.
- **Eerste zet:** `dev.serviceData?.[FTMS_SERVICE_UUID]` decoderen (base64 → flags-byte + 2-byte LE bitfield) in `rowerCandidate.ts`, met dezelfde vangnet-gedachte: geen service data → toestel tóch tonen.
- **Status:** open

## 2026-08-22 — PR-baseline kijkt maar naar de laatste 100 ritten · [fix]
- **Wat:** `apps/rowtrack/lib/hooks/useGoalProgress.ts:126` haalt de PR-baseline op met `.order('started_at', desc).limit(100)`. Zodra rit 101 er is, valt de oudste rit uit de vergelijking en kan een verbroken record stil terugkeren als "nieuw record". Fix: aggregeren in de query (`max(avg_watts)`, `min(avg_split_seconds)`, `max(distance_meters)`, `min(best_2k_seconds)`) of een `personal_records`-view, in plaats van 100 rijen ophalen en client-side scannen.
- **Waarom niet nu:** Buiten scope gehouden bij de PR-detail-briefing van 2026-08-22 (Jeroen koos "2K erbij" zonder de baseline-verbreding). Bij 19 ritten is het gat nog niet bereikbaar — het bijt pas rond rit 101, en dan onzichtbaar.
- **Eerste zet:** De aggregatie in `fetchPRs` vervangen door één `select` met Postgres-aggregaten; de `derivePrMetrics()` uit de PR-detail-briefing kan daar de tegenproef voor leveren (dezelfde records over de volledige historiek).
- **Status:** open

## 2026-08-22 — Ritten van 0 m / 0 s belanden in het archief · [ux]
- **Wat:** Een sessie die start en meteen gestopt wordt, wordt bewaard als volwaardige rit. In de historiek staat er zo één (2026-08-22 12:40:57: 0 m, 0 s, 1 sample, wel `avg_heart_rate` 90 uit de FTMS-fallback). Die rijen vervuilen de lijst en tellen mee in de periodetotalen. Voorstel: bij het opslaan een ondergrens (bv. `distance_meters > 0 && duration_seconds > 0`, of een minimum van ~30 s) en anders stil weggooien — of de gebruiker vragen.
- **Waarom niet nu:** Bovengekomen tijdens de HR-diagnose van 2026-08-22, niet de gevraagde taak. Raakt het opslagpad (`app/(tabs)/workout.tsx`) en vraagt een beslissing over wat er met de bestaande lege rijen gebeurt.
- **Eerste zet:** Drempel bepalen, dan de guard in `saveWorkout` vóór de insert; bestaande lege ritten apart opruimen (nooit blind — eerst tellen met een `select`).
- **Status:** open

## 2026-08-22 — PR-historiek wordt per scherm opnieuw opgehaald · [refactor]
- **Wat:** `apps/rowtrack/lib/hooks/usePrHistory.ts` haalt de volledige ritlijst van de gebruiker op en hangt op drie schermen (home, historiek, detail). Navigeren home → historiek → detail is drie keer dezelfde query; het detailscherm haalt de hele historiek op om één badge van een label te voorzien. Eén gedeelde bron (context of module-cache met invalidatie na een save) haalt dat weg.
- **Waarom niet nu:** Bij 19 ritten onmeetbaar, en een gedeelde cache is scope-uitbreiding bovenop de PR-detail-briefing. De kost groeit wél met de gebruiker, niet met het scherm.
- **Eerste zet:** De hook achter een provider in `app/(tabs)/_layout.tsx` naast `BleProvider`, of `derivePrHistory` alleen voor de ene zichtbare rit draaien op het detailscherm.
- **Status:** open

## 2026-08-22 — De PR-banner leest niet meer als viering · [ux]
- **Wat:** De banner in de samenvatting stond op een rauwe `rgba(245,158,11,0.15)`. Die is vervangen door `bg.raised` + een `achievement.muted`-rand, maar `bg.raised` is exact het vlak van de KPI-band eronder. Een eigen rol — `achievement.surface`, een lage-alpha cream in de geest van `accent.subtle` — zou het vieringsmoment terugbrengen zonder hardcoded kleur.
- **Waarom niet nu:** Tokens wijzigen is een "altijd eerst bevestigen"-actie, en de token-bron is Tokens Studio: een handmatige edit in `tokens/tokens.json` wordt bij de eerstvolgende plugin-push overschreven.
- **Eerste zet:** Rol toevoegen in Tokens Studio (beide mode-sets, de build faalt op asymmetrie), `pnpm tokens:build`, dan `summaryStyles.prBanner` en `styles.prSection` erop zetten. Zie ook de `// TODO`-comments bij `borderLeftWidth: 2` — er is ook geen borderWidth-rol.
- **Status:** open

## 2026-08-22 — Home formatteert PR-waarden anders dan de badge · [fix]
- **Wat:** `fmtPrDistance` / `fmtPr2k` (`apps/rowtrack/app/(tabs)/index.tsx`) ronden af op één decimaal; `formatPrValue` in `lib/prDisplay.ts` gebruikt `formatDistanceDynamic` (twee decimalen). Op hetzelfde scherm staan dus twee schrijfwijzen van dezelfde grootheid — de records-tegel en de badge in de lijst eronder. De briefing wilde die formattering samenvoegen in de PR-module; dat is niet gebeurd omdat het de bestaande Home-weergave zichtbaar zou wijzigen.
- **Waarom niet nu:** Het is een weergavekeuze (1 vs 2 decimalen) die buiten de PR-detail-scope viel en Jeroens beslissing verdient.
- **Eerste zet:** Kiezen welke schrijfwijze wint, dan `fmtPrDistance`/`fmtPr2k` vervangen door `formatPrValue` uit `lib/prDisplay.ts`.
- **Status:** open

## 2026-08-22 — Split-record leest als een breuk in VoiceOver · [ux]
- **Wat:** `formatPrValue('split', …)` levert '2:14 /500m', wat VoiceOver uitspreekt als "2:14 slash 500 m". Een aparte gesproken variant ("2 minuten 14 per 500 meter") laat de visuele compactheid en de uitspraak los van elkaar evolueren.
- **Waarom niet nu:** Verstaanbaar, dus geen blokkade; het vraagt een tweede formatter-as die alleen voor a11y bestaat.
- **Eerste zet:** `prValueSpoken(metric, value)` naast `formatPrValue` in `apps/rowtrack/lib/prDisplay.ts`, gebruikt door `prAccessibilityLabel` en `prEntrySpoken`.
- **Status:** open

## 2026-08-22 — Een wachtende BLE-scan overleeft wegnavigeren en achtergrond · [fix]
- **Wat:** `scan-lock.ts` zet een tweede scanaanvraag in de wachtrij. Verlaat de gebruiker het trainingsscherm of gaat de app naar de achtergrond, dan breekt niemand die aanvraag af. Er hangen sinds de AppState-fix wél twee listeners (`lib/ble/hr-service.ts` voor de stilte-deadline, `app/(tabs)/workout.tsx` voor autoconnect) en de `useFocusEffect` daar ruimt zichzelf op — maar géén van drieën raakt het scan-slot aan. Tot 25 s later start de scan alsnog, draait 15 s, en zet daarna een foutmelding klaar die de gebruiker ziet zodra hij terugkomt.
- **Waarom niet nu:** De trigger bouwen raakt de levenscyclus van beide diensten (focus-cleanup + AppState) en dat is een bredere wijziging dan de scan-serialisatie zelf. Het venster is bovendien begrensd (maxHoldMs), geen eeuwige hang.
- **Eerste zet:** Haak `stopScan()` op beide diensten aan de bestaande AppState-listener in `workout.tsx` en aan de cleanup van diezelfde `useFocusEffect` — de bedrading ligt er al, alleen het scan-slot hangt er niet aan.
- **Status:** open

## 2026-08-22 — De node:test-suites draaien niet in CI · [infra]
- **Wat:** `apps/rowtrack` heeft nu een `test`-script (`node --test "lib/**/*.test.ts"`, 47 tests), maar `.github/workflows/ci.yml` draait alleen type-check, lint en build. De enige wachters op de rekenkundige en concurrency-invarianten (`personalRecords`, `scan-lock`, `hrLink`, `bestDistanceTime`, `calories`, `period`) hangen dus aan iemand die eraan denkt ze met de hand te draaien.
- **Waarom niet nu:** `ci.yml` is gedeeld door vier apps; een stap toevoegen is een config-wijziging die Jeroens akkoord verdient, en er moet een keuze komen of andere apps hun eigen suite krijgen.
- **Eerste zet:** Eén stap `pnpm --filter rowtrack test` naast de token-guards in `ci.yml`, en beslissen of de andere apps volgen.
- **Status:** gebouwd — `ci.yml` draagt sinds dan de stap "Guard — invarianten (node:test)", waargenomen op 2026-08-25 in run 32819117593.

## 2026-08-25 — `scan-lock` faalt sporadisch in CI · [test]
- **Wat:** `apps/rowtrack/lib/ble/scan-lock.test.ts:93` ("het vangnet geeft het slot vrij als een dienst vergeet los te laten") faalde op `assert.ok(ownsScan(rower))` in run 32819117593, terwijl exact dezelfde commit in de parallelle run 32819121407 slaagde en beide runs erna opnieuw groen waren. 50 van 51 tests passeerden. De test leunt op een tijdgebonden vangnet, dus een trage runner is de waarschijnlijke oorzaak.
- **Waarom niet nu:** gevonden tijdens een portfolio-copywijziging; `fix(rowtrack):` hoort niet in een `feat(portfolio):`-PR, en de hook blokkeert dat terecht.
- **Eerste zet:** de test op een injecteerbare klok zetten in plaats van op echte tijd, zodat het vangnet deterministisch afgaat. Een wachter die één op de vier keer vals alarm slaat, leert je hem te negeren — en dat is schadelijker dan geen wachter.
- **Tweede meting (2026-08-25, 11:25):** run 32841975698 faalde op dezelfde test en dezelfde `assert.ok(ownsScan(rower))` (50/51), de parallelle run 32841979970 op dezelfde commit was groen. Tweemaal op één dag; de klok-injectie wordt dringender.
- **Oorzaak (gemeten 2026-08-25):** geen "trage runner" in het algemeen, maar ms-drift tussen twee `setTimeout`-aanroepen. De hr-guard wordt vóór de wachttimer gepland; valt er een ms-grens tussen, dan verloopt de roeier-guard (hr-start + 20 + 20) één ms vóór de wacht (start + 40) en vuurt hij eerst — lokaal 1/30 zonder geforceerde drift, 18/30 bij 1,5 ms, 29/30 bij 3 ms.
- **Status:** gebouwd — 2026-08-25, PR `fix/scan-lock-deterministic-test`: test op `t.mock.timers` (node:test), met de grens zelf getoetst (19 ms stil, 20 ms vuurt, ook voor de opvolger). Tegenproef: vangnet ×1000 → rood; `onPreempted` weg → rood; 30× groen; productiecode ongewijzigd.

## 2026-09-07 — 0.20 accent-selectie-fill zonder token · [refactor]

- **Wat:** Een `accent.selected`-alias (rgba(240,84,84,0.20)) toevoegen in Tokens Studio in beide mode-sets, tokens rebuilden en de drie hardcodes in components/Chip.tsx, components/GoalSegments.tsx en components/Segmented.tsx door het token vervangen (TODO's weg).
- **Waarom niet nu:** HANDOFF-item van 2026-07-09, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: `grep -rn "rgba(240, 84, 84, 0.20)" apps/rowtrack/components` → 3 treffers: GoalSegments.tsx:163, Chip.tsx:47, Segmented.tsx:91 (alle drie met `// TODO … accent.selected`). `grep -rn selected apps/rowtrack/tokens/tokens.json apps/rowtrack/constants/colors.ts`…
- **Eerste zet:** Tokens Studio → `accent.selected` = 0.20 op `accent.default` in beide mode-sets pushen (samen met bg.raised-alpha en de skeleton-rol uit de entry van 2026-08-10), dan `grep -rn "rgba(240, 84, 84, 0.20)" apps/rowtrack/components` moet 0 geven na de vervanging.
- **Check:** `grep -rn "rgba(240, 84, 84, 0.20)" apps/rowtrack/components` — treffers = de hardcode staat er nog en `accent.selected` is niet gepusht; leeg = token gepusht en de plekken vervangen.
- **Status:** open

## 2026-09-07 — Out-of-scope design-vragen IdlePhase · [fix]

- **Wat:** Button.sizeLg op de tokenwaarde zetten (buttonTokens.primary.height) in plaats van space['44'], of — als 44 de bedoelde hoogte is — de token in Tokens Studio op 44 zetten; daarbij de Theme-alias buttonPrimaryHeight (56) meenemen zodat er één bron overblijft. Het maxFontSizeMultiplier-commentaar in Button.tsx:107 volgt de gekozen hoogte.
- **Waarom niet nu:** HANDOFF-item van 2026-07-09, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: `grep -n "height:" apps/rowtrack/components/Button.tsx apps/rowtrack/constants/colors.ts | grep -E "space\['44'\]|height: 48"` → 2 regels (colors.ts:59 `height: 48`, Button.tsx:137 `height: space['44']`). tokens.json (python-walk op `$value`):…
- **Eerste zet:** Figma node 109-2214 (Button, file T1bGrvIzSNeLyh5CbarATZ) uitlezen op de primary-hoogte en Jeroen laten kiezen tussen 44/48/56; daarna `grep -n "height:" apps/rowtrack/components/Button.tsx apps/rowtrack/constants/colors.ts | grep -E "space\['44'\]|height: 48"` moet 1 regel geven.
- **Check:** `grep -n "height:" apps/rowtrack/components/Button.tsx apps/rowtrack/constants/colors.ts | grep -E "space\['44'\]|height: 48"` — twee regels = 44 (Button.sizeLg) en 48 (buttonTokens.primary) staan nog uiteen; één regel = de keuze is gemaakt.
- **Status:** open

## 2026-09-07 — Best-2000m: BLE-reconnect midden in workout re-baselinet niet · [fix]

- **Wat:** Bij een auto-reconnect midden in een workout de baseline (initialElapsed/initialDistance) opnieuw zetten of lastMetrics resetten, en de {t,d}-samplereeks bewust in een nieuwe run laten starten in plaats van negatieve samples stil te laten wegvallen in sanitize().
- **Waarom niet nu:** HANDOFF-item van 2026-07-10, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: `grep -rn reconnect apps/rowtrack/lib/hooks/useWorkoutMetrics.ts` → leeg (rc=1). `grep -n lastMetrics apps/rowtrack/lib/ble/ble-service.ts` → resets alleen op regel 130 (connectKnown) en 203 (startScan); attemptReconnect (626-650) roept connectToDevice aan…
- **Eerste zet:** Eerst meten of het nodig is: op de Apollo XL tijdens een rit Bluetooth uit/aan zetten om een reconnect te forceren en in de `[BLE]`-log lezen of elapsedTime/totalDistance na de reconnect op 0 herstarten. Herstarten ze niet, dan is dit item met die meting als bewijs te sluiten.
- **Check:** `grep -rn reconnect apps/rowtrack/lib/hooks/useWorkoutMetrics.ts` — geen treffer = het meetpad kent geen reconnect en zet de baseline dus niet opnieuw.
- **Status:** open

## 2026-09-07 — Segment-breedte snapt (Fabric layout-animatie taboe) · [ux]

- **Wat:** De actieve goal-segment vloeiend laten morphen in plaats van snappen: ofwel de remount-key vervangen door een Reanimated LinearTransition zodra een nieuwere Reanimated/RN-versie de Fabric stale-width clipping niet meer vertoont, ofwel de door Jeroen afgewezen variant (gelijk-brede segmenten + schuivende pill) alsnog voorleggen.
- **Waarom niet nu:** HANDOFF-item van 2026-07-10, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: `grep -nF '${selected === type}' apps/rowtrack/components/GoalSegments.tsx` → 1 treffer (regel 120, `key={\`${type}-${selected === type}\`}`). package.json: react-native-reanimated ~4.1.1, react-native 0.81.5, expo ~54.0.35; pnpm-lock:…
- **Eerste zet:** Bij de eerstvolgende bump van react-native-reanimated (major/minor boven 4.1) of react-native boven 0.81: in GoalSegments.tsx de key op regel 120 tijdelijk door `key={type}` + `layout={LinearTransition}` vervangen en op de sim toetsen of een gedeactiveerd segment zijn labelbreedte nog vasthoudt (Split/Watt actief maken en kijken of het laatste segment van het scherm loopt).
- **Check:** `grep -nF '${selected === type}' apps/rowtrack/components/GoalSegments.tsx` — een treffer = de remount-key (en dus de snap) staat er nog; leeg = vervangen door een layout-animatie of door gelijk-brede segmenten.
- **Status:** open

## 2026-09-07 — BLE-replay test-harness voor de workout-flow · [test]

- **Wat:** Een replay-harness die een opgenomen FTMS-packetreeks (fixture) deterministisch door useWorkoutMetrics + useGoalProgress + de save-flow speelt, zodat dubbel-save, empty-guard en disconnect-timing zonder fysieke erg getest worden, als node:test-suite in CI.
- **Waarom niet nu:** HANDOFF-item van 2026-07-16, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: `git ls-files apps/rowtrack | grep -Ei 'replay|fixture|\.test\.ts$'` → 6 bestanden: lib/authClockSkew.test.ts, lib/ble/adapterReady.test.ts, lib/ble/hrLink.test.ts, lib/ble/rowerCandidate.test.ts, lib/ble/scan-lock.test.ts, lib/personalRecords.test.ts — geen…
- **Eerste zet:** Eén type-B-pakketreeks opnemen via de opnameketen uit de referentiepagina (of uit de Metro-log van 2026-08-28), als `lib/ble/__fixtures__/apollo-xl-session.json` committen en een eerste `lib/hooks/useWorkoutMetrics.test.ts` schrijven die de reeks via ftms-parser voert en elapsed/distance/calories tegen de opgeslagen rit controleert; check daarna: `git ls-files apps/rowtrack | grep -Ei 'replay|fixture'` ≥1.
- **Check:** `git ls-files apps/rowtrack | grep -Ei 'replay|fixture|\.test\.ts$'` — alleen `lib/ble/adapterReady.test.ts`, `lib/ble/hrLink.test.ts` en `lib/ble/rowerCandidate.test.ts` (BLE-bedrading, geen flow) = nog geen packetreeks die door `useWorkoutMetrics` en de save-flow loopt.
- **Status:** open

## 2026-09-07 — Keychain-accessibility auth-refresh-fix nog device-verificatie nodig · [test]

- **Wat:** Toestel-verificatie van de keychain-accessibility-fix: bevestigen dat de GoTrue auto-refresh bij vergrendeld scherm geen 'User interaction is not allowed'-red-box meer geeft, en de uitkomst met datum vastleggen.
- **Waarom niet nu:** HANDOFF-item van 2026-07-16, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: `grep -n AFTER_FIRST_UNLOCK apps/rowtrack/lib/secureStorage.ts` → regel 147 (comment) en 154 (`keychainAccessible: ss!.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`). `git log --oneline --since=2026-07-16 -- apps/rowtrack/lib/secureStorage.ts` → 4f63d59 (de fix) en…
- **Eerste zet:** Op de iPhone met dev-client: inloggen → app één keer naar de voorgrond (herschrijft bestaande keychain-items met de nieuwe accessibility) → scherm vergrendelen → ≥ 1 refresh-tick afwachten (token-TTL) → Metro-log lezen op 'getValueWithKeyAsync'; geen treffer = resolved, treffer = bug-entry.
- **Check:** Alleen jij kunt dit beantwoorden: heb je op de iPhone na inloggen het scherm vergrendeld en een refresh-tick zonder red-box gezien? Nee = open.
- **Status:** open

## 2026-09-07 — Translucente celebration-card gebruikt hardcoded rgba · [refactor]

- **Wat:** Een translucente bg.raised-rol (bv. `bg.raisedTranslucent` = `{color.alpha.…}` @ 75%) toevoegen in Tokens Studio → tokens.json in beide mode-sets, rebuilden en de hardcode in MotivationalToast.tsx:196 (en de 0%-variant in WheelPicker.tsx:30) erdoor vervangen.
- **Waarom niet nu:** HANDOFF-item van 2026-07-16, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: `grep -rn 'rgba(33, 36, 44, 0.75)' apps/rowtrack/components` → 1 treffer: components/MotivationalToast.tsx:196. `grep -n -i 'overlay|alpha|0\.75|scrim' apps/rowtrack/tokens/tokens.json` → een `color.alpha`-groep (regel 116) met red-06/08/12/20, white-04/22,…
- **Eerste zet:** In tokens.json onder `color.alpha` een `raised-75`-primitive toevoegen en onder `bg` een alias ernaar, `pnpm tokens:build`, dan MotivationalToast.tsx:196 op de gebouwde constante zetten; check: `grep -rn 'rgba(33, 36, 44' apps/rowtrack/components` leeg.
- **Check:** `grep -rn "rgba(33, 36, 44, 0.75)" apps/rowtrack/components` — één treffer (`MotivationalToast.tsx:196`) = er is nog geen translucente `bg.raised`-rol; leeg = token gepusht en vervangen.
- **Status:** open

## 2026-09-07 — UX-audit P2: geen datavisualisatie (HR-verloop, split-trend) · [feature]

- **Wat:** Datavisualisatie op de ruwe `workouts.samples` (1 Hz t/d/hr): HR-over-tijd met zones op Detail-Hartslag, staafjes per 500 m op Detail-Splits, een mini-trend op Home — eerst als Figma-design, dan via figma-naar-code met react-native-svg (of Skia) als tekenlaag.
- **Waarom niet nu:** HANDOFF-item van 2026-07-16, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: `grep -c react-native-svg apps/rowtrack/package.json` → 0. `grep -rln 'victory|recharts|skia|chart' apps/rowtrack/package.json` → leeg. `git log --oneline --since=2026-08-06 -- apps/rowtrack` bevat geen commit over grafieken/visualisatie.
- **Eerste zet:** Figma: één detail-scherm ontwerpen (HR-verloop + zones) op basis van een echte rit uit het testaccount; daarna een TC-EBC schrijven en `pnpm --filter rowtrack add react-native-svg` (dependency → eerst bevestigen) plus native rebuild; check: `grep -c react-native-svg apps/rowtrack/package.json` ≥1.
- **Check:** `grep -c react-native-svg apps/rowtrack/package.json` — 0 = geen tekenlaag in de app, dus nog steeds nul grafieken.
- **Status:** open

## 2026-09-07 — UX-audit P3-verzamellijst (F13–F19) · [ux]

- **Wat:** De zeven P3-bevindingen uit audits/2026-07-16-ux-audit-rowtrack.md §5 als losse items: backlink-label vs tab-naam (F13), icon-only inactieve doelsegmenten (F14), onzichtbaar tappable BPM-rij (F15), Android-back op 3 modals (F16), dubbele afstand in geen-doel-variant (F17), dode UX-lagen opruimen — KPI.tsx, SectionHeader.tsx, paceZone/pulseAnim/prFlags-props, 3× rgba-0.20, confetti-kleuren (F18), kcal-asterisk-legende (F19).
- **Waarom niet nu:** HANDOFF-item van 2026-07-16, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: `ls apps/rowtrack/components/KPI.tsx apps/rowtrack/components/SectionHeader.tsx` → beide bestaan; `grep -rn "KPI'\|SectionHeader'" apps/rowtrack/app apps/rowtrack/components | grep import` → leeg (alleen de barrel components/index.ts exporteert ze). `grep -c…
- **Eerste zet:** F18 eerst, want puur opruimwerk zonder designoordeel: KPI.tsx en SectionHeader.tsx verwijderen (bevestigen vóór delete), de barrel bijwerken, `paceZone`/`pulseAnim`/`prFlags` uit ActivePhase-props en workout.tsx/dev-active.tsx halen, `tsc --noEmit`; check daarna: `ls apps/rowtrack/components/KPI.tsx` faalt.
- **Check:** `ls apps/rowtrack/components/KPI.tsx apps/rowtrack/components/SectionHeader.tsx && grep -c "backLink: 'OVERZICHT'" apps/rowtrack/i18n/translations/nl.ts` — beide bestanden plus 1 = er is niets van F13–F19 opgepakt; verandert er iets, hertriageer de zeven tegen `audits/2026-07-16-ux-audit-rowtrack.md`.
- **Status:** open

## 2026-09-07 — De Edge Function wordt door niets getypecheckt · [infra]

- **Wat:** Een CI-stap die `supabase/functions/**` typechecked met `deno check` (via denoland/setup-deno), zodat een tikfout in het account-verwijderpad in de PR faalt in plaats van bij deploy of bij de eerste echte aanroep.
- **Waarom niet nu:** HANDOFF-item van 2026-08-06, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: `grep -rn deno .github/workflows/` → leeg (rc=1). `ls apps/rowtrack/supabase/functions/` → alleen `delete-account` (index.ts); nog steeds één functie. `grep -rn 'deno|supabase functions' .github/workflows/*.yml apps/rowtrack/package.json turbo.json` → leeg:…
- **Eerste zet:** In .github/workflows/ci.yml een job `edge-functions` toevoegen: `denoland/setup-deno@v2` + `deno check apps/rowtrack/supabase/functions/delete-account/index.ts`; tegenproef: een opzettelijke type-fout in index.ts moet de job rood maken; check daarna: `grep -rq deno .github/workflows/`.
- **Check:** `grep -rq 'deno' .github/workflows/` → geen hit = `supabase/functions` wordt door niets getoetst.
- **Status:** open

## 2026-09-07 — Geen testrunner in de repo · [test]

- **Wat:** Committed node:test-suites voor de drie pure modules die nu alleen ad hoc geverifieerd zijn: lib/bestDistanceTime.ts (19 cases + fuzz), lib/secureStorage.ts (chunking op bytes, nooit mid-character; 10 cases + fuzz) en lib/formatters.ts (duizendtal-punt, komma-decimaal, spatie vóór eenheid).
- **Waarom niet nu:** HANDOFF-item van 2026-08-06, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: `git ls-files 'apps/rowtrack/lib/bestDistanceTime.test.ts' 'apps/rowtrack/lib/secureStorage.test.ts' 'apps/rowtrack/lib/formatters.test.ts'` → leeg (Check slaat aan). Maar: apps/rowtrack/package.json:11 `"test": "node --test \"lib/**/*.test.ts\""`;…
- **Eerste zet:** `apps/rowtrack/lib/secureStorage.test.ts` schrijven naar het patroon van lib/ble/scan-lock.test.ts (node:test + assert), met de 10 gerichte cases uit de chunk-fix (d180578) als startpunt; tegenproef: de byte-grens in de chunker één teken verschuiven en eisen dat de suite omvalt; check: `git ls-files apps/rowtrack/lib/secureStorage.test.ts` niet leeg.
- **Verwant:** `apps/rowtrack/BACKLOG.md` 2026-08-22 *De node:test-suites draaien niet in CI* (gebouwd): de runner en de CI-stap bestaan sinds 2026-08-25, dit item is de inhoud die erdoorheen moet.
- **Check:** `git ls-files 'apps/rowtrack/lib/bestDistanceTime.test.ts' 'apps/rowtrack/lib/secureStorage.test.ts' 'apps/rowtrack/lib/formatters.test.ts'` → leeg = geen van de drie modules heeft een committed test.
- **Status:** open

## 2026-09-07 — HR- en roeier-dienst delen één BleManager-singleton · [test]

- **Wat:** Toestel-verificatie van de gedeelde BLE-scan en het tweede verbindingspad: (1) twee taps binnen een seconde in beide volgordes, (2) Stop tijdens een herstelpoging → rij blijft idle, (3) Verbinden + ander toestel tijdens een lopende herstelpoging → oude lus verbindt niet meer (generatie-token), (4) Verbinden terwijl de roeier scant → geen 'geen hartslagmeter gevonden' na een geslaagde directe verbinding. Uitkomst per scenario met datum in HANDOFF.
- **Waarom niet nu:** HANDOFF-item van 2026-08-06, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: `grep -c requestScan apps/rowtrack/lib/ble/scan-lock.ts` → 2 (serialisatie staat er nog). `git log --oneline --since=2026-08-22 -- apps/rowtrack/lib/ble/` → 928f7e7 (28/08, HR-pad meetbaar + disconnect-listener-leak), a79c883 (scan-lock-test deterministisch),…
- **Eerste zet:** Dev-client op de iPhone met horloge én Apollo XL aan, `rowtrack://dev-ble` open, scenario 1 (HR-tap dan roeier-tap binnen 1 s) rijden en in de `[BLE]`-log controleren dat beide scans binnen het venster een treffer geven (vóór de fix: 25 s stilte na 12:35:57 op 22/08); daarna 2-4.
- **Verwant:** `apps/rowtrack/BACKLOG.md` 2026-08-28 *Dubbele `destroy()` op één gedeelde BleManager* (open) raakt dezelfde context.
- **Check:** `grep -c 'requestScan' apps/rowtrack/lib/ble/scan-lock.ts` — 0 = de arbiter is weg of
- **Status:** open

## 2026-09-07 — sheetFieldLabel-token niet tegen sheet-design geverifieerd · [fix]

- **Wat:** De veld-labelkleur van de profiel-sheets (PERIODE/TYPE/WACHTWOORD e.d., `sheetFieldLabel` in profile.tsx) bevestigen tegen een echt sheet-frame (E-mail 53:10039 of Geslacht 52:9155) en gelijktrekken met de tegen 388:2256 bevestigde `fg.secondary` uit GoalSheet — of documenteren waarom de twee sheet-families bewust verschillen.
- **Waarom niet nu:** HANDOFF-item van 2026-07-14, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: Check gedraaid: `grep -n -A3 'sheetFieldLabel: {' 'apps/rowtrack/app/(tabs)/profile.tsx'` → regel 993-996: `color: fg.tertiary` (5 gebruikers: emailSheet currentEmail/newEmail/repeatEmail/password + deleteSheet password, regels 686-824). Tegenhanger:…
- **Eerste zet:** `figma_get_status` → deep-read van `53:10039` (07 – Profile/Mail) via de Desktop Bridge en de fill van het label 'HUIDIG E-MAILADRES' aflezen; daarna `grep -n -A3 'sheetFieldLabel: {' 'apps/rowtrack/app/(tabs)/profile.tsx'` — wijkt hij af, één regel (993-996) naar de bevestigde rol zetten.
- **Check:** `grep -n -A3 'sheetFieldLabel: {' 'apps/rowtrack/app/(tabs)/profile.tsx'` — `fg.tertiary` = de profiel-sheets wijken nog af van de tegen Figma 388:2256 bevestigde veld-labelkleur `fg.secondary` (`components/GoalSheet.tsx:194-199`).
- **Status:** open

## 2026-09-07 — 4-jul audit-re-triage: resterende werkstromen · [refactor]

- **Wat:** WS2: de component-tokenlaag (o.a. `goalPill` in tokens.json) door de build laten lopen naar `constants/colors.ts` en als laag in Tokens Studio exporteren; WS7: off-token designwaarden in Figma tokeniseren; dekking: vaststellen of Auth/Login 182-2642 en Auth/Register 182-2660 echte, actuele frames zijn (anders designen) en de stale GoalSetupModal-rij uit figma-map.md halen. Splits bij het aanmaken in drie items — dit is één bundel met drie eigenaars.
- **Waarom niet nu:** HANDOFF-item van 2026-07-14, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: Check gedraaid: `grep -c goalPill apps/rowtrack/tokens/tokens.json apps/rowtrack/constants/colors.ts` → `tokens.json:1` / `colors.ts:0` = legenda 'WS2 ligt er nog'. `git log --since=2026-07-14 -- apps/rowtrack/tokens/tokens.json` → enkel `3646cff 2026-07-14…
- **Eerste zet:** `grep -c goalPill apps/rowtrack/tokens/tokens.json apps/rowtrack/constants/colors.ts` (verwacht 1/0) om WS2 te bevestigen; daarna `figma_get_status` en de nodes 182-2642 / 182-2660 lezen om de auth-dekkingsvraag in één keer te sluiten en figma-map.md (Auth-sectie + GoalSetupModal-rij) bij te werken.
- **Check:** `grep -c goalPill apps/rowtrack/tokens/tokens.json apps/rowtrack/constants/colors.ts` — 1 in de bron en 0 in de build-output = WS2 (component-tokenlaag) ligt er nog; WS7 is Figma-zijde en niet uit de repo te lezen.
- **Status:** open

## 2026-09-07 — Geen privacybeleid / rechtsgrond / consent voor (gezondheids)PII · [infra]

- **Wat:** `PRIVACY_POLICY_URL` bereikbaar maken: rowtrack-web deployen (Vercel-project per rowtrack-web HANDOFF 2026-08-10) én de URL-mismatch oplossen — ofwel `lib/links.ts:11` naar de echte route (`/nl/privacy` op het domein van rowtrack-web) zetten, ofwel een redirect `/rowtrack/privacy → /nl/privacy` in rowtrack-web. Let op de volgorde-conflict: rowtrack-web zou pas ná de App Store-release live gaan, maar een consent-scherm dat naar een 404 linkt is zelf een pre-release-blocker.
- **Waarom niet nu:** HANDOFF-item van 2026-07-15, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: Check NIET gedraaid (curl = netwerk, buiten de grens). Wel: `grep -rn PRIVACY_POLICY_URL apps/rowtrack` → `lib/links.ts:11: export const PRIVACY_POLICY_URL = 'https://umanex.be/rowtrack/privacy'`, gebruikt in `components/HealthConsentScreen.tsx:77`. `git log…
- **Eerste zet:** Beslis eerst het domein/pad met Jeroen, pas `apps/rowtrack/lib/links.ts:11` (of een redirect in `apps/rowtrack-web/middleware.ts`) aan, deploy, en sluit af met de bestaande check `curl -sL -o /dev/null -w '%{http_code}' <PRIVACY_POLICY_URL>` → 200.
- **Check:** `curl -sL -o /dev/null -w '%{http_code}' https://umanex.be/rowtrack/privacy` → 404 = beleid nog niet bereikbaar, 200 = rond. De `-L` is niet optioneel: umanex.be stuurt apex-verkeer met een 308 naar `www`, en zonder volgen leest de check die redirect als antwoord — een derde uitkomst die de legenda niet kent. (Gemeten 2026-08-11: 308 → `www.umanex.be/rowtrack/privacy` → 404.)
- **Status:** open

## 2026-09-07 — Sentry error-/crash-monitoring: koppeling uitgesteld · [infra]

- **Wat:** Sentry-koppeling voor rowtrack: `@sentry/react-native` + expo config-plugin in app.json, `Sentry.init({ dsn })` in `initMonitoring()` (DSN via `EXPO_PUBLIC_SENTRY_DSN`, door Jeroen geleverd), `reportError()` in `lib/monitoring.ts` laten doorschrijven naar `Sentry.captureException`, een globale ErrorBoundary, en een native rebuild (`expo run:ios --device`) omdat een native module anders niet in de dev-client zit.
- **Waarom niet nu:** HANDOFF-item van 2026-07-15, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: Check gedraaid: `grep -n 'sentry' apps/rowtrack/package.json` → geen treffer (rc=1) = koppeling niet gelegd. `apps/rowtrack/lib/monitoring.ts` bestaat; regel 4-11: 'De echte Sentry-koppeling volgt in een latere fase (zie HANDOFF 2026-07-15…' en `//…
- **Eerste zet:** Dependency-install vraagt eerst bevestiging (CLAUDE.md 'altijd eerst bevestigen'): `pnpm --filter rowtrack add @sentry/react-native@~7.2.0` + `@sentry/react-native/expo` in `apps/rowtrack/app.json`; daarna de TODO op `apps/rowtrack/lib/monitoring.ts:11` invullen. Klaar-check: `grep -q '@sentry/react-native' apps/rowtrack/package.json`.
- **Check:** `grep -q '@sentry/react-native' apps/rowtrack/package.json` → geen hit = koppeling nog niet gelegd.
- **Status:** open

## 2026-09-07 — Wheel-sheets (#131 flexShrink + #133 pill/fade) niet op toestel geverifieerd · [test]

- **Wat:** De drie wheel-sheets (Lengte 52:9286, Gewicht 52:9424, Geboortedatum 52:9538) op de fysieke iPhone naast Figma leggen — wheels clippen niet, pill/fade conform #133 — en de uitkomst als gedateerd toestel-blok in HANDOFF/figma-map vastleggen.
- **Waarom niet nu:** HANDOFF-item van 2026-07-15, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: Check NIET gedraaid (vraag aan Jeroen, geen commando). Wel: `git log --since=2026-07-15 -- apps/rowtrack/components/WheelPicker.tsx` → alleen `490b703 2026-07-15 fix(rowtrack): visible WheelPicker pill + surface-synced fade` (= #133 zelf); `--…
- **Eerste zet:** Eerst bevestigen dat de check nog over dezelfde code gaat: `git log --oneline 490b703.. -- apps/rowtrack/components/WheelPicker.tsx apps/rowtrack/components/BottomSheet.tsx` (vandaag alleen `cd09074`, i18n); daarna Profiel → Lengte / Gewicht / Geboortedatum openen op het toestel en per sheet één screenshot naast het Figma-frame leggen.
- **Check:** Alleen jij kunt dit beantwoorden: heb je Lengte, Gewicht en Geboortedatum op de iPhone naast Figma gelegd? Nee = open — geen commit of screenshot legt een toestel-check vast.
- **Status:** open
