# LEARNINGS.md — waargenomen fouten (staging)

Dit bestand is de **rauwe vangst** van momenten waarop een skill of werkprincipe faalde. Het staat los van CLAUDE.md: CLAUDE.md blijft schone instructie, LEARNINGS.md is de staging-area waaruit bewezen regels later naar de juiste CLAUDE.md **promoveren**.

Entries komen erbij via de `vastleggen` skill; verifiëren en promoveren gebeurt via de `learnings-verwerken` skill. Niet handmatig bewerken tenzij je een status corrigeert.

Entries op `open` en `verified` worden bij de start van een volgende sessie automatisch getoond via de user-level SessionStart-hook (`~/.claude/hooks/session-start-handoff.sh`), samen met de open HANDOFF-items. Een entry blijft dus zichtbaar tot hij gepromoveerd is — dat is de bedoeling: een entry die niemand meer ziet, hardt nooit.

## Waarom dit bestaat

Lessen verdampen anders. Door de fout én de **letterlijke input die hem uitlokte** te bewaren, wordt elke entry later herbruikbaar als verificatie-test: speel de input opnieuw af in een fresh sessie en kijk of de fout weg is.

## Statussen

Een entry doorloopt drie statussen, met één zijuitgang:

- `open` — vastgelegd, nog niet gefixt.
- `verified` — gefixt én de input opnieuw getest in een fresh sessie; de fout is weg.
- `promoted` — de regel is gehard naar de juiste CLAUDE.md-laag (globaal / klant / project) of naar een code-guard.
- `closed` — verwerkt, maar er valt niets te promoveren: de fout bleek een meetfout, de fix zit in het werk zelf (een rebind, een script) of de klasse is vervallen. **Reden verplicht** in de `Fix`-regel. Zonder deze uitgang blijft zo'n entry eeuwig op `verified` staan en verschijnt hij elke sessiestart — gemeten op Columba: vier parity-entries, 83 dagen op `verified` zonder dat er een regel te harden was.

Alleen `open` en `verified` verschijnen bij sessiestart. Geen score, geen severity, geen categorie. Bewust minimaal — capture moet wrijvingsloos zijn.

**Regressie ná promotie.** `promoted` bewijst dat een regel geschreven is, niet dat hij blijft werken: van de 58 promoties in umanex-os (gemeten 2026-09-07) waren er dertien Route C — de regel bestond al en vuurde niet. Daarom speelt `learnings-verwerken` per ronde één oudere gepromoveerde entry als steekproef opnieuw af en noteert de uitkomst als extra regel ín de entry, vóór de `Status`:

```
- **Regressie:** YYYY-MM-DD — houdt | faalt: {één zin}
```

Faalt de steekproef, dan gaat de status **niet** terug (de skill beweegt alleen vooruit) maar komt er een nieuwe `open`-entry met dezelfde Input en de regel die niet vuurde als Fout — Route C bij verwerking.

## Format

Elke entry staat onder een laag-header (`# Globaal`, `# Klant — {naam}`, `# Project — {app}`) en heeft deze vorm:

```
## YYYY-MM-DD — {skill of principe dat faalde}
- **Input:** {letterlijke prompt of bestandspad dat de fout uitlokte}
- **Fout:** {wat er misging, 1-2 zinnen}
- **Status:** open
```

<!-- De vastleggen skill voegt hieronder de juiste laag-header toe bij de eerste capture. -->
