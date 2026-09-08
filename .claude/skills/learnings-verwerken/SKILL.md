---
name: learnings-verwerken
description: Verifieert openstaande LEARNINGS-entries en hardt bewezen lessen structureel — promotie naar de juiste laag (skill/globaal/klant/project) of een code-guard — en werkt de status bij. Dit is de verwerk-helft van de eval-loop die `vastleggen` opent. Gebruik deze skill altijd wanneer de gebruiker een openstaande learning wil verifiëren, testen of promoveren, een les naar CLAUDE.md wil harden, de feedback-loop wil sluiten, of zegt "verwerk de learnings", "promoveer deze les", "test de openstaande learnings", "verifieer deze learning", "harden naar CLAUDE.md", "sluit de eval-loop".
---

## Werkwijze

Deze skill is de **verwerk-helft** van de eval/feedback-loop van umanex-os; `vastleggen` is de capture-helft. Waar `vastleggen` een fout met zijn letterlijke trigger-input vastlegt op status `open`, neemt deze skill die entry op, **verifieert** of de fout nog optreedt, **hardt** de bewezen les structureel, en werkt de status bij: `open` → `verified` → `promoted`, of `closed` wanneer er niets te harden valt. Per ronde speelt hij bovendien één oudere promotie als steekproef opnieuw af (stap 1b).

Waarom dit nodig is: een entry op `open` in een `LEARNINGS.md` is **inert** — `LEARNINGS.md` wordt nergens in een sessie ingeladen (geen `@`-import, geen hook). Een learning voorkomt een fout pas wanneer de les ergens staat die geladen wordt op het moment dat de fout zou ontstaan: een regel in een CLAUDE.md-laag (elke sessie, via `@`-import), een stap in een `SKILL.md` (alleen wanneer die skill is aangeroepen — genoeg voor een fout die alleen binnen die procedure kan ontstaan, te weinig voor een klasse die daarbuiten ook toeslaat), of een code-guard. Deze skill verzorgt precies die overgang, en stap 2 kiest welke van de drie.

De skill werkt op alle vier de lagen (skill / globaal / klant / project) en reist daarom als repo-bestand mee: hij staat in `.claude/skills/` van umanex-os zelf én — via de sync-pipeline — van elke klant-repo, en triggert dus overal (sinds 2026-08-17; daarvóór user-level via `~/.claude/skills/`). De kop van de bron-`LEARNINGS.md` legt de statussen en het entry-format uit — dupliceer die uitleg hier niet.

### Stap 0 — Sanity check

- Gaat dit over het verifiëren of promoveren van een **bestaande** learning? → door.
- Gaat het over het **vastleggen** van een nieuwe fout? → dat is de `vastleggen` skill, niet deze. Verwijs en stop.
- Iets anders (feature bouwen, een vraag beantwoorden)? → geen `learnings-verwerken`-taak; zeg dat en stop.

### Stap 1 — Bepaal de bron-LEARNINGS en kies de entry(s)

Path-resolutie spiegelt `vastleggen` — dezelfde vier lagen. Bepaal welke `LEARNINGS.md` in scope is:

| Laag | Bron-bestand |
|--------|--------------|
| Skill | `~/Documents/umanex-os/LEARNINGS.md`, sectie `# Skill` (altijd dit absolute pad) |
| Globaal | `~/Documents/umanex-os/LEARNINGS.md`, sectie `# Globaal` (altijd dit absolute pad) |
| Klant | `git rev-parse --show-toplevel` → `{repo-root}/LEARNINGS.md` |
| Project | `apps/{app}/LEARNINGS.md` binnen de actieve klant-repo |

Edge case: is de actieve repo umanex-os zélf, dan zijn alleen skill en globaal zinvol.

Lees de bron en filter entries op status: `open` (te verifiëren) en `verified` (klaar om te promoveren). Toon de te-verwerken entries en vraag welke. Noemde de gebruiker al een specifieke learning → neem die. "Alle" mag, maar verwerk dan één voor één grondig — niet oppervlakkig batchen.

### Stap 1b — Steekproef-regressie: één oudere promotie per ronde

`promoted` bewijst dat een regel geschreven is, niet dat hij blijft werken. Gemeten op 2026-09-07 over 58 promoties in `umanex-os/LEARNINGS.md`: dertien waren Route C (de regel bestond al en vuurde niet), drie recente fouten herhaalden een rail die er al stond, en de enige open entry reproduceerde volledig ná de harding. Niets in de lus toetste een gepromoveerde regel ooit opnieuw — de exit van de lus was daarmee een aanname.

Daarom, **elke ronde, één**: kies de gepromoveerde entry met de oudste (of ontbrekende) `Regressie`-regel waarvan de Input reproduceerbaar is — een letterlijke prompt, een `git log`-wijzer, of een case in `evals/` (de replay-corpus; zie `evals/README.md`). Speel hem blind af volgens stap 3 (geen hint over de verwachte fout; sub-agent of verse sessie naargelang de rail), en schrijf de uitkomst als extra regel ín de entry, vóór de `Status`:

```
- **Regressie:** YYYY-MM-DD — houdt: {één zin wat de replay deed}
- **Regressie:** YYYY-MM-DD — faalt: {wat er opnieuw misging}
```

Houdt hij → klaar; de regel is daarmee een tweede keer gemeten. Faalt hij → de status gaat **niet** terug (deze skill beweegt alleen vooruit), maar er komt een nieuwe `open`-entry met dezelfde Input en als Fout *"regel `<naam>` bestond sinds `<datum>` en vuurde niet"* — die verwerk je in dezelfde ronde als Route C, en dan is instructie alleen aantoonbaar niet genoeg: stel een guard of een deterministisch mechanisme voor. Overslaan mag alleen met reden (geen reproduceerbare entry meer die niet in de laatste 90 dagen is afgespeeld), en die reden staat in je rapport.

Is `claude plugin eval` beschikbaar (gemeten 2026-09-07: nog early access, niet actief), dan is dít de stap die het draait: de cases in `evals/` zijn precies deze inputs met hun graders.

### Stap 2 — Classificeer de fix-route

Bepaal per entry hóe de fout structureel voorkomen wordt. Dit stuurt zowel de verify (stap 3) als de fix (stap 4). Drie routes:

| Route | Wanneer | Fix landt in |
|---|---|---|
| **A — Instructie** | gedragsfout die met een regel te voorkomen is, en die regel **ontbreekt** (of staat te zwak) in de laag die geladen is waar de fout ontstaat | CLAUDE.md-regel, of een stap in `.claude/skills/{naam}/SKILL.md` op de skill-laag (= promotie) |
| **B — Code/tooling** | de fout is het best structureel onmogelijk te maken in een script/config/guard | code-guard (geen CLAUDE.md) |
| **C — Regel genegeerd** | de regel **staat al** in CLAUDE.md maar werd niet nageleefd | versterking van de bestaande regel — niet dupliceren |
| **D — Samenvoegen** | de regel ontbreekt, maar er staat wél een regel van **dezelfde klasse** | die bestaande regel uitbreiden met deze vorm — geen nieuwe rail |

**Route A landt niet altijd in een CLAUDE.md.** Staat de entry onder `# Skill`, dan is het doel een stap in díe `SKILL.md` — dezelfde route, andere bestemming (stap 5). Dat onderscheid ontbrak tot 2026-09-08, en het spoor is meetbaar: **24** `Fix`-regels in `umanex-os/LEARNINGS.md` wijzen naar een pad in `.claude/skills/`, gelabeld als *"Route B"* terwijl er geen code aan te pas kwam, of als *"Route A in de skill"* — een bestemming die de tabel niet kende. Route B blijft wat hij was: script, config, hook of guard.

Route C is de subtiele: promoveren zou de regel kopiëren die er al staat — zinloos. Hier scherp je de bestaande regel aan (prominenter, explicieter, of een harde checklist/rail), of erken je dat instructie alleen niet volstaat en stel je een hook of code-guard voor. Dupliceer nooit een regel die al bestaat.

**Route D is de tegendruk van deze skill.** A, B en C voegen alle drie toe; niets voegt ooit samen, en dat is meetbaar misgegaan. GEMETEN op 2026-08-26: `CLAUDE.md` groeide van 27 207 chars (na de trim van umanex-os#67, 2026-08-10) naar 57 665 in zestien dagen — **+30 458**, waarvan 82% uit `docs()`-promote-commits, en alle groei in vier secties terwijl de vijf secties die niemand promootte exact **0** groeiden. In *Discipline in de Beoordeel-stap* stonden daardoor twaalf rails waar er twee klassen zijn: vijf regels zeiden alle vijf dat een instrument pas iets bewijst als het kan afwijken op het defect dat je zoekt (guard · lege uitkomst · groene uitkomst · vervangen instrument · de tegenproef zelf), en twee dat je een object aan zijn inhoud identificeert en niet aan zijn label. Elke promotie had correct getoetst of díe regel al bestond (de C-check) en nooit of er een **buurregel van dezelfde klasse** stond.

Een regel die verdunt tussen elf buren wordt niet nageleefd, hoe juist hij ook is — dat weegt zwaarder dan het token-budget, want de kost van de laag zelf is klein (52 302 chars ≈ 1,5% van een 1M-context). De vraag bij Route D is dus niet "past dit erbij" maar **"leest een volgende sessie hier één ding of twee?"**

Toets vóór je in stap 4 een nieuwe regel schrijft, in deze volgorde:

1. Staat deze regel er al? → Route C.
2. Staat er een regel van dezelfde **klasse** — zelfde grondfout, andere verschijningsvorm? → **Route D**: voeg jouw vorm toe aan die regel, met zijn gemeten geval, in plaats van een rail ernaast. Het gemeten bewijs blijft altijd staan; alleen de kop en de inleidende zin verdwijnen.
3. Geen van beide? → Route A.

Herkenningsteken voor stap 2: je nieuwe kop zou beginnen met dezelfde werkwoordsvorm of hetzelfde object als een bestaande (*"Een lege meting vraagt…"* naast *"Een groene check vraagt…"*), of je schrijft in je eigen inleiding een zin als "de vorige regel vangt X, deze vangt Y" — dat is geen afbakening maar de bekentenis dat het één regel is.

**Verwijzen naar de buurregel is niet hetzelfde als ermee samenvallen.** Toets dit voor je samenvoegt, want anders gaat D af op elke regel die netjes naar zijn buur verwijst. Gemeten op 2026-08-26 bij de tegenproef op deze route: *Nooit een destructief pad tegen productiedata* opent met "Dit begrenst de vorige regel" en moet júíst apart blijven — hij zet een **tegengestelde kracht** naast *Verifieer op het doelwit van de gebruiker* (doe het echt · maar niet op data die iemand gebruikt). Twee vormen van één klasse voeg je samen; een regel die zijn buur inperkt, weerspreekt of er een uitzondering op is, blijft staan — anders verdwijnt de spanning die hem betekenis geeft. Het onderscheid zit in het werkwoord: *"vangt ook"* → samenvoegen, *"begrenst"* / *"behalve"* / *"tenzij"* → apart houden.

**Uitzondering — een regel met een uitvoerbaar recept blijft een eigen rail.** Draagt jouw vorm een concreet commando, een vaste vorm of een herbruikbaar snippet, dan verdwijnt dat in een variant-opsomming: niemand vindt een `awk`-oneliner terug die als bijzin onder een andere kop hangt. GEMETEN op 2026-08-27, de eerste echte toepassing van deze route: de klasse *"anker op het object, niet op wat het instrument teruggeeft"* had een derde vorm gekregen (een `grep -n` toont de `Status` van een lus-entry nooit — gemeten over 79 entries in de drie lus-bestanden: gemiddeld +4,4 tot +4,9 regels onder de kop, staart op +11). D zei samenvoegen; Jeroen koos apart, en had gelijk — die regel draagt het recept `awk '/^## /{h=$0} /^- \*\*Status:\*\*/{print $3"\t"h}' <bestand> | grep -i '<kernwoord>'`, en dat moet vindbaar blijven als eigen kop. De toets is dus tweeledig: zelfde klasse **én** geen eigen recept → samenvoegen; zelfde klasse mét een recept → eigen rail, met een verwijzing naar de verwante regel. De tweede entry van diezelfde ronde (een ongemeten schatting in een `AskUserQuestion`-optie) had géén recept en is wél samengevoegd met *Een verwachtingswaarde is geen meting*.

**Verwacht geen grote besparing van D.** Gemeten bij de consolidatie van 2026-08-26: vier instrument-regels 3 620 → 3 325 chars (−295), het anker-paar 2 720 → 2 587 (−133). Het bewijs blijft immers staan, en dat is het meeste van de tekst. De winst is leesbaarheid — tien rails in plaats van twaalf — niet omvang. Wie omvang wil, verhuist een blok naar een skill (zie hieronder); dat leverde dezelfde dag −5 320 op.

**Wanneer een sectie te vol is voor D alleen.** Passeert een sectie de tien rails, dan is de volgende promotie het moment om te vragen of een blok naar een skill kan in plaats van erbij — met de toets uit de resolved HANDOFF van 2026-08-10: niet *"staat dit ook in een skill"* maar **"laadt die skill in de situatie waar de regel bijt?"**. Een rail die in élke sessie bijt (het merge-protocol, de discipline-regels) blijft inline, ook als hij lang is; een blok dat alleen bij een zeldzame, herkenbare beslissing bijt (de worktree-procedure) hoort in een skill met een trigger-beschrijving die op die beslissing aanslaat.

Bij twijfel A vs C: lees éérst de doel-CLAUDE.md of de regel er al staat.

### Stap 3 — Verifieer

Doel: bewijs of de fout nog optreedt. De methode volgt uit de route.

**Route A & C — replay van de trigger-input.** Twee methodes; kies op geldigheid:

- **Sub-agent replay (geautomatiseerd, default).** Spawn een sub-agent met *uitsluitend* de letterlijke `Input` uit de entry als prompt — **geef geen hint over de verwachte fout**, anders besmet je de test (de sub-agent zou de fout dan bewust ontwijken). Jij (hoofd-agent) bent de scheidsrechter: vergelijk het gedrag en de output van de sub-agent met de vastgelegde `Fout`.
  - Fout treedt nog op → de fix ontbreekt of werkt niet → blijf `open`, ga naar stap 4.
  - Fout treedt niet meer op → kandidaat voor `verified`.
- **Begeleide fresh sessie (handmatig — voor main-agent-only gedrag).** Sommige principes gelden per definitie alleen in de main-agent context — TC-EBC schrijft bijvoorbeeld expliciet voor dat het *niet* aan een sub-agent uitbesteed wordt. Een sub-agent replay is daar **ongeldig**. Geef Jeroen dan de exacte input om in een verse top-level sessie te plakken, plus wat te observeren, en laat hem het resultaat terugrapporteren. Valideer de verwachte outputs van dat test-plan (paden, bestandsnamen) éérst tegen de actieve klant-/projectoverrides — een fout verwacht-pad maakt het test-plan een valse oracle die een correcte replay als mislukt zou markeren.

Wees eerlijk over de grens van sub-agent replay: de sub-agent krijgt wél de CLAUDE.md-context mee (precies wat we willen testen), maar is geen 100% verse top-level sessie. Voor reproduceerbare, niet-main-agent-only inputs is het een geldige eerste test. Eist Jeroen hardere zekerheid voor `verified`, dan een echte verse sessie.

**Route B — verifieer de guard.** Geen replay nodig: lees de guard/code, of draai hem droog met de oorspronkelijke input, en bevestig dat hij nu weigert of waarschuwt zoals bedoeld.

Kun je de fout niet betrouwbaar repliceren (te breed, niet-deterministisch, te duur)? Zeg dat, **verzin geen bewijs**, en laat de status op `open` — of zet `verified` alleen met Jeroens expliciete akkoord.

### Stap 4 — Hard de fix (alleen als de fout nog optreedt)

Treedt de fout bij verify niet meer op → de fix bestaat al; sla deze stap over en ga naar stap 6 (status → `verified`/`promoted` naargelang er al een regel/guard is).

Treedt hij nog op → hard hem nu, volgens de route:

- **Route A** — schrijf de regel in de juiste laag (routing in stap 5), in de juiste **bestaande** sectie: een git-regel onder *Git workflow*, niet willekeurig onderaan. Op de **skill-laag** is dat een stap, poort of acceptatie-regel ín `.claude/skills/{naam}/SKILL.md`, op de plek in de procedure waar de fout ontstond — niet een losse waarschuwing onderaan de skill.

**Splits altijd kern van bewijs — dit is waar de laag scheefgroeit.** Landt je regel in de **Beoordeel-discipline** (het blok onder *Plan / Bouw / Beoordeel*), dan gaat alleen de **kern-bewering** naar `CLAUDE.md` en hoort het **gemeten geval** in `.claude/skills/verify/SKILL.md`, als genummerde rail. Die skill draagt sinds zijn eerste versie de zin *"Deze staan als werkprincipe in CLAUDE.md; hier zijn ze operationeel"* — de scheiding bestond dus al, en niets bewaakte hem. GEMETEN op 2026-08-27: het blok stond op 15 199 chars met 17 gemeten gevallen inline tegen 4 in `verify`, terwijl de elf kern-beweringen samen 569 chars zijn — **5%**. Na de splitsing: blok 5 855, `CLAUDE.md` 55 749 → 46 404.

Twee dingen die inline blijven, ook al zijn ze lang: een **uitvoerbaar recept** (een `awk`-oneliner, `out=$(cmd); rc=$?`) — dezelfde uitzondering die Route D hierboven maakt — en de **conditie** waaronder een regel bijt, want zonder die conditie is een kern-bewering niet toepasbaar.

`scripts/test-discipline-blok.sh` bewaakt dit in `contract-tests.yml` en **blokkeert**: nul gemeten gevallen in het blok, blok onder 7 000 chars, en `verify` moet er aantoonbaar wél dragen — die derde is de positieve controle op de eerste twee, want "geen bewijs in CLAUDE.md" is pas goed nieuws als het érgens anders staat.
- **Route D** — voeg je vorm toe aan de bestaande regel van dezelfde klasse: neem zijn kop over, hang jouw variant eronder met zijn gemeten geval, en schrap je eigen inleidende afbakening. Gooi geen bewijs weg — dat is precies de *waarom* die maakt dat een regel nageleefd wordt in plaats van wegberedeneerd. Staan er na het samenvoegen twee koppen die hetzelfde zeggen, dan was het één regel.
- **Route C** — scherp de bestaande regel aan op zijn huidige plek; voeg geen duplicaat toe. Leg je voorgestelde versterking expliciet naast de bestaande regel-tekst: herhaalt ze enkel wat er al staat, dan is het een verkapt duplicaat — schrappen. Alleen écht nieuwe handhaving (bv. een deterministische hook in `settings.json`) is een legitieme versterking; die landt dan in `settings.json`, niet als herhaalde regel in CLAUDE.md.
- **Route B** — implementeer/repareer de guard in code. Valt dat buiten een instructie-wijziging, meld het als aparte code-taak.

**Kritieke valkuil — de gesynced kopie.** Een **globale** regel hardt je ALTIJD in `~/Documents/umanex-os/CLAUDE.md`, NOOIT in een lokale `.umanex-os/CLAUDE.md` binnen een klant-repo — die is een gesyncte kopie en wordt bij de volgende sync overschreven. Klant- en projectregels gaan wél naar de echte repo-CLAUDE.md (`{repo-root}/CLAUDE.md`, `apps/{app}/CLAUDE.md`) — dat zijn geen kopieën.

**Dezelfde val geldt voor de skill-laag.** `.claude/skills/` reist mee met de sync — `templates/refs-check.mjs` rekent het expliciet tot wat meereist, naast `CLAUDE.md` en `profiles/` — dus een skill-fix hardt ALTIJD in `~/Documents/umanex-os/.claude/skills/{naam}/SKILL.md`, nooit in de kopie binnen een klant-repo.

CLAUDE.md is gedeelde, hoog-hefboom instructie (de globale laag propageert naar álle repos). Behandel een wijziging eraan als een "altijd eerst bevestigen"-actie: toon de voorgestelde regel-tekst en de exacte doellocatie, en vraag akkoord vóór je schrijft.

### Stap 5 — Routing van de promotie

Spiegelt `vastleggen`, omgekeerd: van LEARNINGS-laag naar de corresponderende doellaag. De laag blijkt uit de header (`# Skill` / `# Globaal` / `# Klant — {naam}` / `# Project — {app}`) waaronder de entry staat.

| Laag | LEARNINGS-bron | Doel van de harding |
|---|---|---|
| Skill | `~/Documents/umanex-os/LEARNINGS.md`, sectie `# Skill` | `~/Documents/umanex-os/.claude/skills/{naam}/SKILL.md` |
| Globaal | `~/Documents/umanex-os/LEARNINGS.md`, sectie `# Globaal` | `~/Documents/umanex-os/CLAUDE.md` |
| Klant | `{repo-root}/LEARNINGS.md` | `{repo-root}/CLAUDE.md` |
| Project | `apps/{app}/LEARNINGS.md` | `apps/{app}/CLAUDE.md` |

**De header is het startpunt, niet het slot.** `vastleggen` kiest de laag bij capture, wanneer alleen het gedrag bekend is; hier weet je pas na stap 2 wáár de regel geladen moet zijn om te bijten. Wijst de route elders uit — een `# Globaal`-entry waarvan de fout alleen binnen één skill kan ontstaan, of omgekeerd een `# Skill`-entry waarvan de klasse óók buiten die skill optreedt — verplaats de entry dan naar de juiste laag-header vóór je hardt, en noem die verhuizing in stap 8. De toets is dezelfde als in `vastleggen` stap 3: **laadt die tekst in de situatie waar de regel bijt?**

### Stap 6 — Werk de entry bij

Gericht met de Edit-tool — nooit het bestand herschrijven (spiegelt `vastleggen`s append-discipline). Werk de `Status`-regel bij en voeg een `Fix`-regel toe die zelf-documenteert hóe en wáár het opgelost is:

- Verify gedaan, fout weg, nog niet gehard naar een regel/guard → `Status: verified`.
- Verify gedaan en er valt **niets te harden** — de fout bleek een meetfout, de fix zit in het werk zelf (een rebind, een script, een gecorrigeerd bestand) of de klasse is vervallen → `Status: closed`, met de reden in de `Fix`-regel. Zonder deze uitgang blijft de entry eeuwig op `verified` en verschijnt hij elke sessiestart (Columba: vier parity-entries, 83 dagen). `closed` is een eindstatus: hij verschijnt niet meer in de hook en telt niet mee in `doctor.sh`.
- Regel gehard naar CLAUDE.md of naar een stap in `SKILL.md` (route A/C/D) of guard gebouwd/bevestigd (route B) → `Status: promoted`.
  - **Route B-drempel:** `promoted` mag alleen als de guard de volledige faalklasse van de learning dekt, niet enkel de letterlijke gecapturede input. Dekt hij de gecapturede conditie maar laat een adversariële check verwante gaten van dezelfde klasse open, hou dan `verified` en open een losse code-taak — promoveren zou impliceren dat het gat dicht is.

Voeg de `Fix`-regel in vóór de `Status`-regel (zoals de bestaande `verified` entries), in dit format:

```
- **Fix:** {wat opgelost is en waar — CLAUDE.md-sectie of commit-ref}. Input opnieuw afgespeeld → {uitkomst}.
- **Status:** verified
```

### Stap 7 — Git

Commit de CLAUDE.md- en LEARNINGS-wijzigingen volgens de globale git-workflow — **nooit direct op main**:

1. Feature branch: `docs/promote-{kort}` voor regel-harding, of `chore/...` / `fix/...` naargelang de wijziging.
2. Commit (Conventional Commits, Engels).
3. Betreft het de **globale laag** (`~/Documents/umanex-os/CLAUDE.md`) of de **skill-laag** (`~/Documents/umanex-os/.claude/skills/`), dan rolt de merge naar main de gehardende regel via de sync-pipeline uit naar álle klant-repos — beide reizen mee. Dat is de bedoeling — maar het is een merge naar main: geef de korte melding vooraf (globale CLAUDE.md, *Git workflow*).
4. PR aanbieden of openen volgens conventie.

### Stap 8 — Toon het resultaat

Niet stilzwijgend afronden. Toon per verwerkte learning, inline: de route (A/B/C), de verify-methode + uitkomst, wat er in welke CLAUDE.md of guard gewijzigd is (vol pad vanaf repo-root), de nieuwe status, en de git-stappen.

---

## Bewust niet in deze skill

- **Nieuwe fouten vastleggen** — dat is `vastleggen`. Deze skill verwerkt alleen bestaande entries.
- **Bewijs verzinnen** — een fout die niet betrouwbaar te repliceren is, blijft `open`; `verified` vereist echt bewijs of Jeroens expliciete akkoord.
- **Globale regels in de gesynced kopie schrijven** — globale harding hoort altijd in `~/Documents/umanex-os/`, nooit in een klant-repo's `.umanex-os/`.
- **Status terugdraaien** — deze skill beweegt alleen vooruit (`open` → `verified` → `promoted`). Een eerder gepromoveerde regel terugnemen doe je handmatig.
