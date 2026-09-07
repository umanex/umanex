---
name: sessie-reflectie
description: Sluit een werksessie af met een kritisch, eerlijk retrospectief dat de vluchtige context vastlegt vóór ze verdampt, en routeert elke bevinding naar de juiste plek (eval-loop, auto-memory of HANDOFF). Open handoff-items komen bij de start van een volgende sessie automatisch mee. Gebruik deze skill altijd wanneer de gebruiker een sessie wil afsluiten of terugblikken, of zegt "sluit de sessie af", "reflecteer op deze sessie", "sessie-reflectie", "blik terug", "wat nemen we mee", "session-end", "retro".
---

## Werkwijze

Deze skill is het **eind-van-sessie retrospectief** van umanex-os. Doel: de context die aan het einde van een sessie in het hoofd van Claude zit — waar was ik het minst zeker over, welke aanname bleef onuitgesproken, wat breekt over 3 maanden, wat is de eerste zet volgende keer — verdampt niet meer, maar komt bij de start van een volgende sessie automatisch mee.

Dit is een **router, geen nieuw silo** (root cause boven patch). De reflectie is een *feeder* die elke bevinding naar het juiste bestaande huis stuurt:

| Soort bevinding | Route |
|---|---|
| Terugkerende **faalklasse** / "wat had vlotter gekund" dat structureel is | → `vastleggen` (LEARNINGS, de eval-loop) |
| **Durend feit** over Jeroen of het project | → auto-memory |
| **Werk dat benoemd is maar niet gebouwd** (scope-drop, P3-bevinding) | → `BACKLOG.md` |
| **Vooruitkijkend & sessie-gebonden** (onzekerheid, aanname, risico, next-step, idee, debt) | → `HANDOFF.md` (deze skill schrijft hier) |

Alleen die laatste categorie schrijft deze skill zelf weg. De rest voedt bestaande loops — dupliceer een fout nooit in HANDOFF; die hoort in LEARNINGS met zijn verificatie-input.

Een backlog-item hoort er normaal al te staan: de globale regel legt op dat een scope-drop bij de mélding wordt vastgelegd, niet bij de reflectie. Deze skill is daar het vangnet voor, niet de hoofdweg — zie stap 2.

**Eerlijk, niet vleiend.** De waarde zit in wat Claude zélf naar boven haalt. Noem echte zwaktes, onzekerheden en blinde vlekken — geen geruststelling. Een reflectie zonder ongemakkelijke bevinding is meestal een gemiste reflectie.

### Stap 0 — Sanity check

Gaat dit over het afsluiten van / terugblikken op de sessie? → door.

Vraagt de gebruiker iets anders (bouwen, fixen, een vraag beantwoorden)? → dit is geen `sessie-reflectie`-taak; zeg dat en stop.

Was de sessie triviaal of leeg (geen substantieel werk)? → zeg dat er weinig te reflecteren valt en houd het kort; forceer geen bevindingen.

### Stap 1 — Sluit de lus achterwaarts: consumeer openstaande HANDOFF-items

Vóór je vooruitkijkt, kijk terug. Lees de relevante `HANDOFF.md` (repo-root en, indien van toepassing, `apps/{app}/`). **Draai de `Check` van elk open item** — dat veld staat er juist voor, en een check die door niets aangeroepen wordt meet niets. Heeft een ouder item nog geen check, beoordeel het dan met de hand en voeg er meteen een toe. Ga daarna na of déze sessie het item heeft opgepakt of beantwoord. Zo ja: zet de `Status` op `resolved` (via de Edit-tool, gericht — niet het bestand herschrijven). Zo voorkom je dat HANDOFF enkel aangroeit en de SessionStart-hook lawaaierig wordt.

**Items ouder dan 30 dagen krijgen hier een beslissing, geen herhaling.** De SessionStart-hook toont per bestand alleen de vijf jongste open items en telt de rest — lees dus het bestand zelf, niet de hook-output. Oudste eerst:

```bash
awk '/^```/{b=!b;next} b{next} /^## 20/{d=substr($0,4,10);t=substr($0,4)} /^- \*\*Status:\*\* open/{print d"\t"t}' HANDOFF.md | sort
```

Voor elk item ouder dan 30 dagen kies je expliciet één van drie: **resolved** (de check zegt dat het niet meer leeft, of het antwoord is intussen gegeven), een **`BACKLOG.md`-item** (het is werk dat blijft liggen — verplaats het, met de check als *Eerste zet*, en zet het HANDOFF-item op resolved met een verwijzing), of een **herformulering** met een scherpere check en een nieuwe datum. Een item dat je een derde keer laat staan zonder een van die drie, is het bewijs dat de check niet werkt. Gemeten op rowtrack (2026-09-07): 29 open, mediaan 53 dagen, 22 ouder dan 30 — een lijst die elke sessiestart werd overgeslagen.

Zijn er geen HANDOFF-bestanden of geen open items → sla deze stap over.

### Stap 2 — Beantwoord de reflectievragen (eerlijk, gegroepeerd)

Beantwoord de volgende vragen zelf, op basis van wat er déze sessie echt gebeurde. Toon ze inline, gegroepeerd. De gebruiker mag reageren en bijsturen.

**Vertrouwen & blinde vlekken**
- Waar ben ik nu het minst zeker over?
- Wat is het grootste ding dat ik mis / niet besef over de situatie?
- Welke van mijn outputs deze sessie is het meest waarschijnlijk fout en verdient een dubbele check?

**Aannames & beslissingen**
- Welke aannames heb ik gemaakt die ik nooit expliciet heb uitgesproken?
- Welke beslissing moeten we heropenen als een onderliggende aanname verandert (en welke aanname)?
- Welke bewust genomen patch / shortcut / TODO gaat bijten als hij blijft staan? (haakt aan *root cause boven patch*)

**Toekomst-risico & kans**
- Als dit over 3 maanden breekt, wat is dan de meest waarschijnlijke reden?
- Als ik één unrequested, industry-leading feature mocht toevoegen, welke?
- Wat is nu ontgrendeld / makkelijker geworden dat we volgende keer moeten uitbuiten?

**Proces & handoff**
- Wat had de gebruiker anders kunnen doen om deze sessie vlotter te maken?
- Welke context moest ik deze sessie reconstrueren die ergens opgeschreven had moeten staan?
- Wat is de #1 eerste zet voor de volgende sessie?

**Scope-drops die niet geland zijn**
- Wat heb ik deze sessie benoemd als buiten scope, geparkeerd, "niet gebouwd", "voor later" of P3 — en staat dat effectief in een `BACKLOG.md`? Loop je eigen antwoorden na, niet je geheugen.
- Elke drop die er niet staat, schrijf je nu alsnog weg (of je motiveert waarom hij geen item verdient). Dit is een vangnet: de regel zegt dat het bij de mélding gebeurt, en dat het hier nog nodig is, is zelf een signaal.
- Grep vóór het schrijven de andere twee lussen op het onderwerp — `HANDOFF.md`, `LEARNINGS.md`, root én app — **inclusief de `resolved` HANDOFF-entries**: die toont de hook niet meer. Op rowtrack schreef een sessie zo een BACKLOG-item ("de node:test-suites draaien niet in CI") dat een twaalf dagen eerder gesloten HANDOFF-item mét tegenproef tegensprak. Een treffer die het tegendeel beweert is een tegenspraak die je eerst verklaart, geen item.

**Faalklassen uit de historie** (niet uit deze sessie)
- Welke soort fix herhaalt zich in de recente historie van wat ik aanraakte? Draai `git log --since="90 days ago" --oneline -- <pad>` en lees de `fix(...)`-onderwerpen als één lijst: staan er meerdere die hetzelfde soort ding rechtzetten, dan is dat één faalklasse die per instantie gepatcht wordt.
- Dekt een bestaande guard, test of CI-stap die klasse? Zo niet: welke as blijft ongemeten?

Deze twee vragen zijn de enige ingang voor een faalklasse die **niemand in de sessie gezien heeft**. `vastleggen` triggert normaal op "de gebruiker zag mij iets fout doen"; een klasse die alleen bij terugkijken zichtbaar wordt, komt er zonder deze stap nooit in. Sla ze dus niet over omdat de sessie zelf goed liep — dat is precies wanneer ze iets opleveren.

### Stap 3 — Triage: routeer elke bevinding

Loop de antwoorden af en bepaal per bevinding de route (zie de tabel bovenaan):

- **Faalklasse** (structureel, terugkerend gedrag van een skill/principe) → roep `vastleggen` aan, of markeer het expliciet als kandidaat daarvoor. Niet in HANDOFF proppen.
- **Durend feit** (voorkeur, rol, project-constraint niet-afleidbaar uit code) → schrijf naar auto-memory, of stel de memory-regel voor.
- **Vooruitkijkend & sessie-gebonden** → gaat naar HANDOFF (stap 4–6).

Een bevinding zonder duidelijke vooruitkijkende actie hoeft niet bewaard — bewaar wat een volgende sessie echt vooruithelpt, niet elk antwoord.

### Stap 4 — Bepaal scope/laag + datum

HANDOFF is gelaagd zoals LEARNINGS. Bepaal per bevinding het niveau:

| Niveau | Doelbestand | Laag-header |
|--------|-------------|-------------|
| Globaal | `~/Documents/umanex-os/HANDOFF.md` | `# Globaal` |
| Klant | `{repo-root}/HANDOFF.md` (`git rev-parse --show-toplevel`) | `# Klant — {naam}` |
| Project | `apps/{app}/HANDOFF.md` | `# Project — {app}` |

Path-resolutie identiek aan `vastleggen`. Is de actieve repo umanex-os zelf → leg globaal vast. Haal de datum op met `date +%F` (verzin hem niet).

### Stap 5 — Zorg dat HANDOFF.md bestaat (on-demand)

Bestaat het doel-`HANDOFF.md` nog niet, kopieer dan eerst `~/Documents/umanex-os/templates/HANDOFF.template.md` naar het doelpad. Bestaat het al → niets kopiëren. Overschrijf een bestaande `HANDOFF.md` nooit.

### Stap 6 — Append de vooruitkijkende bevindingen (nooit overschrijven)

Voeg elke vooruitkijkende bevinding toe onder de juiste laag-header. Entry-format:

    ## YYYY-MM-DD — {korte titel} · [{type}]
    - **Bevinding:** {1-2 zinnen}
    - **Check:** {hoe je in één handeling vaststelt of dit nog openstaat}
    - **Volgende zet:** {concreet actiepunt of "-"}
    - **Status:** open

`{type}` ∈ `onzekerheid` · `aanname` · `risico` · `next-step` · `idee` · `debt`.

**`Check` is verplicht, en hij is het punt van de entry.** `Bevinding` legt een waarneming van nú vast; die wordt onwaar zodra de code eronder verandert, en niets merkt dat — het item blijft elke ochtend terugkomen als openstaand werk. De check zegt hoe je vaststelt of het nog leeft: een commando bij voorkeur (`grep -q 'periodType' apps/rowtrack/lib/period.ts`), anders een vraag met een eenduidig antwoord. Kun je er geen formuleren, dan is de bevinding te vaag — herformuleer haar.

Regels: bestaat de laag-header al → entry eronder toevoegen; anders header onderaan aanmaken. Nieuwe entries krijgen altijd `Status: open`. Gebruik de Edit-tool gericht; herschrijf het bestand niet.

### Stap 7 — Toon het resultaat

Toon inline: (a) welke open HANDOFF-items je op `resolved` zette, (b) de nieuwe HANDOFF-entries met hun pad, (c) wat naar `vastleggen` / auto-memory gerouteerd is, en (d) expliciet de **#1 eerste zet voor de volgende sessie**. Stilzwijgend opslaan mag niet.

---

## Bewust niet in deze skill

- **Fault-capture met verificatie-input** (letterlijke prompt bewaren als test) — dat is `vastleggen`. Deze skill routeert een faalklasse dáárheen, maar legt hem niet zelf als LEARNINGS-entry vast.
- **Verifiëren en promoveren** van lessen naar CLAUDE.md — dat is `learnings-verwerken`.
- **CLAUDE.md-regels schrijven** — proces-inzichten die hardening verdienen lopen via de eval-loop, niet direct vanuit de reflectie.
- **De consumptie bij sessiestart** — die doet de user-level SessionStart-hook (`session-start-handoff.sh`, geïnstalleerd door `sync-os.sh`) automatisch. Deze skill is enkel de productie-kant.
- **Automatisch triggeren bij sessie-einde** (Stop-hook) is v2 — nu wordt de skill manueel opgeroepen.
