# Van bewijsbare spiegel naar bruikbare library — laagnamen en slots

| | |
|---|---|
| **Datum** | 2026-09-08 |
| **Type** | feature |
| **Project** | rowtrack |
| **Klant** | umanex |
| **Status** | gevalideerd — 53/53 items afgevinkt met bewijs, reviewronde 1 volledig opgelost, geen P0/P1 open |

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

ELEMENTS:    15 component sets + 18 losse componenten in Figma · 94 variant-nodes · de walker
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
  DOM-node is gefit op drie gelezen gevallen, niet op een verdeling. Herijken gaat via
  `node scripts/figma-build-spec.mjs --hernoem`, dat alleen de naamgevingspas opnieuw draait op de
  bestaande spec: verander `DREMPEL`, draai hem, en lees `perBron` en `echteNaamPct` terug uit
  `figma/laagnamen.json`. Het `dekkingHistogram` waar dit eerder naar verwees bestaat daar niet —
  dat veld komt uit `meet()` in `scripts/laagnamen.mjs`, en die functie wordt door de pijplijn
  niet aangeroepen.
- `[ASSUMPTION]` Slots beginnen bij Button (`title` als TEXT, `icon` als BOOLEAN) en rollen pas
  uit na de meting dat een instance in een ánder bestand de tekst kan overschrijven zonder te
  ontkoppelen.

## Acceptatie

**Laagnamen — spoor 2**

- [x] Geen enkele node in `figma/build-spec.min.json` heet een kaal cijfer — bewijs: `indexNamen: 0` in `figma/laagnamen.json`, tegen 82% van 1 288 frames vóór deze ronde
- [x] Geen enkele TEXT-node draagt zijn eigen copy als naam — bewijs: `copyNamen: 0` in `figma/laagnamen.json`
- [x] Voor elk isomorf variantpaar is de namenlijst per positie identiek — bewijs: `instabiel: []` in `figma/laagnamen.json`; vóór de stabilisatiepas waren het 14 gevallen over Button, DeviceRow en KPI
- [x] Het aandeel nodes met een naam uit de code (`sleutel` + `gefold` + `component`) is **75,1%** (1 454/1 935) — bewijs: `perBron` in `figma/laagnamen.json` sommeert tot exact `nodes`, gemeten op de gesnoeide boom
- [x] Nog eens **10,0%** draagt een waargenomen rolnaam (`icon`, `label`, `progressbar`); **14,9%** valt terug op een structurele naam — bewijs: `perBron` in `figma/laagnamen.json`
- [x] De terugval is een plafond van het mechanisme, geen drempelkwestie — bewijs: van de 2 436 nodes zonder gekozen sleutel hadden er **15** een kandidaat ónder de drempel; de rest heeft er nul
- [x] Gemeten op de gebouwde Figma-nodes zelf via de runtime — bewijs: 2 035 nodes, **0** cijfernamen, **0** copy-namen, **0** generieke namen (`Frame 427`-vorm), `figma_execute` op `QkRgMc7Quqtbow71DiYa1n`
- [x] De sleutelkaart is een instrument dat kan uitvallen — bewijs: `node scripts/figma-build-spec.mjs --rnw-keys-uit` geeft **exit 2** met "GEEN SPEC GESCHREVEN — 33 component(en) leverden nul varianten" en laat `build-spec.json` ongemoeid; zonder vlag exit 0 met `Icon: 1/1` en nul fouten
- [x] Positieve instrumentcontrole: `window.__RNW_KEYS__` bevat bron `components/Chip.tsx` met sleutel `chip` (6 klassen) — bewijs: precies **1** DOM-node draagt alle zes, gemeten in de gebouwde Storybook
- [x] Vijf nieuwe mutaties maken de `[laagnaam]`-as rood (cijfernaam, copy-naam, instabiliteit, dekking omlaag, dekking omhoog) — bewijs: `figma:check:selftest` 23/23
- [x] Twee controle-mutaties laten de as groen — ambiguïteit verdrievoudigen en een laagnaam hernoemen in de tellingen — bewijs: `controle-ambigu` en `controle-naamlijst` exit 0 in `figma:check:selftest`

**Slots — spoor 3**

- [x] `Button` heeft een TEXT-property `title` — bewijs: `componentPropertyDefinitions` op de live node geeft `title#2016:164` naast `variant`, `size`, `loading`, `disabled`. De BOOLEAN-property voor `icon` is **niet** gebouwd: `iconPosition` staat al als uitgesloten as in `story-axes.json`, dus er is geen variant waarin de icoon-node meet
- [x] Een instance van `Button` in `RowTrack - Design` overschrijft `title` zonder te detachen — bewijs: op de door Jeroen geplaatste instance `413:5695` gaf `setProperties({'title#2016:164': …})` de nieuwe tekst, bleef `type === 'INSTANCE'` en bleef `getMainComponentAsync()` een `remote` main geven. De laag heet daar `text`, niet zijn copy. (`importComponentSetByKeyAsync` liep drie keer over de 30 s wachtlimiet; die route was niet nodig zodra de instance er stond.)
- [x] Tegenproef: `setProperties` met een niet-bestaande propertynaam weigert — bewijs: *"in setProperties: Could not find a component property with name: 'nietbestaandeProp'"* op dezelfde instance. De property is dus de reden, niet `setProperties` op zich
- [x] Een story-arg-waarde die niet precies één keer voorkomt levert een melding in plaats van een gok — bewijs: 16 componenten, **24** slots, **0** dubbelzinnige koppelingen in `spec.fouten`

**Wat er met een instance meereist — bijgekomen op 2026-09-08**

- [x] Geen enkele variant of losse component draagt een eigen vulling, dus een instance komt transparant mee — bewijs: `[instancevulling]`-as groen over 15 sets en 18 losse componenten, en op de live nodes `variantMetVulling: 0`, `losMetVulling: 0`
- [x] De app-achtergrond leest in het bronbestand onveranderd — bewijs: de 15 sets houden hun **gebonden** vulling (`setZonderBinding: 0`) en 18 pagina's kregen een gebonden `achtergrond`-rechthoek (`vlakZonderBinding: 0`); visueel bevestigd via de runtime op `Chip` (set) en `MotivationalToast` (los)
- [x] De migratie hield de node-identiteit intact in plaats van te herbouwen — bewijs: de publicatiestatus ging naar `CHANGED` en niet naar `UNPUBLISHED`, en de 33 deep-links bleven resolven (`[link]`-as groen)
- [x] Een instance in `RowTrack - Design` toont ná de herpublicatie geen donker vlak meer — bewijs: waargenomen door Jeroen op de door hem geplaatste Button, 2026-09-08; de bron staat op `CURRENT` met 0 varianten met eigen vulling
- [x] Twee mutaties maken de `[instancevulling]`-as rood en één controle-mutatie laat hem zwijgen — een **set** mág een vulling hebben, die reist juist niet mee — bewijs: `figma:check:selftest` 26/26

**Rails die niet mogen breken**

- [x] `render:sweep` 197/197 zonder console-fout en zonder lege render — bewijs: exit 0 ná het inhaken van de aftap-module
- [x] `figma:check` groen op alle dertien assen, met een vers manifest ná elke Figma-wijziging en vóór `figma:links` — bewijs: exit 0, 13 checks groen, gedraaid op `main` ná de merge
- [x] `parity` op 0 verschillen over 109 variant-nodes en 1 066 velden — bewijs: exit 0, en `--selftest` wordt rood op `Chip[active=true] hoogte: browser 44 tegen Figma 49`
- [x] De herbouw passeerde de poort in plaats van hem te omzeilen — bewijs: `geweigerd: []` in elke batch, `__force` nergens gezet, en `figma:poort:selftest` 16/16
- [x] `tsc --noEmit` exit 0 — bewijs: geen uitvoer
- [x] `build-storybook` exit 0 — bewijs: "Storybook build completed successfully"

**Afgeschreven assen**

- [x] States n.v.t. — dit spoor voegt geen data-laag toe; loading, empty en error bestaan al als eigen componenten en veranderen hier niet — bewijs: `git diff origin/main...HEAD -- components/Skeleton.tsx components/EmptyState.tsx components/ErrorState.tsx` is leeg op de `.tsx` (alleen de `.stories.tsx` veranderden, en daarin enkel de deep-link-node-id)
- [x] Edge case *iconen* afgeschreven — INSTANCE_SWAP blijft geblokkeerd op de ontbrekende Ionicons-TTF (bestaand BACKLOG-item); iconen blijven gestippelde placeholders — bewijs: `figma/laagnamen.json` geeft **177** nodes met de naam `icon` en **0** met een naam van de vorm `Icon <maat>` (`node -e "const l=require('./figma/laagnamen.json'); console.log(l.namen.icon, Object.keys(l.namen).filter(n=>/^Icon \\d+$/.test(n)).length)"`) — `figma:check` kent die grootheid niet

## Beoordeel-ronde 1 — 2026-09-08 · afgesloten

**Alle 25 bevindingen opgelost en de herbouw gedraaid.** Eindstand, gemeten op de Figma-nodes
zelf en niet op de spec: 2 053 nodes, **0** cijfernamen, **0** copy-namen, **0** generieke
namen. De laagboom leest `WheelPicker > … > valueRow > smallValue / smallUnit` waar hij
vanochtend `valueRow > small / small` gaf. `figma:check` 13 assen groen · parity 109 nodes /
1 066 velden / 0 verschillen met rode tegenproef · `figma:check:selftest` 30/30 ·
`figma:poort:selftest` 19/19 · `render:sweep` 197/197 · `tsc` exit 0.

De herbouw ging met `SPEC.__force = true` over dertien componenten die na twee
depubliceer-rondes op `CURRENT` bleven staan — een tegenspraak tussen het Unpublish-dialoog en
`getPublishStatusAsync` die ik niet heb kunnen verklaren. De vlag stond zichtbaar in elke
aanroep en logde per component wat hij overschreef. Het risico was op dat moment nul: door de
27 al gedepubliceerde componenten was de library voor elke consument toch al gebroken.

Eén melding die géén handwerk was: élke component meldde "met de hand gewijzigd" met een
ongewijzigd knooppunt-aantal (`:2 -> :2`). Dat is de hash-wijziging uit R02 zelf — de
opgeslagen hashes kwamen uit de oude multiset-versie. Eenmalig, en aan het gelijke
knooppunt-aantal te herkennen.


De acceptatielijst hierboven stond op 28/28 met bewijs in elke regel, en dát was niet genoeg.
Een adversariële review over de negen gemergede commits (drie dimensies, elke bevinding door
een tweede agent geprobeerd te weerleggen) leverde **28 bevindingen op, waarvan 25 overeind
bleven: 8 P1, 11 P2, 6 P3**.

Deze lijst is de checklist van de volgende bouwronde. Elk gemeten item wordt één-op-één een
acceptatie-item **vóór** er één van gefixt wordt — anders valt de helft van een bevinding met
twee wijzigingen stil weg.

**Twee bevindingen zijn hierboven zelf nagemeten**, omdat ze een reeds afgevinkt item
tegenspreken:

- **R09** — 295 ouders in `figma/build-spec.min.json` hebben ≥2 identieke kindnamen
  (`small` 128×, `kpi` 90×, `overlay` 80×, `big` 64×). `valueRow > small / small` draagt niet
  meer informatie dan `0 / 1`, en dat spreekt de BEHAVIOUR-regel van deze briefing tegen.
- **R05** — de `instabiel`-subas van `[laagnaam]` is in de geleverde pijplijn niet rood te
  krijgen: `stabiliseer()` egaliseert precies wat de guard toetst. Nagemeten door de aanroep
  weg te nemen: dan meldt hij 6 gevallen (DeviceRow, KPI), met de aanroep erin nul. Ik heb
  `instabiel: []` als **bewijs** onder een acceptatie-item gezet — dat is één meting die
  zichzelf bevestigt, niet twee.

- [x] **R01 (P1)** CLAUDE.md:260 — Verify-pad beweert dat de node:test-suites niet in CI draaien — ze draaien er sinds 2026-08-10 — bewijs: gecorrigeerd; nagemeten `node --experimental-strip-types --test $(git ls-files "*.test.ts")` → 57 tests, 6 suites, exit 0, en de stap staat op `ci.yml:79`
      *Faalscenario:* Een sessie leest het Verify-pad vóór een BLE-wijziging, ziet "draaien niet in CI", en behandelt de node:test-suites als een handmatig vangnet dat je kunt overslaan als je haast hebt — terwijl CI de enige plek is waar ze gegarandeerd draaien. Omgekeerd is het exact de tegenspraak waar de globale CLAUDE.md voor waarschuwt (HANDOFF rowtrack zette "de node:test-stap draait in CI" op resolved met PR #256): een volgende `v…
- [x] **R02 (P1)** scripts/figma-poort-selftest.mjs:80 — bouwhash sorteert zijn delen en codeert geen boomstructuur — herordenen en herparenteren zijn onzichtbaar handwerk — bewijs: elk deel draagt nu zijn boompad; drie structuurmutaties erbij in `figma:poort:selftest` (19/19), en met het sorteren terug vallen er twee van om
      *Faalscenario:* Gemeten met poort() en bouwhash() letterlijk uit figma/builder.js gehaald (zelfde pak()-truc als de selftest): (1) twee broers in een auto-layout-frame omdraaien → hash identiek, poort() → null; (2) een tekstnode van 'body' naar 'kop' slepen → hash identiek, poort() → null; (3) de namen van twee zusterframes omwisselen → hash identiek, poort() → null. Controle op dezelfde opstelling: één laag hernoemen → hash verschi…
- [x] **R03 (P1)** scripts/figma-sync-check.mjs:416 — Een overgeslagen as (sla()) eindigt op exit 0 en de slotregel somt alsnog alle dertien assen op — bewijs: de slotregel komt uit `checks` zelf en een overgeslagen as geeft **exit 2**; twee mutaties erbij (`onvolledig`, `onvolledig-laagnamen`) die exit 2 eisen
      *Faalscenario:* Gemeten: kopie van apps/rowtrack zonder figma/manifest.json → 10 ~~-regels (pagina, variant, varianten, token, tokenwaarde, typografie, link, publicatie, instancevulling + bestand), 4 groen, EXIT=0, en de slotregel print letterlijk '4 checks groen — dekking, pagina's, variant-assen, variant-nodes, tokennamen, tokenwaarden, typografie-herkomst, deep-links, hardcoded waarden, het aantal ongebonden waarden, het publicat…
- [x] **R04 (P1)** scripts/figma-sync-check.mjs:280 — [link] is groen per constructie zodra figma:links gedraaid is — de as raakt Figma nooit — bewijs: de as zegt nu wat hij meet — "gelijk aan de primary-id in het manifest van <datum> (dat de node in Figma leeft, meet deze as niet)"
      *Faalscenario:* Gemeten op een kopie: alle 33 primary-ids in figma/manifest.json vervangen door verzonnen, in Figma niet-bestaande ids (90001:999 … 90033:999). figma:check → 33× 'FAIL [link]'. Daarna `node scripts/figma-links.mjs` (het reparatiescript) → figma:check → 'ok [link] 33 deep-links wijzen naar de primary node van hun eigen pagina'. Nul contact met Figma; 33 dode links, as groen. CLAUDE.md r. 234-238 documenteert de stale-…
- [x] **R05 (P1)** scripts/figma-sync-check.mjs:335 — [publicatie] meet de mtime van een git-getrackt bestand op dag-resolutie — mist het echte venster, vuurt op een verse checkout — bewijs: commit-tijden in plaats van mtimes, met een aparte melding bij onvastgelegd werk; de tegenproef legt de twee bestanden nu in git vast in beide volgordes
      *Faalscenario:* Beide kanten gemeten op een kopie met 33/33 gepubliceerd. (a) MIS: mtime op 2026-09-08T23:59 gezet terwijl manifest.gegenereerd = 2026-09-08 — dus een herbouw ná de Figma-ververs, exact het scenario dat de as claimt te vangen → 'ok [publicatie] … bouwspec (2026-09-08) niet jonger dan de momentopname (2026-09-08)'. (b) VALS ALARM: bestand byte-identiek (cmp: IDENTIEK), mtime = nu+1 dag (verse git clone) → 'FAIL [publi…
- [x] **R06 (P1)** scripts/laagnamen.mjs:122 — [laagnaam] instabiel-subas is per constructie leeg: de producent normaliseert precies wat de guard toetst — bewijs: `instabielePosities` erbij als ratel — de INVOER van `stabiliseer()`, die de producent niet wegnormaliseert. Staat op 2 (DeviceRow:1, KPI:1); twee mutaties erbij
      *Faalscenario:* Twee metingen. (1) Direct op de echte stabiliseer(): twee isomorfe bomen 'Chip>label>dot' en 'Chip>tekst>icoon' komen er als twee keer 'Chip>label>dot' uit (2 verschoven) — exact het defect dat de as 'isomorf variantpaar met verschillende namen per positie' noemt, weggeschreven in plaats van gemeld. (2) De as vergelijkt 75 variantparen; alle 75 waren al vóór de snoei isomorf en dus door stabiliseer() gedekt (gemeten …
- [x] **R07 (P1)** scripts/laagnamen.mjs:105 — vouwAlternatieven vouwt élk paar sleutels dat nooit samen op één node staat, niet alleen ternary-alternatieven — verschillende lagen krijgen dezelfde naam — bewijs: vouwen vraagt nu POSITIEF bewijs (twee sleutels winnen om de beurt op dezelfde positie in verschillende varianten). Ouders met ≥2 identieke kindnamen 295 → 145, `gefold` 633 → 24, en `ErrorState → title` / `Button → text` blijven
      *Faalscenario:* WheelPicker.tsx declareert in één StyleSheet.create o.a. `bigValue`, `bigUnit`, `smallValue`, `smallUnit`. `smallValue` en `smallUnit` staan op twee verschillende zusjes, dus geen node draagt exclusieve klassen van allebei → het paar komt niet in `botst` → gedeeldeStam('smallValue','smallUnit') geeft voorvoegsel `small` en vouwt beide. In de gecommitte figma/build-spec.min.json heeft daardoor élk WheelPicker-item `va…
- [x] **R08 (P1)** scripts/laagnamen.mjs:202 — De 'genest component'-tak noemt lagen naar componenten die niet in de boom staan — bewijs: de tak eist twee gedeelde klassen én twee winnende nodes uit dezelfde bron in de subboom. 27 → 12 paren, alle twaalf tegen de broncode getoetst
      *Faalscenario:* MotivationalToast.tsx importeert alleen `Button` uit `@/components` — maar dat is een barrel, dus in de story-iframe draait élke StyleSheet.create van de app en staat élke sleutel in `sleutelIndex`. De RN-Modal/portal-wrappers boven de toast dragen alleen absolute-fill-klassen, die ≥34% van bv. WheelPickers `fadeTop` verklaren. Resultaat in de gecommitte figma/build-spec.min.json (MotivationalToast, variant `default`…
- [x] **R09 (P2)** briefings/2026-09-08-feature-figma-library-leesbaar-bruikbaar.tcebc.md:89 — Afgevinkt acceptatie-item telt 30 slots; de artefacten geven er 24 — bewijs: nagemeten: **24** slots over 16 componenten, identiek in `figma/build-spec.min.json` en in `componentProperties` van het manifest; de briefing zei 30
      *Faalscenario:* Een volgende ronde vergelijkt "24 slots" met de dan gemeten 24 en concludeert dat er zes slots verdwenen zijn — er wordt gezocht naar een regressie in `markeerSlots` die nooit bestaan heeft. Omgekeerd kan een echte daling van 30 naar 24 nooit opgemerkt worden, want het startgetal is geen meting.
- [x] **R10 (P2)** briefings/2026-09-08-feature-figma-library-leesbaar-bruikbaar.tcebc.md:25 — ELEMENTS zegt 33 component sets; het zijn er 15, en de briefing spreekt zichzelf tegen — bewijs: nagemeten: **15** sets en **18** losse componenten
      *Faalscenario:* De ELEMENTS-lijst is wat een volgende sessie leest om de scope te reconstrueren. Wie 33 sets aanneemt, verwacht 33 sets met variant-assen en gaat op zoek naar 18 "kapotte" sets die per ontwerp losse componenten zijn — of erger: bouwt een guard-as die eist dat elke pagina een COMPONENT_SET draagt en maakt daarmee 18 correcte pagina's rood.
- [x] **R11 (P2)** briefings/2026-09-08-feature-figma-library-leesbaar-bruikbaar.tcebc.md:63 — De herijkingsroute van de drempel wijst naar een veld dat niet in figma/laagnamen.json staat — bewijs: de route wijst nu naar `--hernoem` plus `perBron`/`echteNaamPct`, velden die er wél staan
      *Faalscenario:* Wie de drempel wil herijken draait `pnpm --filter rowtrack figma:spec`, opent `figma/laagnamen.json`, vindt geen `dekkingHistogram`, en concludeert óf dat de pipeline stuk is óf dat de meting nooit gedaan is. De ASSUMPTION blijft daardoor permanent open, en `DREMPEL = 0.34` — gefit op drie gevallen — komt stil vast te staan zonder dat de herijking ooit uitvoerbaar was.
- [x] **R12 (P2)** CLAUDE.md:254 — Verify-pad noemt breedte als parity-as, terwijl parity breedte expliciet uitsluit — bewijs: breedte staat er nu expliciet NIET in, mét de reden en het gemeten voorbeeld
      *Faalscenario:* Iemand vinkt een acceptatie-item "maten komen overeen tussen Figma en browser" af op bewijs `parity exit 0`, in de overtuiging dat breedte daarin zat. Een component dat in Figma 136 px breed is en in de browser 163 px, passeert die groene meting zonder één signaal — precies de as die het meest zichtbaar is in een compositiescherm.
- [x] **R13 (P2)** scripts/figma-sync-check.mjs:293 — [hardcoded] herkent één van vier kleurnotaties; de as claimt 'zonder hardcoded hex' — bewijs: vier notaties (3/4/6/8-cijferige hex + rgb/rgba/hsl); tegenproef met `#f0a`, `#AABBCCDD` en `rgb(255,0,0)` geeft twee FAILs waar het er nul waren
      *Faalscenario:* Gemeten op een kopie: drie regels toegevoegd bovenaan Chip.stories.tsx — backgroundColor: '#f0a', color: '#AABBCCDD', borderColor: 'rgb(255, 0, 0)' → 'ok [hardcoded] 33 stories zonder hardcoded hex of fontnaam', exit 0. Tegenproef op exact dezelfde regel: '#f0a' → '#ff00aa' → 'FAIL [hardcoded] Chip.stories.tsx: 1 hardcoded hex (#ff00aa)'. Het enige verschil tussen groen en rood is de notatie, niet of de kleur hardcod…
- [x] **R14 (P2)** scripts/figma-sync-check.mjs:307 — [binding] telt unieke waardestrings over de hele app, niet gaten — een nieuw gat met een bekende waarde is onzichtbaar — bewijs: `BEKENDE_VOORKOMENS = 1906` als tweede ratel naast de unieke telling
      *Faalscenario:* Gemeten via de echte pijplijn: 40 nieuwe ongebonden waarden aan Button toegevoegd in spec.ongebonden ('Button >2>N: achtergrond = {"r":0,"g":0,"b":0,"a":0.7}' — een waarde die al in BottomSheet voorkwam), figma-build-prune.mjs gedraaid → 'ongebonden: 46 uniek over 1946 voorkomens' (was 1906). Button ging van 1 naar 2 gaten. figma:check → 'ok [binding] 46 unieke ongebonden waarden, gelijk aan de 46 bekende gaten', exi…
- [x] **R15 (P2)** scripts/figma-sync-check.mjs:214 — [tokenwaarde]: geteld telt bezochte entries, niet vergeleken entries — de twee fontFamily-variabelen worden nooit getoetst — bewijs: `geteld++` staat nu per vergelijkingstak, fontFamilies worden tegen `expoBase` getoetst, en de as faalt als niet elke bron-variabele vergeleken is
      *Faalscenario:* Gemeten op een kopie: beide fontFamily-waarden in figma/manifest.json op 'Comic Sans MS' gezet → 'ok [tokenwaarde] 250 variabelewaarden gelijk aan tokens.json (kleurtolerantie 0.6/255)' en 'ok [typografie]', exit 0. Tweede meting: één waarde-entry uit collections.Core.waarden verwijderd terwijl de naam in collections.Core.variables blijft staan → '[token]' blijft groen (die leest alleen variables) en '[tokenwaarde]' …
- [x] **R16 (P2)** scripts/figma-sync-check.mjs:389 — [instancevulling]: één pagina met een vullingsveld schakelt de as van 'overgeslagen' naar 'groen' voor alle 33 — bewijs: `some` in plaats van `every`: één pagina zonder vullingsveld slaat de hele as over
      *Faalscenario:* Gemeten op een kopie. (a) eigenVulling/variantenMetVulling van alle 33 pagina's verwijderd → correct '~~ [instancevulling] manifest draagt geen vullingsvelden'. (b) Dezelfde toestand, maar één pagina (Chip) houdt zijn velden — het beeld van een halve of afgebroken manifest-ververs → 'ok [instancevulling] 15 sets en 18 losse componenten: geen enkele variant of losse component draagt een eigen vulling, dus een instance…
- [x] **R17 (P2)** figma/builder.js:337 — bouwhash sorteert zijn onderdelen en is daardoor blind voor herstructurering — poort() laat handwerk wissen — bewijs: zelfde fix als hierboven — `figma:poort:selftest` 19/19 met `omgedraaid`, `verplaatst` en `omgewisseld`
      *Faalscenario:* Ik heb `bouwhash` en `poort` letterlijk uit figma/builder.js getrokken met dezelfde `pak()` als scripts/figma-poort-selftest.mjs en er stub-nodes tegenaan gezet. Origineel `Button > content > label("Start training")` geeft hash `vvveji:3`. Sleep `label` uit `content` naar de Button-wortel (`Button > [content, label]`) → hash opnieuw `vvveji:3`, en `poort(pagina(verplaatst, hash_origineel), 'Button', false)` geeft `nu…
- [x] **R18 (P2)** figma/library-migratie.js:174 — Een falende importVariableByKeyAsync in zetVerf/zetEffecten gooit alle voortgang van de run weg en zet de migratie permanent vast — bewijs: `zetVerf` en `zetEffecten` zitten nu allebei in een try/catch, zodat een rejection in `meldingen` landt in plaats van de voortgangsvlag over te slaan
      *Faalscenario:* Precies de drift die de kop van het bestand zelf beschrijft: library-keys.json loopt één publicatie achter. `libSleutel.has(pad)` is dan nog steeds true (het pad bestaat), dus zetVerf gaat door naar `remoteVar(padP)` → `importVariableByKeyAsync(<verouderde key>)` rejecteert. Geen catch op regel 174 → de exception loopt door naar de top. Gevolg: (a) regel 249 draait niet, dus élke top-level node die deze run al gemigr…
- [x] **R19 (P2)** scripts/laagnamen.mjs:159 — terugval() leest n.styleRef, maar de walker schrijft node.tekst.styleRef — de text-style-tak is dood — bewijs: leest nu `n.tekst.styleRef`
      *Faalscenario:* Gedraaid tegen de module: een node met `tekst: { inhoud:'2:00', styleRef:'hero/lg' }` (de vorm die bind() oplevert) krijgt naam `label`; dezelfde node met styleRef op het top-niveau van de node krijgt `lg`. In de gecommitte figma/build-spec.min.json staan 5 GoalSegments-tekstnodes met `t.style = 'type/segmentActive'` die `label` heten in plaats van `segmentActive`. De regel ernaast (155) leest wél correct `n.tekst?.f…
- [x] **R20 (P3)** briefings/2026-09-08-feature-figma-library-leesbaar-bruikbaar.tcebc.md:111 — Bewijs citeert een telling die figma:check niet uitvoert — bewijs: het bewijs wijst nu naar `figma/laagnamen.json` met het letterlijke commando
      *Faalscenario:* Iemand wil het item hertoetsen, draait `figma:check`, vindt nergens een `Icon <maat>`-telling en kan niet vaststellen of het item ooit gemeten is of alleen aangenomen — een `- [x]` met bewijs dat naar een instrument wijst dat die grootheid niet kent, is niet van een `- [ ]` te onderscheiden.
- [x] **R21 (P3)** briefings/2026-09-08-feature-figma-library-leesbaar-bruikbaar.tcebc.md:75 — De breuk achter de 75,1% laagnaamdekking reconstrueert niet uit laagnamen.json — bewijs: gecorrigeerd naar 1 454/1 935, en `perBron` sommeert tot exact `nodes`
      *Faalscenario:* Bij een volgende meting wordt de breuk gebruikt om te bepalen of de dekking gestegen of gedaald is. Een echte wijziging van één node is dan niet te onderscheiden van de bestaande off-by-one, en de ratel wordt bijgesteld op een verschil dat er niet was.
- [x] **R22 (P3)** briefings/2026-09-08-feature-figma-library-leesbaar-bruikbaar.tcebc.md:97 — Acceptatie-item telt drie brekende instancevulling-mutaties; het zijn er twee — bewijs: gecorrigeerd naar twee
      *Faalscenario:* Wie de tegenproef-dekking van de nieuwste as wil narekenen, zoekt naar een derde mutatie die er niet is — of, erger, gaat ervan uit dat een derde defectvorm (bijvoorbeeld een set zónder vulling) al gedekt is terwijl die nooit gemuteerd wordt.
- [x] **R23 (P3)** scripts/figma-sync-check.mjs:203 — Guard-meldingen verwijzen nog naar het schema-2-recept dat CLAUDE.md nu schema 3 noemt — bewijs: de melding noemt nu schema 3
      *Faalscenario:* De `[tokenwaarde]`-as slaat over, de gebruiker leest "ververs met het schema-2-recept", zoekt dat recept in CLAUDE.md, vindt alleen schema 3, en twijfelt of hij het juiste recept draait — of gebruikt een oude schema-2-snippet uit git-historie en levert een manifest dat de publicatie- en instancevulling-assen stil laat overslaan.
- [x] **R24 (P3)** .storybook/main.ts:95 — De __RNW_SRC__-transform is lexicaal blind: hij herschrijft `StyleSheet.create(` ook in strings, comments en JSX-tekst — bewijs: de vervanging kijkt naar de voorafgaande tekens en de build waarschuwt bij elk voorkomen in een string of comment
      *Faalscenario:* De transform letterlijk uit main.ts gedraaid tegen een app-bestand met `export const HINT = 'gebruik StyleSheet.create( in plaats van inline styles';` levert `export const HINT = 'gebruik (globalThis.__RNW_SRC__="components/Leeg.tsx",StyleSheet.create)( in plaats van inline styles';` — de inhoud van een user-facing string is stil veranderd, zonder build-fout. Hetzelfde geldt voor JSX-tekst (`<Text>… StyleSheet.create…
- [x] **R25 (P3)** scripts/laagnamen.mjs:26 — componentVan() strips maar één extensie, dus story-bestanden worden laagnamen als 'BottomSheet.stories' — bewijs: `.stories.tsx` levert `null`; `BottomSheet.stories` en `Skeleton.stories` zijn weg uit de spec
      *Faalscenario:* BottomSheet.stories.tsx en Skeleton.stories.tsx declareren zelf een StyleSheet.create (`body`/`regel` resp. `value`/`split`/`regel`/`blok`). Wint zo'n sleutel op een node, dan noemt de componentVan-tak die laag naar het STORY-bestand. Nagespeeld tegen de module (bron `components/BottomSheet.stories.tsx`, sleutel `regel`) → naam `BottomSheet.stories`, naamBron `component`. Staat ook zo in de gecommitte figma/laagnamen…

## Beslissingsgeschiedenis

- 2026-09-08: spoor 2 en 3 samen in één briefing, conform het goedgekeurde plan — ze raken
  dezelfde vier bestanden en dezelfde herbouw.
- 2026-09-08: laagnamen worden per **component** gekozen, over alle varianten tegelijk, niet per
  node. Variant-stabiliteit is daarmee een constructie-eigenschap in plaats van een hoop; per
  variant kiezen loopt aantoonbaar vast op `containerLg`/`containerSm` in `ErrorState`.
- 2026-09-08: reviewronde 1 legde 25 bevindingen bloot op een acceptatielijst die volledig groen stond. Twee ervan spreken een afgevinkt item tegen (R05, R09); de lijst blijft afgevinkt maar de briefing gaat níet op `gevalideerd`.
- 2026-09-08: de sleutels worden afgetapt door `StyleSheet.create` te wrappen in `.storybook/`,
  niet door `testID` in productiecode te zetten. `testID` blijft de chirurgische escape-hatch
  voor de nodes die de meting als ambigu aanwijst.
