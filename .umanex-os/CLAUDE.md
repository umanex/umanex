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

**Wat is TC-EBC**

TC-EBC is een prompt skeleton dat Jeroen gebruikt om design- en prototype-briefings te formaliseren voor ze gebouwd worden. Geen verbose documentatie — een skeleton.

```
T  — Task:        One line describing what the prototype or screen should do
C  — Context:     Where this fits in the product or flow
E  — Elements:    Literal UI components present — keep this a short list
B  — Behaviour:   How users interact with those components
Co — Constraints: Device, layout rules, visual constraints — concise
```

Regels:
- Elke regel zo kort mogelijk
- Alleen wat het model écht moet weten
- Geen verbose documentatie

**Wanneer toepassen**

Bij elke design- of prototype-briefing schrijf je *eerst* een TC-EBC, vóór je de codebase verkent of verduidelijkingsvragen stelt. Dit is geen optionele stap. Geen vraag vooraf — je maakt zelf een TC-EBC voor je begint te bouwen.

Belangrijk: deze stap moet plaatsvinden in de **main agent context**, niet uitbesteed worden aan een sub-agent. Als de hoofd-Claude de briefing krijgt, is de TC-EBC zijn eerste actie.

**Sanity check — voor je begint**

Voor je een TC-EBC schrijft, valideer eerst dat dit effectief een design- of prototype-taak is:

- Bevat de input een UI- of design-element (component naam, scherm, flow, interactie, layout, visueel patroon)? → Door met TC-EBC.
- Gaat de input over puur niet-UI werk (bv. refactor van een hook, performance optimalisatie, bug fix in business logic, debug, deployment)? → Skip TC-EBC. Zeg expliciet: *"Lijkt geen design taak — TC-EBC overgeslagen."*

Bij twijfel: door met TC-EBC. Een onnodige TC-EBC is minder erg dan een gemiste.

**Stappenplan**

1. **Detecteer of de Task duidelijk is**
   - Task duidelijk → ga naar stap 2
   - Task onduidelijk (bv. "doe iets met die sidebar") → vraag eerst om verheldering. Maak nog geen bestand.

2. **Detecteer scope: één of meerdere taken?**
   - Eén coherent geheel → ga naar stap 3
   - Meerdere componenten of features → vraag: *"Wil je hier één TC-EBC voor het geheel, of aparte TC-EBC's per component?"*

3. **Bepaal type** (vaste set):
   - `component` — één UI primitive of compositie
   - `flow` — opeenvolging van schermen of stappen
   - `screen` — volledige pagina of view
   - `feature` — capability die meerdere componenten of schermen kruist
   - Bij twijfel: kies `component`

4. **Detecteer iteratie**
   - Als er al een TC-EBC bestand bestaat met dezelfde basis-naam (zelfde datum + naam), vraag: *"Update bestaand bestand of nieuw bestand?"*
   - Bij "nieuw": voeg `HHMM` suffix toe aan bestandsnaam

5. **Valideer kritische items**
   - Vier items die altijd opgevraagd moeten worden tenzij beantwoord in klant- of projectcontext
   - Voor elk niet-beantwoord item: zet op Open vragen lijst

6. **Schrijf het bestand** (zie locatie en naamgeving hieronder)

7. **Toon TC-EBC inline in chat** als codeblock met expliciete labels. Vermeld het bestandspad en eventuele open vragen. **Niet stilzwijgend overslaan** — gebruiker moet zien wat er is opgeslagen.

**Kritische items (altijd vragen tenzij beantwoord in klant/project context)**

1. **Component-typologie** — sheet / dropdown / modal / aparte pagina / inline
2. **States** — loading / empty / error / success / default
3. **Interactie-modaliteit** — klik / swipe / drag / keyboard / hover
4. **Edge cases** — max waardes, min waardes, validatie regels

Andere items (mogen aanname zijn met `[ASSUMPTION: ...]` marker):
- Doelgroep / persona
- Device / form factor
- Data shape / structuur
- Branding / design system context

**Vragen-formulering per kritisch item**

Wanneer een kritisch item ontbreekt, gebruik deze formuleringen. Bied altijd de meest plausibele optie eerst aan op basis van wat in project-context zichtbaar is.

- *Component-typologie:* "Wordt dit een [meest plausibele optie uit project context], of iets anders zoals [twee andere opties]?"
- *States:* "Welke states zijn van toepassing? Loading is meestal nodig bij data-fetch, empty bij lege resultaten, error bij failure. Welke gelden hier?"
- *Interactie-modaliteit:* "Welke interactie verwacht je: klik, swipe, drag, keyboard? Voor [type component] is [meest plausibele] gebruikelijk."
- *Edge cases:* "Edge cases om te overwegen: minimum aantal items, maximum aantal items, lege staat, validatie. Welke zijn relevant?"

**Inline formaat in chat**

```
TASK:        ...
CONTEXT:     ...
ELEMENTS:    ...
BEHAVIOUR:   ...
CONSTRAINTS: ...
```

**Bestandslocatie**

Standaard: `/briefings/` aan de root van het actieve project. In monorepos kan dit overschreven worden per klant-CLAUDE.md (zie bv. Columba's regel voor `apps/{app}/briefings/`).

Als de folder nog niet bestaat: maak hem aan.

**Bestandsnaamgeving**

Format: `{YYYY-MM-DD}-{type}-{naam}.tcebc.md`

Voorbeelden:
- `2026-04-29-component-filter-bar.tcebc.md`
- `2026-04-29-flow-onboarding.tcebc.md`
- `2026-04-29-feature-mobile-vergelijking.tcebc.md`

Bij naamconflict (bestand bestaat al en gebruiker koos "nieuw"): voeg `HHMM` suffix toe.
- `2026-04-29-1430-component-filter-bar.tcebc.md`

De `.tcebc.md` extensie is een pilot-marker die verifieerbaar maakt dat de TC-EBC-flow correct is doorlopen. Wordt later vervangen door `.md` zodra de flow stabiel is.

**Bestandsinhoud — volledig structuurformaat**

Het bestand bevat: titel met naam, metadata blok (Datum / Type / Project / Klant / Status), een horizontale lijn, het inline TC-EBC codeblock met TASK / CONTEXT / ELEMENTS / BEHAVIOUR / CONSTRAINTS labels, een tweede horizontale lijn, dan de secties Open vragen, Aannames, en Beslissingsgeschiedenis.

Open vragen-sectie: lijst van kritische items die nog niet beantwoord zijn. Leeg laten als alles beantwoord is.

Aannames-sectie: lijst van items met `[ASSUMPTION]` markers — niet kritisch maar context-afhankelijk.

Beslissingsgeschiedenis-sectie: alleen kantelpunten, niet elke kleine wijziging.

Een kantelpunt is: component-typologie gewijzigd (sheet → modal), kritisch element toegevoegd of verwijderd, scope significant verschoven.

Een kantelpunt is NIET: typo's of formuleringsverbeteringen, aanvulling van Open vragen sectie.

Format per regel: `- {YYYY-MM-DD}: {wat veranderd is en waarom}`

**Voorbeelden**

Drie uitgewerkte voorbeelden staan in `umanex-os/docs/tc-ebc-examples/`:
- `01-volledige-briefing-columba.md` — rijke briefing, weinig open vragen
- `02-onvolledige-briefing.md` — minimale briefing, veel kritische items als open vragen
- `03-feature-mobile.md` — niet-component briefing op feature-niveau

---

## Werkprincipes voor code en componenten

**Component structuur**
Strict 1 component = 1 file. Geldt ook voor sub-componenten (CardHeader, CardBody, CardFooter staan elk in hun eigen bestand). Dit zorgt voor cleane Figma MCP / Code Connect koppeling.

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

**Wat mag, zonder vragen**
- Read-only: `git status`, `git diff`, `git log`, `git branch`
- Lokaal: `git checkout`, `git checkout -b`, `git pull`, `git add`
- Commits maken — onder de twee veiligheidskleppen hieronder

**Wat nooit mag**
- Pushen naar remote (`git push`)
- Branches mergen (lokaal of via GitHub)
- Tags aanmaken of verwijderen
- Vercel deployments triggeren

**Veiligheidskleppen rond commits**
1. Commit alleen op feature branches, nooit op `main`. Als je op main staat, maak eerst een feature branch aan.
2. Toon de commit message en wacht op akkoord voor je commit. Niet de hele commit, alleen de message ter goedkeuring.

**Branch naming**
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

**Commit messages**
Format: Conventional Commits in het Engels.

```
<type>[optional scope]: <description>

[optional body]
```

Body toevoegen wanneer:
- de wijziging niet evident is uit de subject alleen
- er een breaking change is
- er context is over *waarom* dit zo gebeurde (niet *wat*)

**PR descriptions**
Wanneer een feature af is, stel zelf een PR-description voor. Default sectie: alleen "Wat" (korte beschrijving van wat dit toevoegt of wijzigt).

"Waarom" of "Hoe te testen" toevoegen als de wijziging dat verdient. Bij twijfel: alleen "Wat".

Jeroen plakt de description zelf in de PR op GitHub.

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

**Figma node referenties**

In chat: alleen de naam.
> *"Pas de padding aan op de FilterCard"*

In TC-EBC briefings, PR descriptions en commit messages: naam + klikbare URL.
> *"Pas de padding aan op [FilterCard](https://www.figma.com/design/abc123/...?node-id=142-3801)"*

**Design tokens**

Verwijs altijd naar tokens via het token path (Tokens Studio notatie):
> *"Gebruik color.primary.500 voor de border"*

Reden: token path is bron-van-waarheid neutraal — werkt in Figma, JSON, CSS variables én Tailwind. Beschermt tegen verwarring tussen klanten met verschillende Tailwind-configuraties.

In code zelf vertaal je wel naar de juiste implementatie (Tailwind class, CSS variable, etc.). Maar wanneer je *over* tokens praat in chat, briefings of rationale: altijd het path.

**Bestand- en code-locatie referenties**

Altijd vol pad vanaf project root. Geen compacte vorm, geen "in FilterBar.tsx" zonder pad.

> *"In `apps/enviro/src/components/forms/FilterBar.tsx`, regel 42, vervangen we de useState door..."*

Reden: in monorepos bestaat dezelfde filename vaak in meerdere apps.

**Figma MCP vs Figma Console MCP — twee-laag setup**

Strict scheiding:

```
Lezen uit Figma      → Figma MCP
Schrijven naar Figma → Figma Console MCP
```

Geen uitzonderingen. Vermeld expliciet welke MCP je gebruikt voor welke stap.

**Bij gemengde taken (lezen én schrijven):**
Vraag vooraf welke kant op te gaan. Bijvoorbeeld: *"Wil je dat ik eerst lees en je laat vergelijken, of meteen schrijf op basis van wat ik in code zie?"*

**Als Figma Console MCP niet beschikbaar is:**
Weiger de schrijfactie en vraag om Console MCP eerst te enabelen. Geen workarounds via manuele instructies of plugin-code.

---

## Markdown en syntaxregels

Sectie waar regels verzameld worden die doorheen sessies opduiken — dingen die fout liepen en niet meer mogen gebeuren.

**Geneste codeblocks in markdown**
Wanneer markdown wordt geschreven die zelf codeblocks bevat: gebruik viervoudige backticks rond de buitenste block, of gebruik geïndenteerde code (4 spaties) voor de inner block. Anders sluit de inner block voortijdig de outer af. Test geneste markdown mentaal voor je hem post.

**Markers**
- `[ASSUMPTION: ...]` — voor aannames in TC-EBC briefings of code waar context ontbrak
- `// TODO: ...` — voor open taken in code
