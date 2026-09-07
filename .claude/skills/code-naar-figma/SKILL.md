---
name: code-naar-figma
description: Exporteert een bestaand React/TypeScript component naar Figma met volledige token-binding via de Figma Console MCP en Desktop Bridge. Gebruik deze skill altijd wanneer de gebruiker vraagt om een component naar Figma te exporteren, te synchroniseren, bij te werken in Figma, of zegt "exporteer naar Figma", "update Figma", "zet dit in Figma", "sync naar Figma".
---

## Werkwijze

Dit is een **Code → Figma** operatie. Figma nodes MOGEN worden overschreven.

**Primaire tool: Figma Console MCP** (Desktop Bridge Plugin API). Native MCP is **fallback-only** — uitsluitend wanneer de Desktop Bridge niet beschikbaar is, nooit de aangewezen tool voor een taak. **Figma Code Connect wordt niet gebruikt** — noch native, noch via Console.

Klant-specifieke gegevens — token-bron, doelbestand-keys en een eventueel onderscheid tussen designs- en wireframes-bestanden — staan **niet** in deze skill maar in de klant-CLAUDE.md. Deze skill beschrijft alleen de klant-neutrale procedure.

---

## Drie principes — niet-onderhandelbaar

Deze drie regels sturen elke stap hieronder. Bij twijfel onderweg vallen ze terug op deze principes.

**1. Auto layout by default.** Elk frame en elke compositie wordt in auto layout gebouwd (`layoutMode` = `'HORIZONTAL'` of `'VERTICAL'`). Absolute positionering (vaste `x`/`y` op children) gebruik je *uitsluitend* waar auto layout structureel niet kan — en dat is zeldzaam. De default is altijd auto layout, niet de uitzondering.

**2. Tokens-first — nul hardcoded waarden.** Elke kleur, spacing, radius en effect bindt aan een Figma variable of style. Een ontbrekende variable is een **gap** die je oplost (`figma_import_library_variable` of `figma_create_variable`) of rapporteert aan de gebruiker — nooit een excuus om een raw hex- of getalwaarde te hardcoden.

**En een variabele is geen ontsnapping aan het token-probleem.** Bestaat er een `tokens.json` (pad in de klant-CLAUDE.md), dan moet élke Figma-variabele die je aanmaakt of bindt daar een tegenhanger in hebben. Een variabele aanmaken voor een waarde die nergens in de token-bron staat, verplaatst het hardcoded getal enkel van de node naar de variabele en maakt Figma een **tweede bron van waarheid** naast `tokens.json` — de gate meldt groen terwijl de drift een laag dieper zit. Gemeten op de umanex Component library (2026-08-25): collectie `Theme` mapt 43/43 op `packages/tokens/tokens.json`, collectie `Base` **1/21** — dertien `spacing-*`, vier `radius-*`, `border-1/2` en `icon-stroke` bestaan alleen in Figma, met de Tailwind-default als stille bron. CLAUDE.md is hier al duidelijk over (*Alleen token-mapping, geen hardcoded values*): heeft een benodigde waarde geen token, **vraag eerst** of er één bij moet. Bouw je op verzoek toch door zonder token, dan is dat een gap die je rapporteert én als item in de dichtstbijzijnde `BACKLOG.md` zet — nooit stilzwijgend.

**3. Transcriptie, geen benadering.** Elke afmeting, spacing-stap en structuurkeuze komt **uit de component-code**, niet uit een eigen layoutoordeel. Principe 2 verbiedt de *rauwe* waarde; dit principe verbiedt de *verzonnen* waarde — een frame dat netjes aan `spacing/4` bindt is 100% token-conform én alsnog fout als de code `spacing/8` zegt. Gemeten op Columba verkeersanalyse (2026-08-26): sidebar op 240px waar `Sidebar.tsx` `w-[304px]` zegt · sidebar-padding gebonden aan `spacing/4` waar de code `spacing/8` bindt · rijen onderling `spacing/4` waar `PvLijst` de `<ul>` op `spacing/1` zet · zelfgetekende ellipsen van 8px als statusmerk waar de code `ColumbaIcon` van 20px (`spacing/5`) rendert · paneel-padding vrij gekozen waar `SidePanel` 32/24 hardcodeert. **Geen enkele gate ving dit**, en dat is structureel: stap 7 toetst of er een binding *is*, en stap 8 toetst de write tegen de **bedoeld**-set — maar "bedoeld" kwam uit mijn eigen keuze in plaats van uit de code, dus de diff was per constructie groen. Lees daarom de maten uit de bron **vóór** je bouwt (`grep -nE '(padding|gap|borderRadius|fontSize|width):' <bronbestanden>`, plus de Tailwind-klassen: `grep -n 'w-\[' …`), noteer ze per scherm, en gebruik díe lijst als de bedoeld-kant van stap 8. Wijk je bewust af, meld het — een stille benadering is een tweede bron van waarheid, precies zoals een variabele zonder token.

**Principes 1 en 2 hangen samen.** Spacing-tokens (`paddingTop`, `itemSpacing`, …) kunnen *alleen* binden op een auto-layout frame. Een frame zonder auto layout breekt spacing-token-binding stil: de waarde wordt dan een raw getal in plaats van een binding. Auto layout is daarom geen losse stijlkeuze maar een **voorwaarde** voor principe 2. Geen auto layout → geen optimale token-mapping.

Een geslaagde export (zie stap 7 en 8) voldoet aan alle drie: 100% van de token-waarden gebonden, auto layout op alle composietframes, en elke maat en structuur teruggelezen uit de code — én elke binding matcht het token dat de code bedoelde (de parity-gate, stap 8).

---

### Stap 1 — Desktop Bridge check

Verifieer dat de Desktop Bridge plugin actief is:

```
figma_get_status
```

- Actief → ga verder
- Niet actief → stop. Vraag: "Wil je de Figma Desktop Bridge activeren, of overschakelen naar native MCP?" — wacht op antwoord, ga nooit stilzwijgend verder.
- **Meerdere bestanden verbonden?** De actieve file kan stil terugwisselen (reconnects). Assert het doelbestand in élke `figma_execute` — zeker vóór schrijfacties; een write in het verkeerde klantbestand is de duurste stille fout van deze skill (les 2026-08-18). Toets op **identiteit, niet op naam**: `figma.fileKey` (de key uit de URL van het doelbestand, `figma.com/design/<fileKey>/…`), niet `figma.root.name`. Een naam is een bewering die iemand ooit typte — gemeten op 2026-08-25 aan béide kanten: de gebruiker hernoemde het bestand in Desktop en de naam-assert blokkeerde de export van het júiste bestand (vals alarm), en het spiegelbeeld is duurder — twee klantbestanden mogen dezelfde naam dragen, dan zwijgt de naam-assert terwijl de write in het verkeerde bestand landt. Het skelet staat in stap 6.

---

### Stap 2 — Bepaal doelbestand (en fase, indien van toepassing)

Bepaal naar welk Figma-bestand de component gaat. De beschikbare bestanden en hun keys staan in de klant-CLAUDE.md. Noteer de **fileKey** — dat is de `DOELKEY` van de bestandsguard (stap 1 en het skelet in stap 6), en de identiteit van het bestand; `DOELBESTAND` is enkel de naam, die dient als noodrem wanneer `figma.fileKey` leeg blijft.

Sommige klanten onderscheiden **designs** van **wireframes** (zie klant-CLAUDE.md). Als dat zo is, vraag of leid af welk van de twee het doel is, want het gevolg verschilt:

| Doel | Gevolg |
|---|---|
| Design-bestand | Volledige token-binding vereist; design library als variabelen-bron |
| Wireframe-bestand | Wireframe-library componenten gebruiken; token-binding optioneel |

Maakt de klant geen onderscheid → sla deze afweging over en ga door.

---

### Stap 3 — Variabelen ophalen + token-bron lezen

Haal de Figma-variabelen op en lees de token-bron. De token-bron verschilt per klant (zie klant-CLAUDE.md):

```
figma_get_variables (huidige Figma file)
```

- **Klant met lokale token-pipeline** → lees ook de lokale token-bron (pad in klant-CLAUDE.md, bv. `packages/tokens/build/variables.css` of `tokens.json`).
- **Klant zonder lokale tokens** → haal de variabelen uitsluitend uit de Figma library op (`figma_get_library_variables`, library-key in klant-CLAUDE.md).

Doel: alle beschikbare variabelen in beeld hebben vóór de execute.

---

### Stap 4 — Lookup bouwen + gap-analyse

Bouw een mapping van token path → Figma variable ID op basis van stap 3.

Controleer voor élk token dat in de component gebruikt wordt:
- Bestaat de Figma variable al? → gebruik de ID
- Ontbreekt de variable?
  - Is hij beschikbaar in een library? → `figma_import_library_variable` vóór execute
  - Bestaat hij nergens als Figma-variabele, maar **wél in de token-bron**? → maak hem aan (`figma_create_variable`) met het token-path als naam. Dit is de enige route waarop aanmaken zonder overleg mag.
  - Staat de waarde **nergens in de token-bron**? → niet aanmaken op eigen gezag. Meld de gap en vraag of er een token bij moet. Zegt de gebruiker "bouw door", dan komt de variabele er mét een `BACKLOG.md`-item dat de ontbrekende as benoemt — anders is de as onvindbaar zodra de export klaar is (gemeten: de `Base`-collectie van de umanex Component library, 20 variabelen zonder token-bron).

Doe dit volledig vóór de execute — een ontbrekende binding halverwege de execute breekt de token-integriteit (principe 2).

---

### Stap 4b — Design-system-first: instantieer bestaande componenten

Vóór je in `figma_execute` iets met `figma.createFrame()` opbouwt: check of het element overeenkomt met een **bestaande component** in het doelbestand of de design-library (`figma_search_components`, of de library-componenten uit de klant-CLAUDE.md). Zo ja → **instantieer die component** (kloon een bestaande instance, of `createInstance` vanaf de main component) i.p.v. een frame na te bouwen.

Dit is de code→Figma-tegenhanger van de duplicaat-preventie in `figma-naar-code` (stap 3): daar hergebruik je bestaande *code*-componenten, hier bestaande *Figma*-componenten.

Waarom een handgemaakt frame fout is:
- Het matcht de design-system-component niet — je mist de tokens, states/variants en sub-elementen (bv. het pijl-icoon van een `Primary` button).
- Een verse `figma.createFrame()` is 100×100 met **FIXED** sizing; enkel `layoutMode` zetten hugt de counter-as niet → de "knop" blijft 100px hoog (met een radius-token een vette ovaal).

**Concludeer "geen library verbonden" nooit uit de variabelen-query.** `getAvailableLibraryVariableCollectionsAsync()` somt **variabele**-collecties op en toont component-libraries per definitie niet — een lege uitkomst daar zegt niets over de iconen- of componentenbibliotheek. Gemeten op 2026-08-26: op grond van die query meldde ik "geen Columba.Icons-library verbonden", waarna een scan op bestaande instances in hetzelfde bestand prompt de sets `Actions` (met `Icon=Check`, `Icon=Edit`, `Icon=Locked`, `Icon=Hide`), `UI`, `Arrows`, `Button/Default` en `Logo` vond — precies wat deze stap voorschrijft te instantiëren. Gebruik `figma_search_components` én een scan op reeds geplaatste instances (`findAll` op `type === 'INSTANCE'` → `getMainComponentAsync()`) vóór je besluit dat er niets is.

Alleen wanneer er géén passende bestaande component is, bouw je een nieuw frame — dan gelden de auto-layout-regels van stap 5 onverkort.

---

### Stap 5 — figma_execute

Bouw en schrijf de component. Twee dingen staan voorop: de structuur is auto layout (principe 1), en alle waarden binden via tokens (principe 2) — nooit hardcoded.

#### Structuur: auto layout eerst

Bouw elk frame in auto layout. Stel `layoutMode` altijd expliciet in vóór je children toevoegt. Dit is geen optionele afwerking — het is de voorwaarde waarop spacing-tokens kunnen binden (`itemSpacing`, `padding*`). Een frame zonder auto layout kan die tokens niet dragen.

Structureel in te stellen:
- `layoutMode` — `'HORIZONTAL'` of `'VERTICAL'` (altijd; dit is de auto-layout-schakelaar)
- `primaryAxisAlignItems`, `counterAxisAlignItems` — uitlijning langs beide assen
- `primaryAxisSizingMode`, `counterAxisSizingMode` — `'AUTO'` (HUG) of `'FIXED'`

**Auto-layout gotcha's — kritiek, in deze volgorde:**
- `layoutSizingHorizontal = 'FILL'` op een child moet worden ingesteld **ná** `parent.appendChild(child)` — daarvóór heeft het geen effect (parent kent het kind nog niet).
- `primaryAxisSizingMode = 'AUTO'` wordt overschreven door `resize()` → stel het opnieuw in **ná** de resize-call.
- `layoutSizingVertical = 'HUG'` expliciet zetten op een frame in een auto-layout parent voorkomt dat het de volledige hoogte vult.
- Een verse `figma.createFrame()` start op 100×100 met **FIXED** sizing; enkel `layoutMode` zetten hugt de inhoud niet — zet expliciet `counterAxisSizingMode = 'AUTO'` (en waar nodig `primaryAxisSizingMode = 'AUTO'`) **ná** `layoutMode`, anders houdt het frame zijn 100px. (Zie stap 4b: bij een bestaande DS-component instantiëren i.p.v. dit hand-frame vermijdt dit probleem sowieso.)
- **Kolombreedtes verdeel je uit een budget dat de padding meetelt:** `budget = container.width − padLeft − padRight − (n−1)·gap`. Zonder de padding-term verdeel je te veel, valt de laatste kolom buiten het frame en slaagt de build zonder error — dezelfde klasse als de DTCG-`$value`-val (geslaagde exit, kapotte output). Assert de som van de kolombreedtes tegen het budget vóór je resiz't, en bewijs na afloop geometrisch dat `lastChild.x + lastChild.width ≤ container.width`. Die assert ving op fleet-manager twee echte mismatches vóór ze schade deden (Luminus, 2026-08-17).
- **Een kloppend kolombudget zegt niets over de cel.** De budget-assert hierboven dekt
  *container*-overloop; *cel*-overloop is een aparte klasse. Gemeten in Luminus
  `fleet-manager` (2026-09-04): acht kolommen proportioneel gekrompen om een checkbox in te
  passen, som exact 1000 zoals FM/10, assert groen — en `Order number` droeg 94px tekst in een
  cel van 84, dus de kop liep in de buurkolom. Alleen de runtime-screenshot toonde het. Toets
  daarom ná elke kolombreedte-wijziging per cel dat de breedste tekstnode past, over kop én
  rijen: `cell.findAll(n => n.type === 'TEXT')` → `max(ceil(width)) ≤ cell.width`. Een
  proportionele krimp raakt de smalste kolom het hardst, en dat is meestal de kolom met het
  langste label ten opzichte van zijn inhoud — verplaats breedte vanuit een kolom met speling.
- **"Geen wees-nodes" is niet hetzelfde als "geen dubbele nodes".** Een opruimcheck die naar
  *lege* frames en losse restanten zoekt, ziet een blok dat twee keer is aangemaakt niet: geen
  van die nodes is leeg, ze zijn allemaal gevuld en kloppen op zichzelf. Tel daarom bij
  oplevering de **voorkomens van dragende blokken** — sectiekoppen, threads, invoervelden,
  actieknoppen — en eis er precies één; en behandel een frame dat veel hoger is dan zijn
  inhoud vraagt als bevinding in plaats van als gegeven. Gemeten in Luminus `fleet-manager`
  (2026-08-19): `FM/15 Ticket Detail & Reply` droeg zijn hele onderste helft dubbel — twee
  keer "Conversation", twee identieke threads, twee antwoordvelden, twee Send-knoppen, plus
  drie dubbele detailregels. Het frame was 1922px waar 1158 volstond; die hoogte stond in de
  eigen meetuitkomst en is als gegeven gelezen in plaats van als signaal. De acceptatieregel
  "geen wees-nodes van gefaalde pogingen" was afgevinkt en had gelijk — hij meette alleen iets
  anders dan wat er mis was.
- **Kloon vóór je verwijdert.** `node.clone()` op een kind van een net verwijderde parent gooit ("node does not exist") en laat het script halverwege sterven. Volgorde: eerst de prototype-node naar een variabele klonen, dán pas de oude children/container verwijderen. En faalt een run halverwege: ruim de partiële artefacten (een leeg 100×100-frame) op vóór de retry — de idempotentie-check van "Bestaande node afhandelen" hieronder matcht er anders stil op en bouwt voort op een wees (Luminus fleet-manager, 2026-08-17).

#### Bestaande node afhandelen

```javascript
const existing = figma.currentPage.findOne(n => n.name === 'ComponentNaam')
const x = existing?.x ?? 154
const y = existing?.y ?? 200
if (existing) existing.remove()
```

#### Token bindings — volledig patroon

Gebruik uitsluitend `setBoundVariable` (en de paint-/style-equivalenten) voor alle waarden die via tokens zijn gedefinieerd. Een waarde die je hardcodet is per definitie een gap (principe 2).

```javascript
const allVars = await figma.variables.getLocalVariablesAsync()
const fv = name => allVars.find(v => v.name === name)

// Fills (kleur)
const bindFill = (node, variable) => {
  if (!variable) { console.warn(`Variable not found`); return }
  node.fills = [figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:0,g:0,b:0}}, 'color', variable)]
}

// Spacing / padding / itemSpacing (numerieke waarden) — vereist auto layout op de node
const bindNum = (node, prop, variable) => {
  if (!variable) { console.warn(`Variable not found`); return }
  node.setBoundVariable(prop, variable)
}

// ⚠️ cornerRadius: 'cornerRadius' is GEEN geldig veld voor setBoundVariable.
// Bind altijd de vier hoeken afzonderlijk:
const bindRadius = (node, variable) => {
  if (!variable) return
  node.setBoundVariable('topLeftRadius', variable)
  node.setBoundVariable('topRightRadius', variable)
  node.setBoundVariable('bottomLeftRadius', variable)
  node.setBoundVariable('bottomRightRadius', variable)
}
```

**Wat gebonden moet worden — geen uitzonderingen:**
- Fills: alle achtergrond-, border- en tekstkleuren via `setBoundVariableForPaint`
- Spacing: `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `itemSpacing` via `setBoundVariable` (alleen mogelijk op auto-layout frames)
- Radius: **nooit `cornerRadius`** — altijd de vier hoeken afzonderlijk: `topLeftRadius`, `topRightRadius`, `bottomLeftRadius`, `bottomRightRadius` via `setBoundVariable`
- Typography: text styles koppelen via `setRangeTextStyleId` of de style ID direct toewijzen
- Effect styles: shadow/blur via `setEffectStyleId`
- Component variants: states (default/hover/active/disabled/error) als aparte frames in een component set, gegroepeerd in een parent frame — ook die parent in auto layout

**Kritieke Figma Plugin API gotcha's (algemeen):**
- Gebruik altijd de async versies: `figma.variables.getLocalVariablesAsync()`, `figma.setCurrentPageAsync(page)`

**Variabele niet gevonden tijdens execute?**
Gebruik `figma_get_variables` opnieuw (andere scope of collection) vóór je de binding overslaat. Sla nooit zomaar over — een overgeslagen binding is een hardcoded waarde, en dat is precies wat principe 2 verbiedt.

---

### Stap 6 — Visuele check

```
figma_capture_screenshot
```

**Captureer per scherm, met de `nodeId` van dat ene scherm.** Eén capture van een hele sectie telt **niet** als visuele check: de plugin cápt de effectieve schaal automatisch zodat de langste zijde onder de 1568px blijft (het AI-vision-plafond), en doet dat stilzwijgend — gemeten op 2026-08-26 tot **0,22×**, waar tekst een grijze streep is en geen enkele afwijking zichtbaar kán zijn.

Let op: **`scale` verhogen lost dit niet op.** Die cap staat ná je scale-parameter, dus een brede sectie wordt teruggeschaald wat je ook meegeeft. De enige remedie is het **meetbereik verkleinen**: geef de `nodeId` van het losse scherm mee. Een scherm van 1440×900 past onder het plafond en komt dus onverkleind binnen; is één frame op zichzelf al te groot, capture het dan in stukken. Nooit een overzichts-thumbnail als bewijs.

Dit dubbelt stap 7 niet, het dekt wat stap 7 per definitie niet kan: **een structurele gate meet of properties bestaan en waaraan ze hangen, nooit wat er op het scherm staat.** Dezelfde export die dit opleverde gaf 672 nodes, nul ongebonden fills/strokes/fontSizes en nul frames zonder auto-layout — groen op elke as — terwijl de onverkleinde capture per scherm meteen drie dingen toonde die geen gate raakt: de actiebalk van het paneel viel buiten de 900px terwijl `SidePanel` hem als `footer` búiten het scrollgebied zet (dus altijd zichtbaar hoort te zijn) · elke `ZebraRij` zónder waarde kreeg een labelbreedte van 124px terwijl de code `width: value != null ? "124px" : undefined` zegt, waardoor "Geen geregistreerd" over twee regels brak · op het 880px-scherm kneep de PV-lijst tot ~250px en brak elk PV-nummer over twee regels.

Controleer: uitlijning, spacing, proporties, visuele balans — en of elk element dat de code altijd zichtbaar houdt, ook werkelijk binnen het frame valt. Max 3 iteraties (execute → screenshot → fix). Bij structurele issues: ga terug naar stap 5.

**Niet `figma_take_screenshot`** — die leest via REST de laatst *opgeslagen* cloud-staat en toont dus het beeld van vóór je `figma_execute` uit stap 5, zonder foutmelding. Zie *Valideer je eigen edits op de runtime, niet op de cloud* in CLAUDE.md.

---

### Stap 7 — Verificatie: de export-gate

Dit is een echte gate, geen zachte check. De export is pas geslaagd als aan **beide** principes voldaan is.

```
figma_get_component_for_development_deep
```

**Pass-conditie — alle punten moeten kloppen:**
- 100% van de kleur-, spacing- en radius-waarden is gebonden aan een variable — geen enkele property met een design token als bedoelde waarde staat als raw getal of hex-code
- Typography is gekoppeld aan text styles
- Effect styles zijn gebonden
- Alle composietframes staan in auto layout (`layoutMode` ≠ `'NONE'`), behalve waar absolute positionering structureel noodzakelijk was
- Elke variabele die deze export aanmaakte of bond, heeft een tegenhanger in de token-bron — bestaat er een `tokens.json`, dan is een variabele zonder token-pad een **gap, geen oplossing**. Toets op het pad, niet op de naam alleen: de Figma-naam plakt de tokengroep met een koppelteken (`finance-positive` ↔ `Semantic/light/finance/positive`), dus normaliseer vóór je vergelijkt — een naïeve bladnaam-match gaf 36/43 waar het er 43/43 waren.

**De token-dekkings-check — draai hem, herleid hem niet.** De normalisatie is de plek waar deze meting fout gaat: een naïeve bladnaam-match gaf 36/43 waar het er 43/43 waren, omdat de Figma-naam de tokengroep met een koppelteken plakt. Herschrijf hem daarom niet per sessie — er staat een getoetst script klaar.

Stap 1, de dump (read-only, ná de bestandsguard):

```javascript
const cols = await figma.variables.getLocalVariableCollectionsAsync()
const vars = await figma.variables.getLocalVariablesAsync()
const uit = {}
for (const v of vars) (uit[cols.find(c => c.id === v.variableCollectionId)?.name || '?'] ??= []).push(v.name)
return uit                       // {"Theme":["primary",…],"Base":["radius",…]}
```

Stap 2, de vergelijking — schrijf de dump naar een bestand en draai:

```bash
node <repo>/templates/figma-token-coverage.mjs --tokens=<pad/tokens.json> --vars=<pad/figma-vars.json>
```

Exit 0 = alles gedekt · 1 = variabelen zonder token (de bevinding) · **2 = meting ongeldig**, en dat laatste is bewust een eigen type: geen enkele match, een lege dump of een lege token-bron is een instrumentfout, geen afwezigheidsbewijs. Matching gebeurt op de **staart** van het tokenpad, dus dezelfde check werkt op umanex (`Theme/light/x`), rowtrack (`Core|Theme|Component`) en Columba (`semantic/color/text/primary`, geen mode-laag) zonder configuratie. Een `⚠ dubbelzinnig` meldt dat een naam op twee échte lagen matcht (`chart-1` → `Primitives/Chart/1` én `Theme/light/chart-1`) — mode-varianten zwijgen. De tegenproef staat in `scripts/test-figma-token-coverage.sh` (9 cases, beide kanten per regel).

**Faalt een punt?** Dat is een gap. Los hem op (terug naar stap 5) of rapporteer hem expliciet aan de gebruiker met de reden waarom hij niet opgelost kon worden — sluit nooit af met een stille gap.

---

### Stap 8 — Parity-gate: correctheid tegen bedoeld

Stap 7 bewijst *aanwezigheid* — alles gebonden, geen raw waarden. Stap 8 bewijst *correctheid*: bindt elke property aan het token dat de **code bedoelde**? Een token dat bestaat maar de verkeerde betekenis draagt (verkeerde laag, naburig spacing-token) compileert, oogt juist, en breekt stil bij de volgende theme- of token-wijziging. Dat is precies wat deze gate vangt. Objectieve diff, geen smaak-oordeel — UX-kwaliteit hoort in `ux-audit`, niet hier.

**De twee kanten van de diff:**
- **Bedoeld** — de `token path → variable ID` lookup uit stap 4: wat de component-code per property voorschreef. **Let op bij een hex-source:** gebruikt de component rauwe hex i.p.v. token-referenties, dan is "bedoeld" geen code-feit maar de *bevestigde* reverse-lookup uit stap 4 (na voorstel + bevestiging). De gate verifieert dan dat de write dat bevestigde mapping volgt en flagt collisions — maar certificeert de laag-keuze niet autonoom, want de source droeg geen semantische intentie.
- **Werkelijk** — lees de geschreven node terug via **`figma_execute`** (Console MCP, **nooit native MCP** — native geeft enkel hex en herintroduceert de hex-collision-ambiguïteit die deze check moet vangen). Eén call doet traversal + binding-extractie + naam-resolutie: loop met `findAll` over de node, lees per property de `boundVariables` en resolve elke variable-ID naar zijn tokennaam via `figma.variables.getVariableByIdAsync(id).name`. Lees in dezelfde call ook `layoutMode` (auto-layout-check) en de node-structuur (hiërarchie).

  **Waarom `figma_execute` en niet `figma_get_component_for_development_deep`:** bij **library-tokens** (de normale klant-opzet met tokens in een gedeelde library) geeft `_deep` de `boundVariables` terug als **IDs**, niet als namen (`variablesResolved: 0`, geen lokale variable-map) — je moet ze dan toch resolven — en het levert een zware, generieke boom op die je niet nodig hebt. `figma_execute` geeft in één call exact de per-property tokennamen die de diff vereist, en `getVariableByIdAsync` resolvet óók library-variabelen. `_deep` blijft wél de juiste tool in `figma-naar-code` stap 3, waar de volledige boom (reactions, instance-refs) het doel is. Tweede reden, en de dwingende: `figma_execute` en `_deep` draaien op de plugin-runtime, terwijl `figma_get_component_for_development` de depth-4 **REST**-variant is en dus de cloud-staat van vóór je `figma_execute` teruggeeft. Downgrade hier nooit naar die variant op grond van "de component is ondiep genoeg" — de read-back van een gate leest nooit de cloud.

  Read-back-skelet:

  ```javascript
  // Bestandsguard op identiteit. DOELKEY = de fileKey uit de URL van het doelbestand.
  // figma.fileKey is via de Desktop Bridge gevuld — gemeten 2026-08-25: een string, ook
  // al noemt het plugin-manifest de fileKey-permissie niet. Reken er in een andere opzet
  // niet blind op: leeg = terugvallen op de naam én dat mélden, nooit stil. Wil je het
  // weten, geef `fileKey` mee in je return — het MCP-antwoord toont hem niet vanzelf.
  const zwak = !figma.fileKey   // true → geef `zwak` mee in het resultaat én meld het in je antwoord
  if (figma.fileKey ? figma.fileKey !== DOELKEY : figma.root.name !== DOELBESTAND)
    return { meting_ongeldig: 'verkeerd bestand: ' + (figma.fileKey || figma.root.name) }
  const nm = async id => { try { const v = await figma.variables.getVariableByIdAsync(id); return v ? v.name : id } catch { return id } }
  const resolveBV = async bv => {
    const r = {}
    for (const k of Object.keys(bv || {})) {
      const val = bv[k]
      if (Array.isArray(val)) r[k] = await Promise.all(val.map(a => nm(a.id)))
      else if (val && val.id) r[k] = await nm(val.id)
    }
    return r
  }
  const n = await figma.getNodeByIdAsync(NODE_ID)
  const out = { name: n.name, layoutMode: n.layoutMode, bound: await resolveBV(n.boundVariables) }
  // idem voor fills (paint.boundVariables.color) en elke TEXT-descendant:
  // fill-kleur, fontFamily/fontSize/fontStyle, en textStyleId via getStyleByIdAsync
  return out
  ```

**Diff-set — twee kanten.** De bedoeld-kant alléén volstaat niet, en dat is gemeten in plaats van vermoed: vier instanties in Luminus (`LEARNINGS.md` 2026-07-07 ×2 en 2026-08-17, plus `apps/fleet-manager/LEARNINGS.md` 2026-08-17), twee apps, beide richtingen.

- **Bedoeld → werkelijk.** Elke property die stap 4 als bedoeld-gebonden markeerde, moet in de read-back het bedoelde token dragen. Vangt een verkeerde laag of een naburig token.
- **Werkelijk → bedoeld** — *enumererend*. Somt op wat de node **heeft**, niet wat jij schreef. Elke visuele property met een waarde die niet in de bedoeld-set zit, is een bevinding tot ze verantwoord is.

Waarom die tweede kant moet bestaan: `clone()` erft élke property van zijn bron, inclusief de fouten die daar al zaten. Wat je niet schreef staat niet in de bedoeld-set, en wat niet in de bedoeld-set staat wordt niet gediff'd — samen een blinde vlek die precies zo groot is als het verschil tussen "de node" en "jouw write". Alle vier de instanties zitten daarin: een tab-underline gebonden aan `neutral/500` die via klonen vier schermen ver reisde, en een actief-treatment gekopieerd als `strokes` + `textFills` zónder `fills` — drie van 25 tabs onleesbaar, geen error, geslaagde build.

De raw-value sweep ("staat er nog ergens een hardcoded waarde?") is stap 7 — niet hier dupliceren.

**Wat per property vergeleken wordt:**

1. **Token-path match** — komt de gebonden variable-naam exact overeen met het bedoelde token-path? Voor:
   - fills (achtergrond / border / tekstkleur)
   - spacing (`paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `itemSpacing`)
   - radius (de vier hoeken afzonderlijk)
   - typography (text style naam)
   - effect styles (shadow / blur — effect style naam)
2. **Laag-correctheid (hex-collision)** — verschillen bedoeld en werkelijk, maar delen ze dezelfde resolved waarde (hex/getal)? Dan viel de binding op een variable van de verkeerde laag. Ladder, meest → minst specifiek: **component → semantisch → primitief** — maar **enkel onder tokens waarvan de rol/context bij de node past**. "Meest specifiek" betekent dus niet "hoogste laag", maar "het juiste token voor déze rol, op de hoogst mogelijke laag". Een meer-specifiek token uit een vreemde rol of component (bv. een `components-button-*-disabled` token gebonden op een badge-border, zelfde hex) is **geen geldige kandidaat maar net de mismatch** die deze check moet vangen — consistent met de rol-context-regel van `figma-naar-code`. Rapporteer welke rol/laag bedoeld was vs gekozen (bv. bedoeld semantisch `color.border.strong`, gebonden `components.button.outline.border.disabled`, zelfde hex).
3. **Auto-layout aanwezig waar spacing bindt** — staat `layoutMode ≠ NONE` op elk frame waar een spacing-token bedoeld is? Geen auto-layout → de spacing-binding kan niet bestaan → mismatch (sluit aan op principe 1).
4. **Hiërarchie** — komt de node-boom overeen met de component-structuur? 1 component = 1 node; sub-componenten als eigen nodes.
5. **Onverantwoorde aanwezigheid** — de enumereer-kant. Lees per node in de geschreven subtree wat er wérkelijk staat: `fills` · `strokes` + `strokeWeight` · `cornerRadius` · `effects` · `opacity` · `layoutMode` + de vier paddings + `itemSpacing`, en op elke TEXT-descendant `fontName` · `fontSize` · `lineHeight` · `letterSpacing` · `textStyleId` + fill. Elke gevonden property valt in één van drie bakken:

   | Bak | Betekenis | Actie |
   |---|---|---|
   | bedoeld & correct | zit in stap 4's map, binding matcht | ok |
   | bedoeld & mismatch | zit in de map, ander token gebonden | gap — terug naar stap 5 |
   | **aanwezig & onverantwoord** | heeft een waarde, zit **niet** in de map | de geërfde klasse — verantwoord expliciet, of fix |

   De derde bak is zelden leeg, en dat is de bedoeling: een transparante fill of een afwezige stroke is een legitieme uitkomst — maar je hebt hem *gezien*. "Zat niet in mijn write-set" is geen verantwoording, want dat is exact de zin die de vier instanties produceerde.

**Meer dan één exemplaar? Toets de partitie, niet het exemplaar.** Schrijf je N instanties van hetzelfde patroon (tabs, rijen, kaarten, chips), dan is per-exemplaar kijken de fout zelf: bij 25 tabs is een steekproef van drie toevallig groen, en juist de exemplaren die onveranderd bleven verbergen het gat. Definieer de toegestane behandelingen als **signatuur** en assert dat élk exemplaar er exact één draagt:

```javascript
// signatuur = het meetbare kenmerk dat de behandelingen uit elkaar houdt
const arr = v => Array.isArray(v) ? v : []   // fills is figma.mixed (symbol) bij afwijkende segmenten
const sig = n => `${arr(n.fills).filter(f => f.visible !== false).length}f/${arr(n.strokes).length}s`
const items = frame.findAll(n => n.name === 'tab')
const buckets = {}
for (const it of items) (buckets[sig(it)] ||= []).push(it.name)
return { total: items.length, buckets }   // verwacht: exact 2 sleutels, samen = total
```

Een derde sleutel in `buckets` **is** de bevinding — je hoeft hem niet te herkennen, hij telt zichzelf. Zelfde vorm als de invariant-rail in `CLAUDE.md` (*Discipline in de Beoordeel-stap*): bij een herhaalde of afgeleide waarde is de invariant de meetbare as, niet het exemplaar dat je toevallig opent.

**Pass-conditie:** elke bedoeld-gebonden property matcht (naam én laag), auto-layout aanwezig waar spacing bindt, hiërarchie komt overeen, elke property uit bak 3 is expliciet verantwoord, en bij herhaalde exemplaren valt élk exemplaar in een toegestane signatuur. Nul mismatches.

**Verantwoording in de output:** som per check (1–5) expliciet op wat gemeten is en wat de uitkomst was — vijf regels, geen samenvatting. Een export-rapport zonder die vijf regels is onaf; het dwingt herlezen af op het beslismoment i.p.v. leunen op sessiegeheugen.

**Bij elke mismatch — capture via de `vastleggen`-skill (schrijflogica niet dupliceren):**

Draai de `vastleggen`-skill per mismatch, met de velden vooraf ingevuld zodat de capture wrijvingsloos en niet-interactief is:

- **Header** (`{skill of principe dat faalde}`): `code-naar-figma parity`
- **Input:** de Figma-node-URL van de geschreven node (fileKey uit stap 2 + `node-id` van de execute)
- **Fout:** de concrete token-diff, bv. `spacing.md bedoeld, spacing.sm gebonden op FilterCard paddingTop`, of `color.text.link bedoeld (semantisch), color.blue.500 gebonden (primitief, zelfde hex)`
- **Routing:** pre-answered op cwd — stel de routing-vraag van `vastleggen` **niet** interactief; de gate vult ze in. Export in umanex-os zelf (pilot) → globaal; in een klant-repo → klant-laag (`git rev-parse --show-toplevel`); in een app-subfolder → project-laag.

`vastleggen` handelt de datum (`date +%F`), de file-creatie en de append af, en zet altijd `Status: open`. Dupliceer die logica niet hier.

**Na capture:** de mismatch is een gap — los hem op (terug naar stap 5) en draai stap 7-8 opnieuw, of rapporteer expliciet waarom hij niet opgelost kon worden. De capture blijft staan, ook na een fix: ze registreert dat de mapping-logica op deze input faalde en dient zo als reproduceerbare verificatie-test voor de eval-loop (`vastleggen` → `learnings-verwerken`). Sluit nooit af met een stille parity-gap.

---

## Doelbestanden

De Figma file-keys en hun rollen verschillen per klant en staan in de klant-CLAUDE.md. Raadpleeg die tabel vóór je een doelbestand kiest. Staat de key er niet: vraag het, hardcode geen key in deze skill.