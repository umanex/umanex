---
name: vastleggen
description: Legt een waargenomen fout van een skill of werkprincipe vast in de juiste LEARNINGS.md, met behoud van de input die de fout uitlokte zodat die later als verificatie-test dient. Gebruik deze skill altijd wanneer de gebruiker een fout van Claude wil vastleggen voor later, of zegt "leg dit vast", "vastleggen", "dit ging fout", "noteer deze les", "capture deze fout", "dit klopt niet, onthoud dit".
---

## Werkwijze

Deze skill is de **capture-helft** van de eval/feedback-loop van umanex-os. Doel: lessen verdampen niet meer, en de input die een fout uitlokte wordt letterlijk bewaard zodat hij later in een fresh sessie als verificatie-test kan dienen.

De skill schrijft naar een `LEARNINGS.md` — de staging-area die los staat van CLAUDE.md. CLAUDE.md blijft schone instructie; LEARNINGS.md is de rauwe vangst waaruit bewezen regels later handmatig naar de juiste CLAUDE.md promoveren. De kop van `umanex-os/LEARNINGS.md` legt de statussen en het format uit; dupliceer die uitleg hier niet.

**Capture moet wrijvingsloos zijn.** Stel alleen de strikt noodzakelijke vragen (zie stap 2 en 3), schrijf, en toon het resultaat. Geen score, geen severity, geen categorie.

### Stap 0 — Sanity check

Gaat dit echt over het vastleggen van een waargenomen fout van een skill of werkprincipe? → door.

Vraagt de gebruiker iets anders (een feature bouwen, een bug in zíjn code fixen, een vraag beantwoorden)? → dit is geen `vastleggen`-taak; zeg dat en stop.

### Stap 1 — Reconstrueer Input en Fout

Twee velden zijn verplicht:

- **Input** — de letterlijke prompt of het bestandspad dat de fout uitlokte. Haal dit uit de conversatie zelf: meestal is het de prompt enkele berichten terug die het foute gedrag triggerde. Citeer letterlijk, niet geparafraseerd. Is het een bestand dat verkeerd verwerkt werd, gebruik dan het volledige pad vanaf project root. Twijfel je welke prompt de trigger was → vraag het kort.
- **Fout** — wat er misging, in 1-2 zinnen. Beschrijf het waargenomen gedrag, niet de fix.

Vul beide zelf in op basis van de conversatie en laat de gebruiker corrigeren; vraag alleen wanneer je het echt niet uit de context kunt afleiden.

**Faalklasse uit de historie — er is geen trigger-prompt.** Komt de klasse niet uit deze sessie maar uit terugkijken (een soort fix die zich herhaalt, een as die geen enkele guard dekt — zie de historie-vragen in `sessie-reflectie`), dan bestaat de uitlokkende prompt niet. Gebruik als **Input** dan een reproduceerbare wijzer die dezelfde rol vervult: het commando dat de klasse zichtbaar maakt (`git log --since="90 days ago" --oneline -- <pad> | grep -iE "..."`) plus de paden die het bewijs dragen. De eis verandert niet — iemand moet er later mee kunnen nagaan of de klasse nog leeft. Verzin nooit een prompt achteraf om het veld te vullen.

### Stap 2 — Identificeer welke skill of welk principe faalde

Bepaal de header-tekst: de naam van de skill (bv. `nieuw-component`) of het werkprincipe (bv. `TC-EBC werkprincipe`, `Git workflow`, `token-mapping`) dat faalde. Kort en herkenbaar — dit wordt de `##`-header van de entry.

### Stap 3 — Bepaal de laag: doe een voorstel, vraag bevestiging

Er zijn **vier** lagen. Stel er zelf één voor mét de reden, en vraag bevestiging (één vraag, vier opties). Een kale vraag — *"globaal, klant, project of skill?"* — legt het denkwerk bij Jeroen terwijl jij de conversatie gelezen hebt en hij ze opnieuw moet reconstrueren; stilzwijgend kiezen mag evenmin, behalve niet-interactief (zie het contract onderaan).

| Laag | Doelbestand | Laag-header | Waar de fix later hardt |
|---|---|---|---|
| **Skill** | `~/Documents/umanex-os/LEARNINGS.md` | `# Skill` | `.claude/skills/{naam}/SKILL.md` |
| **Globaal** | `~/Documents/umanex-os/LEARNINGS.md` | `# Globaal` | `~/Documents/umanex-os/CLAUDE.md` |
| **Klant** | `{repo-root}/LEARNINGS.md` | `# Klant — {naam}` | `{repo-root}/CLAUDE.md` |
| **Project** | `apps/{app}/LEARNINGS.md` | `# Project — {app}` | `apps/{app}/CLAUDE.md` |

**De toets: welke tekst is geladen op het moment dat de fout ontstaat?** Alleen die tekst kan een herhaling voorkomen, en ze verschilt per laag — een `SKILL.md` staat in context zodra die skill is aangeroepen en anders niet; een `CLAUDE.md` in elke sessie van zijn laag. Loop af, eerste treffer wint:

1. **Skill** — de fout zit in een stap, poort of read-back die alléén binnen de procedure van één skill bestaat. Herkenning: stap 2 leverde een skill-naam als header, en de Fout is te herschrijven als *"stap N van `<skill>` deed X niet"*.
2. **Klant / Project** — de fout hangt aan iets dat per klant of per app verschilt: een stack, tokenbron, conventie, afspraak of een pad dat elders niet bestaat. Project wint van klant zodra maar één app hem kan hebben.
3. **Globaal** — de fout kan in élke sessie opduiken, ongeacht klant, app of skill; de discipline komt op midden in het werk zonder dat er een skill geladen is. Herkenning: je kunt de Fout formuleren zonder één skill, klant of app te noemen.

**Skill vs. globaal is de scherpe, en de reden dat deze laag bestaat.** Gemeten op 2026-09-08 in `umanex-os/LEARNINGS.md`: van de 76 entries dragen er **34** een skill-naam in hun header, en **24** `Fix`-regels wijzen naar een pad in `.claude/skills/` — terwijl de tabel tot die dag alleen globaal/klant/project aanbood. Die fixes staan daardoor gelabeld als *"Route B"* (het is geen code) of *"Route A in de skill"* (het is geen CLAUDE.md): een bestemming die in de praktijk het vaakst gebruikt werd, stond nergens in de routing. De toets is niet *"gaat dit over een skill"* maar **"laadt die skill in de situatie waar de regel bijt?"** — dezelfde vraag die `learnings-verwerken` stelt bij een te volle CLAUDE.md-sectie. Treedt de fout óók op buiten de skill → globaal. Alleen erbinnen → skill.

**Bij twijfel: globaal**, en zeg dat het twijfel is. De laag bij capture is een voorstel, geen slot: `learnings-verwerken` stap 2 toetst hem opnieuw vóór er iets hardt en verplaatst de entry als de route elders uitkomt. Een entry op de verkeerde laag verhuist; een entry die nooit vastgelegd is, is weg.

**Path-resolutie** — capture gebeurt vaak in een klant-repo (andere cwd) dan umanex-os zelf:

- **Skill** → altijd het absolute pad `~/Documents/umanex-os/LEARNINGS.md`, ongeacht cwd. Skills zijn umanex-os-bestanden die als **kopie** naar de klant-repo's reizen; een fix in zo'n kopie wordt bij de volgende sync overschreven — dezelfde val als de gesyncte `.umanex-os/CLAUDE.md`. Conditie: dit geldt zolang de skill in umanex-os bestaat. Gemeten 2026-09-08: umanex-apps, Columba en Luminus dragen exact dezelfde 13 skill-namen als `~/Documents/umanex-os/.claude/skills/`, dus een repo-eigen skill bestaat vandaag niet. Twijfel je → `ls ~/Documents/umanex-os/.claude/skills/`; staat hij daar níet, dan is het de klant-laag.
- **Globaal** → altijd het absolute pad `~/Documents/umanex-os/LEARNINGS.md`, ongeacht de huidige werkdirectory.
- **Klant** → de root van de actieve repo: `git rev-parse --show-toplevel`. De `{naam}` in de laag-header is de klantnaam (bv. de repo-/profile-naam: columba, luminus, umanex).
- **Project** → `apps/{app}/LEARNINGS.md` binnen de actieve (monorepo-)klant-repo. Leid `{app}` af uit cwd als die binnen `apps/{app}/…` ligt; anders vraag kort welke app.

**De laag-header `# Skill` draagt geen naam**, anders dan klant en project: de entry-header uit stap 2 noemt de skill al, en noemt er vaak twee (`verify / cyclus-tot-validatie (…)`). Eén header houdt het bestand in één chronologische reeks in plaats van dertien secties van elk een paar entries.

**Edge case:** is de actieve repo umanex-os zélf, dan zijn klant en project niet zinvol — dan blijven skill en globaal over.

### Stap 4 — Bepaal de datum

Haal de datum vandaag op met `date +%F` (Bash). Verzin geen datum en leid hem niet af uit context — altijd ophalen, zodat de entry-datum klopt. Formaat: `YYYY-MM-DD`.

### Stap 5 — Zorg dat het doelbestand bestaat (on-demand creatie)

Bestaat de `LEARNINGS.md` op het doelpad nog niet (typisch bij de eerste capture in een klant-repo of app), maak hem dan eerst aan uit de template:

- Kopieer `~/Documents/umanex-os/templates/LEARNINGS.template.md` naar het doelpad.
- De template bevat de kop, statussen en het format, maar nog geen laag-header — die voegt stap 6 toe bij de eerste entry.

Bestaat het bestand al → niets kopiëren, ga door naar stap 6. Overschrijf een bestaande `LEARNINGS.md` nooit met de template.

### Stap 6 — Append de entry (nooit overschrijven)

Voeg de entry **toe** aan het doelbestand onder de juiste laag-header — overschrijf nooit bestaande inhoud.

Entry-format:

```
## YYYY-MM-DD — {skill of principe dat faalde}
- **Input:** {letterlijke prompt of bestandspad}
- **Fout:** {wat er misging, 1-2 zinnen}
- **Status:** open
```

Regels:
- Bestaat de laag-header al → voeg de entry toe als laatste entry onder die header (na de bestaande entries, vóór een eventuele volgende `#`-header).
- Bestaat de laag-header nog niet → maak hem aan onderaan het bestand, met de entry eronder.
- Nieuwe entries krijgen altijd `Status: open`.
- Gebruik de Edit-tool om gericht in te voegen; herschrijf het bestand niet in zijn geheel.

### Stap 7 — Toon het resultaat

Toon de zojuist toegevoegde entry inline als codeblock, en vermeld het volledige pad van het bestand waarin hij geschreven is. Stilzwijgend opslaan mag niet — de gebruiker moet zien wat vastgelegd is.

---

## Niet-interactieve aanroep — het contract voor skills die deze skill aanroepen

Drie plekken roepen `vastleggen` aan zonder gebruiker in de lus: de gecontroleerde stop van `cyclus-tot-validatie` (drie iteraties zonder convergentie), de parity-gate van `code-naar-figma` stap 8 en de parity-check van `figma-naar-code` stap 6. Tot 2026-09-07 stond "niet-interactief" wel in de aanroepers, maar nergens hier — stap 3 zegt juist *"verplicht, altijd stellen"*. Dit is de vorm die geldt zodra de aanroeper de velden vooraf invult:

- **Header, Input en Fout** komen van de aanroeper, letterlijk. Stap 1 en 2 vervallen; verzin er niets bij. Levert de aanroeper geen Header, dan is het de naam van de aanroepende skill plus de aanleiding (`cyclus-tot-validatie — geen convergentie na 3 iteraties`).
- **Routing** wordt afgeleid in plaats van gevraagd, en de aanroeper bepaalt welke van twee regels geldt. Legt een skill een fout van **zijn eigen procedure** vast — de parity-gate van `code-naar-figma` stap 8, de parity-check van `figma-naar-code` stap 6 — dan is de laag **Skill**, ongeacht cwd: de gefaalde poort staat in die `SKILL.md`. Gaat het om een fout van het **werk** in plaats van de skill — de gecontroleerde stop van `cyclus-tot-validatie` na drie iteraties zonder convergentie — dan beslist de cwd: umanex-os zelf → globaal; een klant-repo (`git rev-parse --show-toplevel`) → klant-laag; een cwd binnen `apps/<app>/` → project-laag. Stap 3 stelt in beide gevallen géén vraag.
- **Stap 4 tot 7 blijven gelijk.** Ook de laatste: de nieuwe entry wordt inline getoond, mét pad. Niet-interactief betekent geen vragen, niet geen zichtbaarheid.
- **Een aanroeper die een veld niet kan leveren, valt terug op de interactieve vorm** en zegt dat. Een entry met een verzonnen Input is erger dan geen entry: hij dient later als verificatie-test.

---

## Bewust niet in deze skill

- **De verify-stap** (input opnieuw afspelen, status → `verified`) en **de promotie-flow** (`LEARNINGS.md` → CLAUDE.md harden, status → `promoted`) horen bij de `learnings-verwerken` skill, niet bij capture. Deze skill zet altijd `open`.
- **Status bijwerken** van bestaande entries hoort niet bij capture; gebruik daarvoor `learnings-verwerken`.
