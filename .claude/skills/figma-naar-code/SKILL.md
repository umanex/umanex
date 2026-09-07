---
name: figma-naar-code
description: Vertaalt een Figma component of scherm naar correcte TypeScript/React code. Gebruik deze skill altijd wanneer de gebruiker een Figma URL deelt, vraagt om een component te implementeren vanuit Figma, vraagt om design aanpassingen door te voeren in de code, of zegt "sync met Figma", "implementeer dit design" of "pas de code aan op basis van Figma".
---

## Werkwijze

Dit is een **Figma → Code** operatie. Pas NOOIT Figma nodes aan tijdens deze operatie.

**Primaire tool: Figma Console MCP** (Desktop Bridge Plugin API). Dit is consistent met de globale regel: Console MCP is primair voor álle Figma-operaties, lezen én schrijven (geen lees/schrijf-split). De reden om dat hier expliciet te benadrukken: Console MCP geeft opgeloste token-paden terug (`boundVariables`), native MCP geeft enkel hex-waarden. Token-paden zijn essentieel voor correcte mapping, dus voor design-to-code lezen we via Console. Native MCP is uitsluitend voor de fallback-taken onderaan, of als Desktop Bridge niet beschikbaar is.

---

## Bronnen-poort — verplicht vóór je bouwt

Bouw nooit op een leeg vel wanneer er al een bron ligt. Stel eerst vast welke van de drie
bestaan, en noem ze in je antwoord. De app-eigen `CLAUDE.md` draagt dat sinds 2026-09-07 in
een `## Design-systeem-bron`-sectie: welke Tailwind-preset, welke componentbron, welke Storybook.
Ontbreekt die sectie, dan is dát je eerste bevinding — `pnpm ds:guard` toetst hem hard in CI.

| Bron | Wat het betekent voor deze taak | Harde check |
|---|---|---|
| **Design system** (tokens + preset) | elke kleur, spacing, radius en typografie bindt aan een rol; nooit een rauwe waarde, nooit een primitive | `pnpm --filter @umanex/tokens guard` |
| **Figma library** (component library-bestand) | het component bestáát daar mogelijk al: instantieer in plaats van na te tekenen | `pnpm --filter @umanex/ui figma:check` |
| **Storybook** | de gerenderde component is het meetbare doelwit, en zijn maten liggen vast in een basislijn | `pnpm --filter @umanex/ui geometry` |

Drie regels die daaruit volgen.

**Bestaat het component al in de library, dan bouw je het niet opnieuw.** Zoek eerst
(`figma_search_components` aan de Figma-kant, de `exports` van de componentpackage aan de
code-kant). Een nagetekend component is een tweede bron van waarheid, precies zoals een
variabele zonder token.

**Bestaat er een Storybook, dan is die de bedoeld-kant.** Niet je eigen lezing van de code, en
niet een grep. In umanex-apps ligt de gemeten code-kant in `packages/ui/figma/geometry.code.json`
(`pnpm --filter @umanex/ui geometry:write`); dat bestand draagt per story de doosmaten van elk
element. Gebruik díe getallen als vergelijkingsbron.

**Ontbreekt een van de drie, zeg dat.** "Geen Storybook in deze app" is een geldig antwoord dat
de meetbare as verzwakt, en dat hoort in je rapport te staan — niet weggelaten te worden. Zelfde
regime als "geen" in het `## Verify-pad`.

---

## Kernprincipe — mapping moet semantisch correct zijn, niet alleen tokenized

De waarde van deze skill zit niet in "geen hardcoded waarden" alleen. Een token dat *bestaat* maar de verkeerde betekenis draagt is even fout als een hardcoded hex — het compileert, het ziet er juist uit, en het breekt stilletjes bij de volgende theme- of token-wijziging.

Twee regels die de hele skill sturen:

1. **Kies altijd het semantisch juiste token, niet het eerste token met de juiste waarde.** Dezelfde hex-waarde komt vaak voor op meerdere tokens over meerdere lagen heen — een achtergrond-, tekst-, border- en component-token kunnen dezelfde kleur delen. Alleen één is correct per context.
2. **Bij twijfel: voorstel + bevestiging, nooit gokken.** Een verkeerde stille mapping is duurder dan een extra vraag.
3. **Identificeer het scherm aan zijn inhoud, niet aan zijn laagnaam.** Een laagnaam is een bewering van de designer, geen eigenschap van het scherm — en hij groeit zelden mee. Lees de titel, de velden en de knoppen vóór je een Figma-frame aan een code-scherm koppelt. Gemeten op LQB (2026-08-18): frame `604:42883` heet `unit:04-contact`, zijn kind `screen:d1-account-manager-handoff`, en de kaart erin draagt de titel "Add your company details" met de velden `Company name` en `Street` — de naam wees een bedankscherm aan, de inhoud een invulformulier. Spreekt een tweede signaal de naam tegen (een connector-label in het flow-diagram, de node-id in de `@figma`-header van een bestaand component), dan is die tegenspraak het alarm: verklaar hem vóór je koppelt, en trek een onbevestigde koppeling nooit door naar zusterschermen "voor de consistentie".

---

### Leesbaarheidscontract — wat je mag verwachten, en wat je meldt

`code-naar-figma` schrijft volgens een contract van zeven regels: laagnaam is de code-naam,
geen `GROUP`, één component set met de variant-assen van de cva, elke tekstnode aan een text
style, de description draagt het codepad, één sectie per component, geen losse absolute
positionering.

Toets dat vóór je vertaalt, want het bepaalt hoeveel je mag afleiden en hoeveel je moet vragen:

| Aanwezig | Dan mag je | Ontbreekt het | Dan |
|---|---|---|---|
| description met codepad | dat bestand als bron nemen | — | zoek zelf, en meld dat je gezocht hebt |
| `state`-variant-as | de states daaruit lezen | — | val terug op `reactions`, dan op "geen states" |
| text styles | typografie uit de style nemen | — | lees de losse waarden en meld ze als ongebonden |
| auto layout | padding en gap als spacing-tokens lezen | — | de maten zijn rauwe getallen; meld dat |

**Een laagnaam blijft een bewering, ook onder dit contract.** Gemeten op 2026-08-18: een
framenaam wees naar het scherm `account-manager` terwijl het frame `account-manager-details`
toonde, en twee onafhankelijke signalen spraken die naam tegen zonder dat ik er één meldde.
Het contract maakt de naam bruikbaar, niet waar. Spreken naam en inhoud elkaar tegen, dan is
díe tegenspraak het alarm — verklaar hem of meld beide.

---

## Klant-context inlezen — verplichte eerste stap

Deze skill is klant-agnostisch. Het concrete token-systeem verschilt per klant. **Lees daarom eerst de token-conventie uit de actieve klant-CLAUDE.md** voor je begint te mappen. Verwacht daar (sectie "Token-conventie voor figma-naar-code" of equivalent):

- De **CSS-variabele notatie** (separator + eventuele laag-prefixes) en het pad naar het token-build output bestand
- De **laag-structuur** van het token-systeem (bv. primitives / semantic / components) en de prioriteitsvolgorde
- Welke **categorieën bewust primitief-only** zijn (domein-kleuren zonder semantische laag) — die vormen de uitzondering in niveau 3 hieronder
- Het pad naar de gegenereerde token-lijst (`references/token-mapping.md`) en het sync-script

Staat die sectie er niet → vraag de notatie en laag-structuur op voor je code genereert. Verzin nooit een notatie.

---

### Stap 1 — Controleer Desktop Bridge

Controleer of de Console MCP beschikbaar is via `figma_get_status`.

- Als Bridge actief: ga verder naar Stap 2
- Als Bridge **niet** actief: vraag "Wil je Desktop Bridge activeren, of overschakelen naar native MCP?" — wacht op antwoord, ga nooit stilzwijgend verder

---

### Stap 2 — Token-referentie vers houden

De skill leunt op de gegenereerde token-lijst van het actieve project (pad in klant-CLAUDE.md, doorgaans `references/token-mapping.md`). Dit bestand verstaalt snel.

- Als `tokens.json` nieuwer is dan de token-lijst, of bij twijfel over verse data → draai eerst het sync-script (pad in klant-CLAUDE.md, doorgaans `node skills/figma-naar-code/scripts/sync-tokens.js` vanuit de project root)
- Map nooit tegen een verouderde token-lijst — dat is hoe verkeerde matches binnensluipen

> Het sync-script emit naast `token-mapping.md` ook `token-mapping.json` (token-pad → cssVar + opgeloste waarde + categorie) — het machine-diffbare, jq-bare doel voor de parity/verify-as (stap 6/7 en de triade-Beoordeel), waar de markdown-tabel dat niet kon zijn.

---

### Stap 3 — Component ophalen met `figma_get_component_for_development_deep`

Gebruik altijd de deep-versie voor design-to-code werk. Geef **altijd `codebasePath` mee** — dan scant de tool de bestaande codebase en koppelt Figma-nodes aan reeds bestaande componenten:

```
figma_get_component_for_development_deep(
  nodeId: "<node-id>",          // uit de Figma URL: node-id=X-Y → "X:Y"
  depth: 10,                    // verhoog naar 20 voor zeer diepe componenten
  codebasePath: "<project root, of components-pad uit klant-CLAUDE.md>"
)
```

**Plugin-versie-afhankelijkheid.** `figma_get_component_for_development_deep` is een plugin-methode. Faalt hij met "Unknown method: DEEP_GET_COMPONENT", dan komt de geladen Desktop Bridge-plugin niet overeen met de `figma-console-mcp`-serverversie — "in de tool-lijst staan" garandeert geen werkende methode. Fix: laad de gebundelde plugin (`~/.figma-console-mcp/plugin`), niet een oudere losse build.

**Verf is het bewijs, niet de instelling ernaast.** Een Figma-node houdt zijn
`strokeWeight`, `strokeBottomWeight`, `cornerRadius` en `dashPattern` óók wanneer er geen
stroke-*paint* meer op staat — die waarden beschrijven hoe een lijn eruit zou zien *áls* hij
bestond. Wie de weight uitleest en "er staat een rand" concludeert, bouwt een rand die het
design niet heeft. Toets daarom altijd de paints:
`strokes.filter(p => p.visible !== false && p.opacity !== 0).length > 0` — en hetzelfde voor
`fills` vóór je een blok een kaart noemt. Gemeten in Luminus `fleet-manager` (2026-08-19):
élk `pt`- en `st`-titelframe draagt `strokeBottomWeight: 2` bij een **lege** `strokes`-array;
een implementatie op de weight zette een onderlijn onder 34 titels die in het design nergens
staat. **Tegenproef vóór je concludeert:** meet in dezelfde run één node die aantoonbaar wél
een rand heeft naast één die er geen heeft. Rapporteren ze allebei "rand", dan meet je de
instelling in plaats van de verf.

**Wat deze tool teruggeeft (relevant voor de stappen hierna):**
- `boundVariables`: alle toegepaste design tokens als opgeloste namen (niet IDs) → input voor de token-ladder in stap 4
- `reactions`: interactie states (hover, focus, active) → **input voor state-handling in stap 5** (niet alleen lezen — verzilveren)
- `layoutSizing`, `minWidth`, `maxWidth`: sizing constraints
- `mainComponent` refs voor INSTANCE nodes
- bestaande-component-matches uit de `codebasePath`-scan (zie hieronder)

**Duplicaat-preventie — vóór je begint te bouwen.**
Wijst de scan een bestaand component aan dat met deze Figma-node overeenkomt:
- **Exacte/sterke match** → bouw geen nieuw component. Hergebruik of breid het bestaande uit, en meld dat aan de gebruiker: *"`<pad>` lijkt dit al te implementeren — ik werk dat bij i.p.v. een nieuw bestand te maken. Akkoord?"*
- **Gedeeltelijke match** (bv. een primitive die hergebruikt kan worden) → bouw daarop voort i.p.v. opnieuw.
- **Geen match** → nieuw component, volgens de conventies in CLAUDE.md.

Sla deze stap nooit over — een dubbele implementatie is duurder dan één vraag.

---

### Stap 4 — Token mapping uitvoeren (prioriteitsladder)

Uit de `boundVariables` in de deep response komen token namen in Figma-notatie (Tokens Studio slash-pad, bv. `color/text/link`, `spacing/4`).

Een gelaagd token-systeem (zoals beschreven in de klant-CLAUDE.md) kent doorgaans drie lagen: van meest specifiek naar minst specifiek = **component → semantisch → primitief**. Hoger = specifieker en stabieler. **Werk de ladder af in volgorde, stop bij de eerste hit.** Pas de exacte laag-namen en notatie toe zoals de klant-CLAUDE.md ze definieert.

**Niveau 1 — Component-token.**
Als de Figma-node een gekende component-rol heeft (een button-fill, een border, etc.) en er bestaat een passend component-token → gebruik dat. Component-tokens zijn het meest specifiek en breken het minst snel. Geen vraag nodig bij een eenduidige rol-match.

**Niveau 2 — Semantisch token.**
De default voor alles met betekenis: text, background, border, radius, shadow, text-style. Bij exacte naam-match → direct gebruiken. Bij semantisch gelijkwaardig maar andere naam → voorstel + bevestiging:
> "Token `<figma-pad>` heeft geen exacte match. Semantisch gelijkwaardig: `<voorstel>`. Akkoord, of andere mapping?"

Documenteer na bevestiging in de token-lijst.

**Niveau 3 — Primitief — alleen voor categorieën zonder semantische laag.**
Een primitief gebruiken waar een semantisch token bestaat is een **mapping-fout**, geen fallback. Primitief is alléén correct voor de categorieën die de klant-CLAUDE.md expliciet als primitief-only markeert (domein-kleuren die bewust geen semantische laag hebben).

Voor alle andere waarden: als je op een primitief dreigt uit te komen terwijl er een semantische laag bestaat → stop, dit is bijna altijd de verkeerde keuze. Vraag het.

**Niveau 4 — Geen match.**
Maak een voorstel met de dichtstbijzijnde kandidaat en wacht op bevestiging. Gebruik tijdelijk:
```
/* TODO: token ontbreekt — zie voorstel hierboven */
```
Hardcoded hex/px/rem buiten een token-referentie zijn verboden, ook tijdelijk niet zonder dit TODO-voorstel-pad.

---

### Stap 4b — Design-snapshot wegschrijven (traceability voor Beoordeel)

De token-mapping uit stap 3–4 leeft nu alleen in context en verdampt na de sessie. Persisteer hem als een machine-leesbare **design-snapshot** — dit is het artefact waar de Beoordeel-stap van de triade (`verify` / parity) de gebouwde code tegen dift. Zonder snapshot valt die meetbare as terug op "overgeslagen" (zie CLAUDE.md, *Plan / Bouw / Beoordeel*).

Schrijf naast het component een sidecar-bestand `<ComponentNaam>.design-snapshot.md` — co-located, zodat het meeversiont met de component en `verify` de component-map toch al leest. Volg `references/design-snapshot.template.md`. Leg minimaal vast:

- **Identiteit** — component-naam, `node-id`, Figma-URL, datum
- **Token-bindings** — tabel `property | Figma-pad | gekozen token-pad | laag`: de bevestigde uitkomst van de ladder (stap 4)
- **Structuur** — layout-richting, sizing (`fill` / `hug`), gap- en padding-tokens
- **States** — de uit `reactions` afgeleide states (input voor stap 5)
- **Open punten** — ontbrekende tokens / TODO-voorstellen (stap 4, niveau 4)

De snapshot beschrijft de **design-intentie** (wat Figma zegt), niet de gebouwde output — zo blijft hij een onafhankelijke toetssteen. Werk hem bij zodra de mapping wijzigt.

> Alternatief (projectkeuze): centraliseer snapshots in een `snapshots/`-map die de component-paden spiegelt i.p.v. co-located sidecars. Co-located is default.

---

### Stap 5 — Code genereren

Regels:
- Behoud altijd bestaande TypeScript props interface
- Gebruik de token mapping uit stap 4 voor alle visuele waarden
- Vervang NOOIT tokens door hardcoded hex waarden
- Gebruik de CSS-notatie uit de klant-CLAUDE.md (separator + laag-prefix exact zoals daar gedefinieerd)
- Bij ontbrekende tokens: placeholder + voorstel (zie stap 4, niveau 4)
- Zet (of behoud) de `// @figma [node-URL]` header bovenaan het bestand — dat is de bron voor de gegenereerde component-inventaris (`gen-snapshot.sh`) en houdt de traceability naar de Figma-node

**States: eerst de `state`-variant-as, dan pas `reactions`.**
Dit is de afspraak die deze skill met `code-naar-figma` deelt. Een component die door die skill
geëxporteerd is, draagt zijn states als **variantframes op een `state`-as** en heeft géén
reactions. Lees je alleen `reactions`, dan concludeer je dat zo'n component geen states heeft —
gemeten op 2026-09-07, en het is de scherpste breuk in de round-trip.

Volgorde:
1. `variantGroupProperties` van de component set — draagt hij een `state`-as, dan zijn dié
   waarden de states, en de visuele waarden per state komen uit de `boundVariables` van het
   bijbehorende variantframe.
2. Pas als die as ontbreekt: `reactions`, zoals hieronder. Een handgetekend prototype draagt
   zijn states daar, en die bron blijft geldig.
3. Ontbreken ze allebei, dan heeft het component geen states in Figma. Verzin ze niet — meld
   het als gat, en vraag of ze erbij moeten.

**States afleiden uit `reactions` — niet verzinnen.**
De `reactions` uit de deep-response (stap 3) zijn de bron-van-waarheid voor welke interactie-states het component heeft. Genereer state-handling op basis daarvan, niet op basis van een aanname:
- Elke `reaction`-trigger (`ON_HOVER`, `ON_PRESS`/active, focus) → een corresponderende state in code (`:hover`/`:focus-visible`/`:active` of een `state`-prop, volgens het project-patroon)
- De *visuele* waarden per state komen uit de `boundVariables` van de bijbehorende state-node, via dezelfde token-ladder (stap 4) — geen hardcoded per-state kleuren
- Bevat Figma geen `reactions` → implementeer geen speculatieve states. Vermeld dat expliciet zodat de gebruiker ze alsnog kan vragen.

**Voor multi-mode tokens (light/dark):** als `figma_get_variables` meerdere modes toont, implementeer via CSS custom properties met data-attribute of class selector — geen hardcoded mode-waarden.

---

### Stap 6 — Design parity check (visueel + numeriek)

Token-correctheid (stap 7) bewijst niet dat het component eruitziet als het design. Deze stap doet dat wel — een vergelijking, geen aanname. Dit is de Figma → Code tegenhanger van de check in `code-naar-figma`.

1. **Figma-referentie ophalen** — `figma_take_screenshot` van de bron-node (`nodeId` uit stap 3).
2. **Gebouwd component renderen** — render via de preview van het project (Storybook-story, dev-route, of de methode uit klant-CLAUDE.md) en screenshot dat. Is er geen render-pad geconfigureerd → vraag welke; ga niet zelf gokken.
3. **Vergelijk** op de dingen die de token-checks níet vangen: layout & flex-richting, spacing/gap, proporties & afmetingen, alignment, typografie, afgekapte of overlopende content, en elke state uit stap 5.
4. **Itereer** — bij een mismatch: fix in code → opnieuw renderen → opnieuw vergelijken. Max 3 iteraties; daarna structurele afwijkingen melden i.p.v. blijven bijschaven.
5. **Meet wat het oog niet haalt** — de enumererende kant. Een visuele vergelijking accepteert stil élk verschil onder je waarnemingsdrempel, en daar zit parity-drift nu net: `pb-3` vs `pb-4` is 4 px, naast elkaar onzichtbaar, en een maand later een fix-commit. Gemeten in Luminus `partner-portal`: 16 parity-fix-commits in 90 dagen, waarvan twee paren met een identiek subject — dezelfde afwijking twee keer gevonden, twee keer met de hand bijgesteld.

   Diff daarom getallen tegen getallen, niet beeld tegen beeld. De Figma-kant staat machine-leesbaar in de design-snapshot (stap 4b) en `token-mapping.json` (stap 3); de code-kant komt uit `getComputedStyle` op de gerenderde component. Vergelijk per property — de vier paddings, gap, `font-size`, `line-height`, `border-radius`, `border-width`, kleur — en rapporteer elk verschil mét zijn twee waarden, ook 1 px. Heeft het doelwit geen DOM (React Native, native preview), dan bestaat dit pad niet: meld dat als `[NIET GEMETEN — geen computed-style-pad]` en behandel de visuele vergelijking als wat ze dan is, een zwakkere as.

6. **Meet ook de structuur, niet alleen de waarden.** Een diff op tekst en op losse
   properties mist nog steeds de vorm: of een blok een **kaart** is (vulling + rand-paint +
   radius), of een titel een lijn draagt, of een sectie op hetzelfde niveau staat als in het
   design. Neem die as expliciet mee — per contentblok "kaart ja/nee" en per titel
   "onderlijn ja/nee" — anders keurt de check een scherm goed dat structureel anders is
   opgebouwd. Gemeten in Luminus `fleet-manager` (2026-08-19): een tekst-only parity-ronde
   gaf "geen onverklaarde verschillen", terwijl acht schermen de kaart misten die het design
   voorschrijft en elke titel 16px was in plaats van 24.

7. **Een klasse in de source is geen bewijs dat de stijl rendert.** Meet de *uitkomst*
   (`getComputedStyle`), nooit de className die je zelf net schreef. Class-merge-lagen
   (`tailwind-merge`, `cva`, `clsx`-wrappers) gooien klassen weg die ze niet herkennen — een
   custom schaal-sleutel wordt bijvoorbeeld voor een kleur aangezien en sneuvelt zodra er een
   echte kleur naast staat. Dat compileert, rendert door, en is overal even fout, dus
   onzichtbaar zonder vergelijkingspunt. In `fleet-manager` viel daardoor élke kop en
   body-tekst terug op de 16px browser-default; zichtbaar geworden pas toen de gemeten
   font-size naast de Figma-waarde kwam te liggen.

8. **Je meetscript verdient dezelfde argwaan als je code.** De positieve-controle-regel uit
   `CLAUDE.md` geldt niet alleen voor lege uitkomsten maar ook voor een niet-lege meting die
   stil iets ánders telt dan je bedoelt — de weight in plaats van de verf, de kinderen van een
   node in plaats van de node zelf, een `<option>` die geen `offsetParent` heeft en dus
   "onzichtbaar" lijkt. Alle drie kwamen voor in één ronde (2026-08-19) en produceerden
   elk een "bevinding" die er geen was. Bouw daarom een controle ín het script: laat het in
   dezelfde run iets vinden waarvan je zeker weet dát het er is, en laat het **afbreken** als
   dat mislukt. Een parity-run die zijn eigen instrument niet toetst, rapporteert vertrouwen
   dat hij niet heeft.

9. **Bij elke mismatch die de numerieke diff (5), de structuur-as (6) of de render-meting
   (7) vindt: capture via `vastleggen`, niet-interactief.** Dit is de spiegel van de
   parity-gate in `code-naar-figma` stap 8, die sinds 2026-06 per mismatch captured — deze
   richting deed dat niet, en de drift uit punt 5 hierboven (partner-portal: 16
   parity-fix-commits in 90 dagen volgens die meting) bereikte de eval-loop nooit (gemeten 2026-09-07: één `figma-naar-code`-entry in
   `umanex-os/LEARNINGS.md` tegen zeven voor `code-naar-figma`). Vul de velden vooraf in
   volgens het contract in `vastleggen` (*Niet-interactieve aanroep*):
   - **Header:** `figma-naar-code parity`
   - **Input:** de Figma-node-URL (stap 3) plus het pad van de gebouwde component
   - **Fout:** de concrete diff — property, Figma-waarde, gemeten waarde (`padding-bottom:
     Figma 16 (spacing/4), code 12 (pb-3)`) — of de structurele afwijking (kaart ontbreekt,
     titel 16 i.p.v. 24)
   - **Routing:** afgeleid uit de cwd, niet gevraagd

   De capture blijft staan, ook na de fix: ze registreert dat de mapping op deze input
   faalde en dient als verificatie-test. Nul mismatches is óók een uitkomst — zeg dat dan
   expliciet in het rapport, zodat "geen capture" niet hetzelfde leest als "niet gekeken".

Pas door naar stap 7 als de render visueel overeenkomt met de Figma-referentie **én** de numerieke diff nul verschillen geeft — of expliciet als niet-meetbaar gemeld is. Kan het component niet gerenderd worden (geen preview-pad beschikbaar) → meld expliciet dat de parity-check is overgeslagen; sluit nooit stil af alsof hij geslaagd is.

---

### Stap 7 — Verificatie (token-correctheid)

Aanwezigheid én correctheid. De eerste vier checks vangen hardcoded waarden; de laatste twee vangen het stillere probleem van een bestaand maar verkeerd token.

- [ ] Alle kleuren via een token-referentie (geen losse hex)?
- [ ] Alle spacing via een token-referentie (geen losse px/rem)?
- [ ] Geen hardcoded hex, px of rem buiten token referenties?
- [ ] Props interface ongewijzigd?
- [ ] **Is elk gekozen token het semantisch juiste token, niet alleen een token met de juiste waarde?**
- [ ] **Is de juiste laag gekozen volgens de ladder — component-token waar een rol bestaat, semantisch als default, primitief alleen voor de in klant-CLAUDE.md gemarkeerde primitief-only categorieën?**
- [ ] Ontbrekende token voorstellen bevestigd en gedocumenteerd in de token-lijst?
- [ ] Randen, vullingen en kaarten beoordeeld op **paint**, niet op `strokeWeight` /
      `cornerRadius` — met een tegenproef op een node die er wél en een die er géén heeft?
- [ ] Structurele as meegenomen (kaart ja/nee per blok, onderlijn ja/nee per titel), niet
      alleen tekst en losse waarden?
- [ ] Gemeten op de **gerenderde uitkomst** (`getComputedStyle`), niet op de geschreven
      className — class-merge-lagen kunnen klassen stil verwijderen?
- [ ] Het meetscript zelf draagt een positieve controle die de run laat falen als de meting
      ongeldig is?
- [ ] **Design parity (stap 6) geslaagd — render komt visueel overeen met de Figma-node én de numerieke per-property diff geeft nul verschillen — of expliciet als overgeslagen/niet-meetbaar gemeld?**
- [ ] Elke parity-mismatch uit stap 6 gecaptured via `vastleggen` (niet-interactief, stap 6.9) — of expliciet "nul mismatches" gemeld?
- [ ] States afgeleid uit `reactions` (stap 5), geen speculatieve states toegevoegd?
- [ ] `codebasePath`-scan (stap 3) nagekeken — geen dubbele implementatie van een bestaand component?
- [ ] **Design-snapshot (`<ComponentNaam>.design-snapshot.md`, stap 4b) weggeschreven of bijgewerkt — dekt token-bindings, structuur en states?**

---

## Wanneer native Figma MCP gebruiken

Native MCP is **fallback-only** — nooit de aangewezen tool voor een taak. Toegestaan in:
1. Desktop Bridge is niet actief én de gebruiker kiest expliciet voor native fallback

**Figma Code Connect wordt niet gebruikt** — noch native, noch via Console. Stel geen Code Connect mappings voor of in.

**Eenvoudige taken via native MCP (bij fallback):**
- `get_design_context` voor visueel overzicht (geen token namen, wel code-suggestie)
- `get_variable_defs` voor variabele-waarden op een node (opgeloste hex, geen token paden)

**Let op — dit is waar mapping-kwaliteit stilletjes degradeert.** Native MCP geeft hex terug, geen token-paden. Bij reverse-lookup van hex naar token:

- Eén hex matcht vaak **meerdere** tokens over meerdere lagen heen (een primitief, een semantisch tekst-token, een semantisch border-token en een component-token kunnen dezelfde kleur delen). Een blinde hex-match kiest gegarandeerd soms de verkeerde laag.
- Bij meerdere kandidaten: **altijd voorstel + bevestiging op basis van de context van de node** (waar wordt de kleur toegepast — achtergrond, tekst, border, component-fill?) en kies de juiste laag volgens de ladder in stap 4 — nooit de eerste hex-match pakken
- Gebruik de hex nooit rechtstreeks in code

---

## Token referentie

De gegenereerde token-lijst en het sync-script staan per project — pad in de klant-CLAUDE.md. Houd de lijst vers (zie stap 2).