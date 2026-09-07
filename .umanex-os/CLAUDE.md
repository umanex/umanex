# CLAUDE.md — globale werkprincipes voor umanex

Dit is de globale "operating system" laag voor mijn manier van werken als freelance UX/UI designer en developer. Klant-CLAUDE.md (Columba, Luminus, umanex) extends dit bestand. Project-CLAUDE.md (per project binnen een klant) extends de klant-laag.

Regel: een principe of skill hoort thuis op de **laagste laag waar hij echt verandert**. Wat altijd geldt → hier. Wat per klant verschilt → klant-CLAUDE.md. Wat per project verschilt → project-CLAUDE.md.

---

## Taal en communicatie

**Taal in conversatie:** Nederlands, behalve technische termen die in het Engels blijven (bv. "deze component", "de props", "de state").

**Taal in code:** Engels voor code, variabelen, functienamen, commentaar en commit messages. Nederlands voor uitleg buiten code (markdown documentatie, chat antwoorden, design rationale).

**Toon:** Direct met korte argumentatie. Niet pedagogisch — Jeroen heeft de context al. Geef pushback wanneer een beslissing technische, UX- of business-implicaties heeft die niet evident zijn vanuit de vraag zelf.

**Lengte:** Antwoord + argumentatie + relevante caveats, dan stoppen. Geen volledige uitwerking tenzij gevraagd.

**Formatting:** Markdown is toegestaan waar het de leesbaarheid helpt — lijsten voor opsommingen van 3+, headers voor secties, tabellen voor vergelijkingen. Niet over-formatten: voor losse zinnen of korte antwoorden gewoon proza.

**Emoji:** niet gebruiken tenzij Jeroen er zelf eentje stuurt.

---

## TC-EBC framework

Een prompt skeleton — **T**ask / **C**ontext / **E**lements / **B**ehaviour / **Co**nstraints — dat design- en prototype-briefings formaliseert vóór ze gebouwd worden. Geen verbose documentatie: elke regel zo kort mogelijk, alleen wat het model écht moet weten.

**De poort.** Bevat de input een UI- of design-element (component, scherm, flow, interactie, layout, visueel patroon)? → TC-EBC. Gaat het over puur niet-UI werk (refactor, performance, bugfix in business logic, debug, deployment)? → skip, en zeg expliciet: *"Lijkt geen design taak — TC-EBC overgeslagen."* Bij twijfel: door met TC-EBC — een onnodige is minder erg dan een gemiste.

**Wanneer.** Bij elke design- of prototype-briefing is de TC-EBC je *eerste* actie: vóór je de codebase verkent, vóór je verduidelijkingsvragen stelt. Geen optionele stap, en geen vraag vooraf.

**Harde rail:** dit gebeurt in de **main agent context**, nooit uitbesteed aan een sub-agent — buiten de main-agent komt de `@`-import CLAUDE.md-keten niet gegarandeerd mee.

**Kritische items:** component-typologie · states · interactie-modaliteit · edge cases. Alle vier beantwoord of op de Open vragen-lijst.

**Uitvoering:** lees de **`tc-ebc` skill** — stappenplan, vraag-formulering per kritisch item, bestandslocatie en het bestandsformaat met acceptatie-checklist. Schrijf er nooit één op de gok zonder die skill: dat formaat is precies wat de Beoordeel-stap later toetst.

---

## Plan / Bouw / Beoordeel — werkprincipe

Een lus voor substantieel bouwwerk: **PLAN → BOUW → BEOORDEEL**, herhalend tot de taak *gevalideerd* is. De snelle, per-taak tegenhanger van de trage eval-loop (`vastleggen` → `learnings-verwerken`).

**De poort**

- **Wel:** design-to-code, nieuw component, feature-flow, business-logica met afhankelijke berekeningen — werk waar één feat doorgaans meerdere fix-iteraties vraagt.
- **Niet (bouw direct):** copy-/token-/één-regel-fix, dep-bump, ci/config-sync, rename, pure debug/deploy/infra zonder gedragscontract.
- **Twijfel?** Heeft de Beoordeel-stap iets *meetbaars* om tegen te valideren? Zo niet → geen cyclus.

**De rollen in één regel** — PLAN levert de acceptatie-checklist (TC-EBC bij design, **main-agent only**; een licht taak-contract bij refactor/bugfix/infra) — en bij **afhankelijke berekeningen** ook minstens één invariant over het hele model, want scherm-per-scherm valideert daar niets — BOUW draait in de main-agent of de bouw-skill bij het taaktype, BEOORDEEL is een panel van `code-review` · `verify` · `ux-audit` · `security-audit` met de main-agent als scheidsrechter. Produceert een meet-, parity- of review-ronde zélf bevindingen (F1…F5) — ook midden in een bouw-skill, ook in iteratie twee — dan is díe lijst de bron van de checklist: elk gemeten item wordt één-op-één een acceptatie-item **vóór je er één van fixt**, en een bevinding met twee wijzigingen in één regel wordt twee items. "kpi-strip: add top border, remove `py-1.5`" leest als één ding, dus de helft die wegviel viel stil weg en de ronde sloot af met "nul verschillen" terwijl de scheidingslijnen de haarlijnen niet raakten. De **`cyclus-tot-validatie` skill** heeft de mapping, het panel per as en de reviewer-discipline — lees hem voor je de lus start.

**EXIT (status `gevalideerd`)** geldt pas wanneer alle drie waar zijn: elk acceptatie-item afgevinkt `- [x]` **op bewijs, niet op herinnering**, mét dat bewijs ín de regel — `- [x] CTA's op één hoogte — bewijs: y=612 op 02–08 (figma_execute)`; een item als "`DataTable` is ongewijzigd" toets je met `git diff`, niet met wat je dacht te hebben gedaan. Een vinkje zonder `bewijs:` is een `- [ ]` dat er anders uitziet, en `.githooks/pre-commit` waarschuwt bij elk nieuw vinkje zonder in een `*.tcebc.md`. Gemeten op Soda+ (2026-08-25): zeventien van negentien items op `[x]` na de bouwronde, vijf ervan sprak het bestand tegen — "CTA's op één hoogte" bij 288 px spreiding, "≤ 2 zinnen" bij drie, "verborgen" bij een section op `visible: true`; afgevinkt op de herinnering van de bouwstap, niet op een meting die rood kon worden · geen P0/P1 in `code-review`, `verify` of (bij backend-werk) `security-audit` · Open vragen leeg.

Harde rail: **max 3 iteraties**. Convergeert het niet → gecontroleerde stop: `vastleggen` niet-interactief (taak-input als Input, de aanhoudende bevinding als Fout) en escaleer naar Jeroen. Nooit stil afsluiten alsof gevalideerd. Ontbreekt de meetbare as (geen render-pad → `verify`/parity vallen terug op "overgeslagen")? Meld dat expliciet; draai de Beoordeel-stap niet alsof hij slaagde.

**Discipline in de Bouw-stap** — *een schrijf-actie erft haar bereik van je lus, niet van de opdracht.* Een normalisatie-pass over "alle frames", een find-and-replace over "elk voorkomen": per node correct, per opdracht fout, en dat verschil is aan de code niet te zien. Som eerst de nodes op die de taak noemde en laat de mutatie over díe lijst lopen; log per wijziging de vóór- en ná-waarde, want een overloop is anders onzichtbaar. Filtert een string twee bronnen (een join-sleutel), dan draagt elke bron haar eigen label: vraag per voorkomen *welke kant beschrijft deze string?* — een find-and-replace beantwoordt die vraag nooit.

**Discipline in de Beoordeel-stap** — de regels hieronder staan hier en niet in de skill, want ze bijten in élke sessie die iets verifieert, ook zonder de cyclus.

*De Beoordeel-stap schrijft.* Bouwen, migreren en installeren veranderen de schijf. Serveert een langlopend proces uit diezelfde map, dan deployt je verificatie ongewild: jij ziet exit 0, de gebruiker een witte pagina. Check vóór een build of er iets uit die map serveert (`pm2 status`, `lsof -nP -iTCP:<poort> -sTCP:LISTEN`).

*Verifieer op het doelwit van de gebruiker.* Groen op een ander toestel, een andere build of een andere omgeving bewijst niets over zijn geval. Draai de volledige cyclus op hetzelfde doelwit, of meld expliciet dat je op een surrogaat testte en wat dat níet uitsluit.

*Nooit een destructief pad tegen productiedata.* Dit begrenst de vorige regel. Toets de guard in plaats van het effect, draai de logica op synthetische invoer, of gebruik een testaccount. Lukt geen van drieën: `[NIET TE VERIFIËREN — destructief pad, geen testaccount]`. Dat is een leemte, geen vrijbrief; wil je het écht uitvoeren, vraag het vooraf.

*Een instrument dat draait is nog geen instrument dat meet.* Vóór je een uitkomst vertrouwt, toon je dat hij hád kunnen afwijken. Een **guard** toets je op béide kanten (één geval waarin hij zwijgt, één waarin hij afgaat); een **lege of afgewezen** uitkomst vraagt een positieve controle, want "niet gevonden", "geweigerd" en "instrument kapot" zien er identiek uit; een **groene** uitkomst vraagt een negatieve controle, want een gevulde, wáre uitkomst kan over de verkeerde grootheid gaan; en een **vervangen** instrument zegt pas iets over het gewijzigde deel als het het óngewijzigde exact reproduceert. Kun je het gedrag niet opwekken, dan is het antwoord `[NIET TE VERIFIËREN — reden]`, nooit een goedkopere proxy. Beoordelaars op dezelfde afgeleide bron zijn één meting: hun overeenstemming meet de bron.

*Een lus over een variabele draait in zsh één keer.* De tool-shell is zsh, en die splitst een ongequote variabele niet op whitespace: `for f in $VAR` itereert over één lange string in plaats van over de regels. Er faalt niets, dus `set -e` en `pipefail` zwijgen — de uitkomst is stil leeg of onvolledig, en de vorm die de fout maakt is precies de vorm die in bash correct is. Gebruik:

```bash
printf '%s\n' "$VAR" | while IFS= read -r f; do … ; done
```

of geef de lijst aan `xargs`. Committed scripts met `#!/bin/bash` zijn wél correct; dit geldt alleen inline. Bij een lege uitkomst uit zo'n lus is de eerste vraag niet "is er niets" maar "heeft de lus gedraaid".

*De tegenproef draagt het defect zelf, en beweegt met het object mee.* Dat een check rood kán worden is niet genoeg — hij moet rood worden op precies het defect waarvoor de code bestaat. Drie vormen: **neem de fix weg** en eis dat de suite omvalt; **laat het instrument het object eerst terugvinden** vóór je er een eigenschap van meet; **verander het object** en eis dat de check meebeweegt. Een tegenproef die niet met de fix of het object meebeweegt, meet iets anders. Geven **beide kanten** dezelfde uitkomst, dan is dat geen dubbele bevestiging maar de melding dat je opstelling het defect niet kán opwekken — de enige geldige conclusie is dan dat de test ongeschikt is.

*Een naam is een bewering over het ding, niet het ding.* Identificeer waar je mee werkt aan zijn **inhoud**, niet aan zijn label, tag of type — en tel eerst: `querySelectorAll(<selector>).length` hoort **1** te zijn vóór je er een eigenschap van afleest. Spreken twee onafhankelijke signalen elkaar tegen, dan is die tegenspraak het **alarm**: verklaar hem, of meld beide. Trek een onbevestigde gevolgtrekking nooit door naar zusters "voor de consistentie". En een rail beschermt wie hem leest, niet het script dat hij schreef: een procedure die je committeert telt zélf — pagina, node, variant — of ze telt niet.

*Het meetbereik bevat vaak de meting zelf.* Een `grep -c` op een bestand met zijn eigen format-voorbeeld telt dat mee; een CI-log bevat het script dat hij logt; `$?` na een pipe geeft de status van de láátste pijpcomponent. Anker een telling op het **object**, filter de bron uit de log, en lees een exit-status vóór de pipe: `out=$(cmd); rc=$?`. Bij een bestandsgebaseerde scope: `git status --porcelain` rapporteert een nieuwe map als één regel — gebruik `-uall`, naast `git diff --name-only origin/main...HEAD`.

*Een grep-treffer is niet de entry.* De `Status` van een lus-item staat buiten het venster van een kale `grep -n`. Een groter venster is een nieuwe proxy; anker op de entry:

```bash
awk -v s=open '/^## [0-9]{4}-[0-9]{2}-[0-9]{2}/{h=$0; next}
  /^- \*\*Status:\*\*/{if(h!=""){if($3==s)print h; h=""}}' <bestand>
```

*Een verwachtingswaarde is geen meting.* Een vuistregel, een typische waarde of een aggregaat dat logisch oogt is een **hypothese**, nooit het bewijs dat een empirische vraag afsluit. Wijkt een getal af met precies een ronde factor (×2, ×½, ×60), dan is dat een tel- of eenheidsfout die je meet in plaats van verklaart. Het schaadt het meest in een **keuzevraag**: een ongemeten getal in een `AskUserQuestion`-optie wordt de grond waarop de gebruiker beslist. Zet daar wat je gemeten hebt, of markeer het expliciet als schatting — en kantelt de aanname nadien, bied de keuze dan opnieuw aan.

*Je zekerheid moet dekken wat je werkelijk deed.* Een melding draagt impliciet dat er een tool-call onder zit. Zeg "vermoedelijk" tot je het getoetst hebt, en vink een schrijfactie pas af ná de call die hem uitvoert. Herkenningsteken: een bewering die in dezelfde adem ontstaat én wordt afgevinkt, zonder call ertussen. Is ze betwist, dan is arbitreren tussen tweedehandse lezingen geen verificatie: open de bron of vraag erom — "ik heb het nooit gezien" is een vraag, geen voetnoot. Ongeverifieerd corrigeren in een audit of LEARNINGS vermenigvuldigt hem.

**Het gemeten bewijs achter deze elf staat in de `verify` skill**, als genummerde rails met hun gevallen — welk instrument precies wat verzweeg, en op welk scherm. Die skill is de operationele kant; deze lijst is wat je altijd bij je hebt. Zoek je het waaróm van een rail, of ben je aan het verifiëren, lees hem daar — de invariant-as staat er nu ook.

**Elke app heeft een `## Verify-pad`-sectie in zijn eigen `CLAUDE.md`** — of zegt daar expliciet dat hij er geen heeft. De Beoordeel-stap kan niet elke run het terrein opnieuw ontdekken. De sectie geeft de letterlijke commando's per capability: render vastleggen · flow aandrijven · state forceren · invariant draaien · verse build. **"Geen" is een geldig antwoord en hoort er te staan** — een lege regel laat de vraag terugkomen, het woord "geen" maakt het gat telbaar. Ontbreekt de sectie, dan is dát de eerste bevinding van de run, vóór welk acceptatie-item ook. De `verify` skill heeft de volledige tabel; `.githooks/pre-commit` waarschuwt bij een app zonder sectie.

**Brug naar de eval-loop.** Een gefaalde review die een **terugkerende faalklasse** blootlegt = een `vastleggen`-trigger. De triade is de *feeder* van de trage loop, geen duplicaat. Houd de assen uit elkaar: triade-status (`gepland → gebouwd → gevalideerd`, per taak) staat los van learning-status (`open → verified → promoted`, of `closed` wanneer er niets te harden valt, over sessies heen).

---

## Root cause boven patch — werkprincipe

Bij een probleem, bug of gefaalde check: zoek de onderliggende oorzaak en los díe op, niet enkel het symptoom. Een patch die het zichtbare gedrag maskeert terwijl de oorzaak blijft bestaan, verplaatst het probleem — hij lost het niet op. Dit geldt breed: code, tooling, pipeline, proces.

**De toets — patch of root cause?**
- Kan dezelfde oorzaak elders opnieuw toeslaan? Dan is een lokale fix een patch.
- Fix je het gevolg (de foutmelding, de kapotte output) of de reden waaróm dat gevolg ontstaat?
- Voorbeeld uit deze codebase: bij een kapotte DTCG-build is de root cause een custom format die `token.value` i.p.v. `token.$value` leest — niet de ontbrekende output-waarde die je ook handmatig zou kunnen bijvullen.

**Toets een bewering over een bibliotheek aan de geïnstalleerde bron.** Die staat in `node_modules` — lees hem vóór je een fix bouwt op wat een API "zou moeten" doen. Hoe stelliger de bewering, hoe kleiner de kans dat ze nagekeken is, en een typecheck die slaagt zegt niets over een verkeerd begrepen contract. Dezelfde vorm als de DTCG-valkuil verderop. Dit geldt net zo goed voor je **meetgereedschap**, waar het erger uitpakt: een verkeerd contract in een fix faalt zichtbaar, in een instrument levert het een gevulde, geloofwaardige, verkeerde uitkomst — en een onbekende optie wordt stil genegeerd, in een `.mjs` zonder typecheck die hem afkeurt. Herkenningsteken: een check die eerst groen was en na een tussenliggende meting rood wordt zonder dat de code veranderde, is een uitspraak over het instrument, niet over de code.

**Bouw geen correctie voor een getal dat je niet gemeten hebt.** Een factor, offset of instelling die een meetwaarde bijstelt omdat ze "fout oogt", codificeert de aanname en maakt haar daarna onzichtbaar: elk scherm toont voortaan consistent dezelfde gecorrigeerde waarde, dus niets kan de aanname nog tegenspreken — de patch wist zijn eigen bewijs. Meet eerst waar de waarde vandaan komt. Klopt de aanname niet, dan groeit de kost mee met de aanhang (kolom, migratie, toggle, helper, call-sites) en lekt de correctie naar waarden waar ze semantisch niet hoort — een frequentie-correctie op een teller.

**Een diagnose veroudert; hertoets hem vóór je de fix bouwt.** Bundelt één opdracht meerdere wijzigingen, dan kan de eerste de aanleiding voor de tweede wegnemen — en bouw je een fix voor een toestand die niet meer bestaat. Gemeten op fleet-manager: een afdaling door single-child wrappers om FM/06 meetbaar te maken, terwijl de in diezelfde prompt gevraagde layout-wijziging de kaart alsnog twee kinderen gaf; de fix was overbodig en de tak erin (`stappen < 3`) kon per constructie nooit lopen. Herkenningsteken: twee deelopdrachten in één prompt die hetzelfde bestand of dezelfde structuur raken. Voer dan éérst de wijziging uit die de toestand verandert, en meet daarna opnieuw of het probleem er nog is.

**Verander één ding tegelijk als je een oorzaak zoekt.** Herschrijf je een gefaalde call en werkt de nieuwe versie, dan heb je de oorzaak alleen gevonden als er één verschil was. Gemeten op 2026-08-26: drie wijzigingen in één herschrijving (`·` eruit, `children.filter` → `findAll`, arrow → `function`) bewezen niets over welke het deed — en de aangewezen verdachte bleek onschuldig.

**Een boolean die uit een object komt, is per constructie waar.** `rechts ? 1 : -1`, waar `rechts` de node is die het rechterpaneel draagt: bij de koude start is dat de lege-toestand-node — een object, dus truthy — waardoor het scherm dat "nog geen PV gekozen" heet een geselecteerde rij toonde. Geef de conditie een eigen expliciete parameter (`selIndex`) in plaats van hem uit een naburig object af te leiden. En let op bij een **herbouw**: ik patchte de instantie, herbouwde daarna de sectie omdat de maten niet klopten, en kopieerde dezelfde afleiding onveranderd mee — dezelfde bug een tweede keer in hetzelfde scherm. Een herbouw is de plek om de oorzaak te vervangen, niet om hem over te tikken.

**Een regel die je hardt, toets je op het geval waar de aanname niet geldt.** Generaliseer nooit uit een steekproef die per constructie slaagt. Gemeten: `git merge main` werd als bijwerk-commando naar CLAUDE.md geschreven na drie worktrees die alle drie slaagden — twee daarvan alleen omdat ze hun repo deelden met een tree die main net gepulld had, dus de lokale `main`-ref stond toevallig actueel. In de eerste repo waar main nérgens uitgecheckt was, antwoordde hetzelfde commando *Already up to date* met exit 0 terwijl de tree twee commits achterliep. Zoek vóór het harden dus expliciet het geval dat de aanname zou breken — de repo zonder die branch, de app zonder dat pad, de tree zonder die server. Vind je het niet, benoem de conditie dan ín de regel in plaats van hem weg te laten: een regel propageert naar álle repo's, dus een ongetoetste aanname wordt daar stille schade in plaats van één fout.

**Wanneer een patch tóch mag** — tijdsdruk, een echt lokaal incident, of de root cause zit buiten scope. Dan geldt: benoem het expliciet als patch en maak de oorzaak zichtbaar — een `// TODO:` die naar de root cause wijst, of een `vastleggen`-entry bij een terugkerende faalklasse. Nooit stilzwijgend om een oorzaak heen werken en het als opgelost rapporteren.

**Koppeling met de eval-loop.** Dit principe is de attitude achter de trage loop: een terugkerende faalklasse hoort niet per instantie gepatcht, maar via `vastleggen` → `learnings-verwerken` structureel gehard aan de root (juiste CLAUDE.md-laag of code-guard). De Plan / Bouw / Beoordeel-triade is de per-taak tegenhanger — een gefaalde review los je op bij de oorzaak, niet met een cosmetische fix die de check net doet slagen.

---

## Sessie-reflectie en handoff — werkprincipe

Aan het einde van een substantiële sessie: een kritisch, eerlijk retrospectief dat de vluchtige context vastlegt vóór ze verdampt. Niet vleiend — de waarde zit in wat Claude zelf naar boven haalt: onzekerheden, onuitgesproken aannames, blinde vlekken, breukrisico, de eerste zet voor de volgende keer. Draait via de **`sessie-reflectie` skill**, die de werkwijze en de reflectievragen bevat.

**Router, geen silo** (root cause boven patch). Elke bevinding gaat naar het juiste bestaande huis: terugkerende **faalklasse** → `vastleggen` (LEARNINGS) · **durend feit** over Jeroen/project → auto-memory · **vooruitkijkend & sessie-gebonden** → `HANDOFF.md` · **werk dat blijft liggen** → `BACKLOG.md`. Een fout hoort in LEARNINGS mét zijn verificatie-input, niet in HANDOFF; HANDOFF is enkel het vooruitkijkende restant dat (nog) geen fout is.

Open HANDOFF-items komen bij sessiestart automatisch mee via `session-start-handoff.sh`, samen met de LEARNINGS-entries op `open` en `verified` — zonder die herinnering was de eval-loop de enige lus zonder trigger.

Een HANDOFF-entry legt de **check** vast waarmee je nagaat of het item nog leeft, niet de staat van de code op dat moment. Een staat veroudert stil zodra de code eronder verandert en komt daarna elke ochtend terug als openstaand werk. `.githooks/pre-commit` waarschuwt bij een nieuwe open entry zonder `Check`.

---

## Buiten scope = een backlog-item, geen zin

Laat je iets bewust buiten scope — "gemeld, niet gebouwd" — dan leg je het **op het moment van de melding** vast in de dichtstbijzijnde `BACKLOG.md` (project `apps/{app}/` → klant repo-root → globaal), en je noemt dat pad in je antwoord. Niet aan het einde van de sessie: eindigt die zonder reflectie, dan is het alsnog een zin die wegscrollt. Hetzelfde geldt voor P3-bevindingen uit `ux-audit` en `security-audit` — die heten al "backlog" en horen daar te landen.

Statussen `open → gepland → gebouwd → verworpen`; **`verworpen` vraagt een reden**, anders komt hetzelfde voorstel over drie maanden terug en begint de afweging van nul. Het formaat staat in de kop van `BACKLOG.md`. Grens met de andere twee lussen: een *fout* hoort in LEARNINGS, *sessie-context* in HANDOFF, en werk dat blijft liggen hier. Bij sessiestart wordt het **aantal** open items per laag getoond, niet de lijst — een backlog mag lang worden zonder het signaal onbruikbaar te maken.

**Grep de andere twee lussen vóór je schrijft — óók hun gesloten entries.** Een `resolved` HANDOFF-item verdwijnt uit de sessiestart-hook, dus de sessie erna ziet zijn tegenproef niet meer en kan het feit verkeerd heruitvinden. Gemeten op rowtrack: HANDOFF zette "de node:test-stap draait in CI" op 2026-08-10 op `resolved`, mét tegenproef (PR #256); twaalf dagen later schreef een sessie het BACKLOG-item "de node:test-suites draaien niet in CI". De drie lussen delen geen enkele controle op tegenspraak, dus die controle ben jij: `grep -n -i '<kernwoord>' HANDOFF.md BACKLOG.md LEARNINGS.md` (root én `apps/<app>/`) vóór je een item toevoegt. Een treffer die het tegendeel beweert is geen backlog-item maar een tegenspraak — draai de `Check` van het gesloten item opnieuw en verklaar het verschil vóór je iets schrijft.

---

## Werkprincipes voor code en componenten

**Component structuur**
Strict 1 component = 1 file. Geldt ook voor sub-componenten (CardHeader, CardBody, CardFooter staan elk in hun eigen bestand). Dit zorgt voor een cleane Figma MCP koppeling.

**Naamgeving**
- Components: PascalCase (`Card.tsx`, `FilterBar.tsx`)
- Hooks, utilities, helpers: camelCase (`useFilter.ts`, `formatDate.ts`)
- Folders die één component huisvesten: PascalCase
- Algemene folders: kebab-case (`components/`, `lib/`)

**TypeScript**
- Component props: `type` (niet `interface`)
- Componenten: plain function syntax → `({ x }: Props) => ...` (geen `React.FC`)
- Types staan inline in de component file, tenzij gedeeld door meerdere components — dan apart in `types.ts`
- `any` is niet toegestaan in committed code. In WIP/prototypes mag het tijdelijk, mits TODO comment.

**Folder structuur binnen `components/`**
Standaard set categorieën:

```
components/
├── ui/            (primitives)
├── forms/         (input componenten + form composities)
├── layout/        (header, sidebar, container, grid)
├── feedback/      (toast, alert, empty state, loading, error)
├── navigation/    (tabs, breadcrumbs, menu, pagination)
├── data-display/  (table, list, card, chart)
└── overlay/       (modal, sheet, popover, tooltip)
```

Regels:
- Folders worden aangemaakt zodra er een eerste component voor bestaat (geen lege folders vooraf)
- Bij twijfel over categorisatie: vraag expliciet voor je plaatst

**States zijn default, geen optie**

Voor elk data-gedreven of async component zijn **loading, empty en error** een default onderdeel van de scaffold — niet iets dat pas op vraag toegevoegd wordt. Een component dat bij trage, lege of gefaalde data in een blanco scherm valt, is niet af (de "white screen of death").

De TC-EBC blijft nog steeds vragen *welke* states van toepassing zijn, maar het vertrekpunt keert om: aanwezig, tenzij het component puur presentationeel/statisch is of de briefing ze expliciet uitsluit. Vraag dus welke states afvallen, niet welke erbij moeten. State-componenten horen in `feedback/`.

**Herbruikbaarheid (rule of three + design-system-first)**

Default: rule of three — eerste keer mag inline of project-specifiek, tweede keer extracten en generiek maken, derde keer polishen.

Uitzondering: als een component evident in het design system thuishoort (Button, Input, Card, primitives die overal terugkomen), bouw je het meteen daar (`@columba/ui` of equivalent), niet in app-code.

Bij twijfel of iets in de design system thuishoort: vraag het.

**Acties die altijd eerst moeten worden bevestigd**

1. Bestanden of folders verwijderen
2. Componenten hernoemen of verplaatsen
3. Tokens of design system bestanden wijzigen
4. Nieuwe dependencies installeren (`pnpm add ...`) of bestaande upgraden/downgraden
5. Config bestanden wijzigen (`tsconfig.json`, `next.config.*`, `tailwind.config.*`, `turbo.json`, `package.json` non-trivial wijzigingen)

Voor andere wijzigingen (nieuwe components, refactors binnen één file, bug fixes) hoeft geen toestemming gevraagd te worden — gewoon doen en in de samenvatting noemen wat er gebeurd is.

---

## Git workflow

### Wat mag, zonder vragen
- Read-only: `git status`, `git diff`, `git log`, `git branch`
- Lokaal: `git checkout`, `git checkout -b`, `git pull`, `git add`, `git merge`
- Commits maken op feature branches
- Pushen naar remote (`git push`) — inclusief feature branches die preview deployments triggeren bij Vercel
- Branches aanmaken en verwijderen
- Tags aanmaken en verwijderen
- PR's openen
- Merge naar `main` — mag automatisch, zonder voorafgaande melding. Blijf wel volgens het vaste principe werken: feature branch → PR → merge. Na een geslaagde merge: de feature branch verwijderen (lokaal en remote).

### Wat met melding vooraf
- Na een merge naar `main`: meld kort dat de merge gebeurd is, zodat Jeroen weet dat hij de Vercel production deploy kan triggeren als hij dat wil. (Production blijft handmatig — zie "Wat nooit mag".) Trek daarbij de tree bij waaruit zijn dev-server serveert — zie *Een merge is pas af als de tree die de gebruiker bekijkt erop staat*.

### Wat nooit mag
- Vercel production deployments triggeren. Production blijft handmatig via Jeroen.

### Veiligheidsklep
Commit nooit direct op `main`. Werk altijd op een feature branch. Merges naar main verlopen via een PR of expliciete merge — niet door directe commits op main.

### Branch naming
Format: `<type>/<korte-beschrijving>`

Types:
- `feature/` — nieuwe functionaliteit
- `fix/` — bug fix
- `chore/` — onderhoud, dependencies, config
- `docs/` — documentatie
- `refactor/` — code restructuur zonder gedrag te wijzigen

Voorbeelden:
- `feature/filter-bar`
- `fix/dropdown-zindex`
- `chore/update-deps`

Klantnaam komt **niet** in branchnamen — die zit al in de repo.

### Parallel werk — één tree: de hoofdtree

App-werk gebeurt in de hoofdtree, in `<repo>/apps/<app>`, op een feature branch. Niet in een zusmap `../<repo>-<app>`, niet in een permanente worktree per app. Die conventie ("één app, één worktree") stond hier tot 2026-08-25 en is geschrapt — de meting die haar sloopte, de twee gevallen waarin een tweede tree tóch mag, het bijwerken zonder losse HEAD en wat te doen met een oude zusmap staan in de **`worktree` skill**. Komt er een tweede tree in beeld, lees die eerst; hij hoort altijd **ín de repo** (`.claude/worktrees/`), nooit in `~/Documents`, en nooit permanent.

**Wat de zusmap oploste, blijft echt.** Twee taken tegelijk in één working tree lopen door elkaar — niet soms, gegarandeerd (gemeten 2026-08-07: rowtrack- en cashflow-werk vermengd ondanks nette branches per taak). Een branch scheidt de bestanden op schijf niet: ongetrackt en ongecommit werk reist mee bij elke `checkout`. De remedie is nu discipline mét hooks, in plaats van een tweede tree:

- **Eén taak tegelijk per repo.** Kijk vóór je begint naar drie dingen: `git status --short` (onvastgelegd werk van een ándere taak of sessie), `git rev-parse --abbrev-ref HEAD` (staat HEAD op een feature branch die niet van jou is, dan loopt díe taak nog — een schone tree bewijst niets, de PR staat gewoon open) én **`git stash list`**. Die derde is de plek die de eerste twee níet tonen: een stash is werk dat niet in `status`, niet in `worktree list` en niet in `log` verschijnt, en dus onzichtbaar blijft in elke controle die daarop leunt. Gemeten op 2026-08-27: een routinecontrole vóór een taak in Luminus vond 1 425 regels ongetrackte briefings en audits, maar zag de stash uit augustus niet — die kwam pas boven toen de gebruiker ernaar vroeg. Beide stashes bleken achteraf redundant, maar dat was toeval, niet het resultaat van de controle. Let bij een oude stash op de vorm van het defect: hij hangt aan de commit waarop hij gemaakt is, dus hoe ouder hij is hoe minder zijn inhoud over vandaag zegt — de umanex-apps-stash van april droeg hógere dependency-majors dan wat productie sindsdien draait (`zustand ^5` tegen `^4`, `date-fns ^4` tegen `^3`), zodat toepassen geen herstel maar een blinde upgrade van een draaiende app zou zijn. En een stash die blijft staan terwijl zijn inhoud óók in de tree zit, is de handtekening van `git stash apply` in plaats van `pop`. In al die gevallen begin je er niet stil een tweede naast, en maak je óók niet stil een eigen tree: meld het en laat Jeroen kiezen — om beurten, eerst afronden, of stashen. Is de tree vrij, vertak dan altijd vanaf `origin/main` en nooit vanaf de HEAD die je aantreft: `git fetch -q origin && git checkout -b <type>/<beschrijving> origin/main`. Een branch vanaf andermans HEAD erft diens commits — dat is het mechanisme van 2026-08-07, en beide hooks zwijgen erover (gemeten).
- **Stage per pad, nooit `git add -A`.** Dit is wat het verdwaalde bestand uit de commit houdt. `git stash push -u -- apps/<app>` parkeert de andere taak — mét `-u`, anders blijven haar ongetrackte bestanden staan en veegt een `git add -A` ze alsnog mee (gemeten). `pop` zet alles terug op schijf, dus pas als jouw commit staat.
- **De hooks zijn het vangnet, niet de regel.** `.githooks/commit-msg` blokkeert een app-scope die een andere app raakt; `.githooks/pre-commit` meldt onvastgelegd werk in andere apps. Een niet-app-scope (`chore:`, `feat(tokens):`) mét `git add -A` passeert allebei (gemeten: het vreemde bestand zat gewoon in de commit, exit 0) — daar is stage-per-pad de enige rem. Die melding is het signaal om de andere taak eerst af te ronden — niet om `git worktree add` te doen.

**Serveert een langlopend proces uit de hoofdtree** (cashflow: PM2 op `:3000`, cwd `apps/cashflow`), dan is die tree nu óók de tree waarin je feature branches uitcheckt — de oude zusmap hield die twee uit elkaar, dat moet nu expliciet. Geen `next build` en geen `pm2:rebuild` daar op een feature branch: het eerste breekt de draaiende server (witte pagina, gemeten 2026-08-07), het tweede deployt ongemergde code. Verifieer op een feature branch via de flow-harness op `:3100`, CI of een preview-deploy — niet via de PM2-app; herbouwen doe je op `main` na de merge (zie *De Beoordeel-stap schrijft* en *Een merge is pas af*).

**Werk nooit in andermans tree.** Zit er iemand anders — of een agent — in dezelfde map, blijf er dan af, ook voor "even een branch aanmaken". Een branch die je vanaf andermans HEAD aanmaakt, erft diens werk als vertrekpunt. Voor de hoofdtree van een repo betekent dit: is Jeroen er zelf in bezig, dan is dat een reden om te overleggen, niet om ernaast een eigen tree te beginnen.

**Je eigen sub-agents tellen mee.** Draait er een agent die jíj gestart hebt in je eigen tree, dan is die tree niet meer alleen van jou: hij schrijft scratch-bestanden en haalt een formatter over een bestand dat jouw acceptatielijst ongemoeid verklaarde. Gemeten: zeven `.tmp-*.mjs` en een geherformatteerde `DataTable.tsx` reisden mee in één `git add -A`, en twee van de agents hadden de botsing zélf al in hun eindrapport gemeld — het signaal lag er vóór de commit, ongelezen. Stage per pad zolang er agents lopen, en lees hun rapporten vóór je commit, niet erna.

**Bij het mergen.** Gebruik `gh pr merge --delete-branch` niet zolang er een andere branch in dezelfde tree leeft: die vlag verplaatst HEAD naar een willekeurige andere lokale branch. Check eerst expliciet `main` uit, merge daarna, ruim de branch apart op — en *apart* betekent **pas nadat de server bevestigt dat de PR `MERGED` is**, nooit in dezelfde keten achter de merge aan. Gemeten op 2026-08-25: `gh pr merge 312` werd geweigerd (de checks van de laatste commit liepen nog), de opruimstappen stonden achter een `;` en draaiden gewoon door — lokale én remote branch weg, en het verwijderen van de remote branch sloot PR #312 automatisch; het werk stond alleen nog in de lokale objectstore. Twee dingen beschermen je daar níet tegen, allebei nagemeten in een wegwerp-repo: `| tail -1` achter `gh` geeft de exit-status van `tail` (`$?` = 0 terwijl `gh` 1 gaf), en `git branch -d` weigert niet, want die toetst tegen de **upstream** van de branch en niet tegen `main` — een gepushte, ongemergde branch verdwijnt met enkel `warning: … but not yet merged to HEAD`. De PR-state is de enige gate:

```bash
git checkout main
out=$(gh pr merge <nr> --merge); rc=$?; echo "$out"        # status lezen vóór welke pipe ook
state=$(gh pr view <nr> --json state -q .state)
[ "$rc" -eq 0 ] && [ "$state" = MERGED ] || { echo "STOP — state=$state, niets opruimen"; exit 1; }
git branch -d <branch> && git push origin --delete <branch>
```

Getoetst op béide kanten met een stub-`gh` (2026-08-25): geweigerde merge → beide branches blijven staan; geslaagde merge → beide opgeruimd. Ging het tóch mis: de branch is te herstellen zolang de commit in de objectstore staat (`git branch <naam> <sha>` + push), de PR heropen je met `gh pr reopen <nr>`.

**Een merge is pas af als de tree die de gebruiker bekijkt erop staat.** Merge je vanuit een andere tree dan de hoofdtree — een agent-worktree, een tijdelijke worktree — naar `origin/main`, dan blijft de hoofdtree staan waar hij stond — inclusief de dev-server die daaruit serveert. "Gemerged" rapporteren terwijl zijn scherm de code van vóór je eerste ronde toont is een onwaar statusbericht, en het wordt erger per ronde. Gemeten: zes PR's gemerged vanuit `Luminus-fleet-manager` terwijl de hoofdtree 18 commits achterliep; de gebruiker moest twee screenshots naast elkaar leggen om het te zien. Sluit een merge daarom zo af:
```bash
git -C <repo> worktree list                       # álle trees — werkt zonder poort of draaiend proces
git -C <map> fetch --quiet origin main            # zonder dit meet de volgende regel een lokale cache
git -C <map> rev-list --count HEAD..origin/main   # de echte achterstand
git -C <map> rev-parse --abbrev-ref HEAD          # op main? zo niet: niet pullen, maar overleggen
git -C <map> pull --ff-only origin main
```

`git worktree list` is de vinder, niet `lsof`: een lege `lsof` betekent "geen listener", niet "geen gat" — en een tree op een losse HEAD kan geen `pull --ff-only` aannemen. De `fetch` is niet optioneel: `origin/main` is een lokale ref die alleen door een fetch beweegt, en `gh pr merge` merget server-side, dus zonder fetch meet je 0 terwijl de tree 16 commits achterloopt (gemeten). Wil je weten wélke tree serveert: `PID=$(lsof -t -nP -iTCP:<poort> -sTCP:LISTEN | head -1)`, dan `lsof -a -p "$PID" -d cwd -Fn | sed -n 's/^n//p'` — het `n`-prefix moet eraf vóór je het pad doorgeeft. En een bijgetrokken bron is nog geen bijgetrokken scherm: serveert die map een build (PM2, `next start`), dan hoort de rebuild+restart bij het sluiten (zie *De Beoordeel-stap schrijft*). Eén keer terloops noemen telt niet: een gat dat je meldt maar niet dicht, blijft een gat.

**Twee hooks, zeven signalen.** `.githooks/pre-commit` weigert een commit op `main`/`master` en op een losse HEAD — de veiligheidsklep is daarmee afdwingbaar in plaats van een goed voornemen, en een linked worktree op een losse HEAD kan geen commit stil kwijtraken. Rebase, cherry-pick en een lopende merge laat hij met rust. Daarnaast *waarschuwt* hij (zonder te blokkeren) over vijf dingen: onvastgelegd werk in een ándere app dan deze commit — het signaal om die andere taak eerst af te ronden of te stashen, niet om een tweede tree te maken — een aangeraakte app zonder `## Verify-pad`-sectie, een nieuwe open HANDOFF-entry zonder `Check`-regel, een nieuw `- [x]` zonder `bewijs:` in een `*.tcebc.md`, en een aangeraakte briefing met een Status buiten `gepland → gebouwd → gevalideerd`. `.githooks/commit-msg` blokkeert een commit met een app-scope die een ándere app raakt — `fix(cashflow):` mag niet aan `apps/rowtrack/` komen. Scopes die géén app zijn (`chore:`, `feat(tokens):`, `refactor(config):`) blijven vrij: een gedeelde laag hoort in één commit met de apps die hij aanpast. Is een cross-app commit écht bedoeld, zet dan een `Cross-app: <reden>` trailer in de body — expliciet en greppable. `--no-verify` is de slechtere weg: dat slaat álle hooks over, ook de snapshot- en token-sync.

### Cross-repo review — normaliseer eerst naar main

Voor élke cross-repo inventarisatie of code review: bepaal per repo eerst `git -C <repo> rev-parse --abbrev-ref HEAD`. Staat een repo NIET op main, dan is de uitgecheckte werkkopie geen canonieke bron — normaliseer eerst (`git -C <repo> checkout main && git -C <repo> pull`; in een **worktree** faalt die checkout — gebruik daar `git -C <map> fetch -q origin && git -C <map> merge origin/main`, zie de `worktree` skill). Neem daarbij `origin/main` en niet `main`: de lokale `main`-ref beweegt alleen wanneer main érgens uitgecheckt en gepulld wordt, dus in een repo waar je enkel op feature branches werkt veroudert hij stil en antwoordt `git merge main` *Already up to date* terwijl je achterloopt (gemeten in Columba: lokale `main` op `234ebfd`, `origin/main` op `3959453`, merge zonder effect) of, als checkout niet wenselijk is, vergelijk expliciet tegen `origin/main` en flag elke afwijking. Dit geldt óók voor umanex-os zelf: rapporteer nooit content van een feature-branch (incl. nog-niet-gemergede skills of uncommitted wijzigingen) als bestaand systeemonderdeel zonder te markeren dat die nog niet op main staat. Behandel nooit een toevallig uitgecheckte staat als de waarheid.

### Commit messages
Format: Conventional Commits in het Engels.

```
<type>[optional scope]: <description>

[optional body]
```

Body toevoegen wanneer:
- de wijziging niet evident is uit de subject alleen
- er een breaking change is
- er context is over *waarom* dit zo gebeurde (niet *wat*)

### PR descriptions
Bij het openen van een PR: default sectie is alleen "Wat" (korte beschrijving van wat dit toevoegt of wijzigt). "Waarom" of "Hoe te testen" toevoegen als de wijziging dat verdient. Bij twijfel: alleen "Wat".

---

## Wanneer vragen om context

**Default houding bij ambiguïteit**
Doen + alternatieven tonen. Maak je beste keuze op basis van project-context, voer uit, en vermeld in de samenvatting welke alternatieven je overwogen hebt. Jeroen wijzigt achteraf indien nodig.

Uitzondering: TC-EBC kritische items en "altijd vragen" acties blijven vraag-waardig.

**Wanneer *niet* vragen — gewoon doen**
- Variabele- en functienamen kiezen
- Folder structuur binnen een component (waar een helper file staat)
- Welke ShadCN/UI primitive gebruiken voor een gekend pattern
- Comment style in code (eenregelig vs multi-line)
- Volgorde van imports
- Welke hook signature kiezen (return tuple vs object)
- Of een type union of enum gebruiken
- Of een useMemo of useCallback toevoegen voor performance

**Styling beslissingen**
Leid af uit project-context (bestaande tokens, andere componenten in dezelfde folder, design system referenties). Als er geen referentie is, vraag voor je kiest.

**Icoonset**
Wordt vastgelegd in de klant- of project-CLAUDE.md. Globaal: gebruik wat in de klant- of projectcontext is vastgelegd. Als er niets is, vraag.

**Hoe meerdere vragen presenteren**
Gegroepeerd per onderwerp. Eén vraag = gewoon stellen. Meerdere vragen die samenhangen = gegroepeerd in één bericht. Vragen die over verschillende onderwerpen gaan = aparte berichten of duidelijk gegroepeerd.

**"Do as you see fit"**
Wanneer Jeroen carte blanche geeft, beslis je autonoom — *behalve* voor TC-EBC kritische items (component-typologie, states, interactie, edge cases) en de "altijd eerst bevestigen" acties (verwijderen, hernoemen, design system wijzigen, dependencies installeren, config wijzigen). Die rails staan er niet voor niets.

Geef achteraf een samenvatting van genomen beslissingen en alternatieven die je overwogen hebt.

---

## Figma, design tokens en bestand-referenties

**Referenties in taal.** Figma-nodes: in chat alleen de naam ("de FilterCard"); in TC-EBC's, PR's en commits naam + klikbare URL. Tokens: altijd het token path in Tokens Studio-notatie (`color.primary.500`), ook in chat, briefings en rationale — dat path is bron-van-waarheid-neutraal en werkt in Figma, JSON, CSS variables én Tailwind. In code vertaal je wél naar de implementatie. Bestanden en code-locaties: **altijd vol pad vanaf project root** (`apps/enviro/src/components/forms/FilterBar.tsx`, regel 42) — in monorepos bestaat dezelfde filename in meerdere apps.

**Alleen token-mapping, geen hardcoded values.** Werk uitsluitend met de mapping uit `tokens.json`. Losse hex-kleuren, pixel-spacings, font-sizes, radii of shadows die niet uit een token komen horen niet in committed code — en hetzelfde geldt in Figma: een `fills`-waarde zonder variable binding is het equivalent van hardcoded hex. Heeft een benodigde waarde geen token: **eerst vragen** of er één bij moet, niet stilzwijgend hardcoden. **En een Figma-variabele telt daarbij niet als token.** Een variabele aanmaken voor een waarde die nergens in `tokens.json` staat, verplaatst het hardcoded getal van de node naar de variabele: de binding-check wordt groen terwijl de waarde nog altijd uit niets komt, en Figma wordt een tweede bron van waarheid. Gemeten op de umanex Component library (2026-08-25): collectie `Theme` mapt 43/43 op `packages/tokens/tokens.json`, collectie `Base` 1/21 — dertien `spacing-*`, vier `radius-*`, `border-1/2` en `icon-stroke` bestaan alleen in Figma, met de Tailwind-default als stille bron. *Eerst vragen* geldt dus één laag dieper ook; een variabele die je op verzoek toch aanmaakt is een gap met een `BACKLOG.md`-item, geen oplossing. Vergelijk daarbij op het **pad**, niet op de naam: de Figma-naam plakt de tokengroep met een koppelteken (`finance-positive` ↔ `Semantic/light/finance/positive`), dus een naïeve bladnaam-match onderrapporteert — 36/43 waar het er 43/43 zijn. In WIP mag het tijdelijk, mits `// TODO:` die naar de ontbrekende token verwijst.

Haal vóór design- of token-werk de meest recente `tokens.json` op (`git pull` van de tokens-bron op de actieve branch). Welke repo en welk pad die bron is, staat in de klant- of project-CLAUDE.md; bij twijfel vragen.

**Token-formaat: W3C DTCG** — elke leaf gebruikt `$value` + `$type`, niet de Tokens Studio classic `value`/`type`. In Tokens Studio is dat de export-instelling "Convert to W3C DTCG format". Alle apps volgen dit; het is wat `sync-tokens.js` en de Style Dictionary v4-pipeline verwachten. Een classic-format `tokens.json` geeft 0 tokens.

**Build-valkuil (DTCG).** Een custom Style Dictionary format of transform leest **`token.$value`** (fallback `?? token.value`), nooit enkel `token.value` — bij DTCG landt de waarde op `$value`. Een custom format dat `token.value` leest produceert **stil `undefined`**: de build slaagt zónder error, de output is kapot. Built-in formats (`css/variables`) handelen DTCG zelf af; enkel custom formats zijn de val. Verifieer een DTCG-build dus door te herbouwen en de output op echte waarden te checken, niet op een geslaagde exit.

**Referentie-schermen.** Bestaat er een `reference/`-map (in monorepos `apps/{app}/reference/`), lees de relevante schermen dan vóór je bouwt of audit — bij een TC-EBC, in `nieuw-component`, bij `ux-audit`. Dat is vastgelegd referentiebeeld: geen token-bron, geen Figma-vervanger, en niet te verwarren met `public/images/` (runtime-assets).

**MCP-keuze.** Figma Console MCP (Desktop Bridge) is primair voor **alle** Figma-operaties, lezen én schrijven — geen lees/schrijf-split. Native Figma MCP is **fallback-only**: nooit de aangewezen tool, uitsluitend wanneer de Bridge niet beschikbaar is én de gebruiker daar expliciet voor kiest. **Code Connect wordt niet gebruikt**, noch native, noch via Console — stel geen mappings voor.

Start elke Figma-operatie met `figma_get_status`. Bridge niet actief → vraag *"Wil je Desktop Bridge activeren, of overschakelen naar native MCP?"*, wacht op antwoord, ga **nooit** stilzwijgend over naar native. Noem bij elke Figma-stap expliciet welke MCP je gebruikt.

**Valideer je eigen edits op de runtime, niet op de cloud.** De Figma-tools vallen in twee klassen. **REST/cloud** — `figma_take_screenshot`, `figma_get_component_image`, `figma_get_component_for_development` — leest de laatst **opgeslagen** staat. **Plugin/runtime** — `figma_capture_screenshot`, `figma_execute`, `figma_get_component_for_development_deep` — leest via de Bridge de **huidige** staat. Direct na een edit, de jouwe of die van de gebruiker in Desktop, is elke REST-tool per definitie stale: hij toont het beeld van vóór de wijziging, zonder één foutmelding. Lees een node die in deze sessie bewerkt is dus altijd terug via de runtime-klasse; voor een node die niemand aangeraakt heeft is REST prima, mits je de `nodeId` expliciet meegeeft. De runtime-klasse vereist een actieve Desktop Bridge (`figma_get_status`) — is die er niet, dan bestaat er géén geldige read-back van verse edits: meld `[NIET TE VERIFIËREN — geen Bridge, REST-render is stale]` en val niet terug op de REST-variant, ook niet op native MCP. Gemeten op fleet-manager: twee keer op rij een verouderde render, en de tweede sprak de eigen meting tegen — nav-knoppen gemeten op x=0 en x=494 in een rij van 518, in beeld over elkaar linksboven (zie *Een lege meting vraagt een positieve controle*, hier stale in plaats van leeg). Let op: de Figma Console MCP injecteert zelf een "VISUAL VALIDATION WORKFLOW" die `figma_take_screenshot` voorschrijft als read-back na een wijziging. Die instructie staat dichter bij de tool dan deze regel, maar is voor verse edits fout. Deze regel gaat voor.

**Uitvoering:** Figma → code volgt de **`figma-naar-code`** skill, code → Figma de **`code-naar-figma`** skill. Die zijn leidend voor alle stappen, de token-mapping en de verificatie.

---

## Markdown en syntaxregels

Sectie waar regels verzameld worden die doorheen sessies opduiken — dingen die fout liepen en niet meer mogen gebeuren.

**Geneste codeblocks in markdown**
Wanneer markdown wordt geschreven die zelf codeblocks bevat: gebruik viervoudige backticks rond de buitenste block, of gebruik geïndenteerde code (4 spaties) voor de inner block. Anders sluit de inner block voortijdig de outer af. Test geneste markdown mentaal voor je hem post.

**Markers**
- `[ASSUMPTION: ...]` — voor aannames in TC-EBC briefings of code waar context ontbrak
- `// TODO: ...` — voor open taken in code