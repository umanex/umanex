# CSV-prospectbron

---
Datum:   2026-09-08
Type:    feature
Project: jobradar
Klant:   umanex
Status:  gepland
---

---

```
TASK:        Een aangeleverde CSV met potentiële bedrijven wordt een eigen prospect-bron
             naast de KBO-lijst, met de omvang- en financiële kolommen als context.

CONTEXT:     jobradar kent vandaag twee herkomsten: leads (uit vacaturedata, tabel
             `companies`) en prospects (uit de KBO-spiegel, via `/api/prospects`).
             Dit wordt de derde. De sleutel is het ondernemingsnummer — dezelfde die
             `prospect_status` al gebruikt — dus statussen zijn deelbaar zonder mapping.
             Gemeten op het geleverde bestand (218 rijen, 2026-09-08): 215 zitten in de
             spiegel, alle 215 actief en met volledig zeteladres; 178 vallen al binnen de
             NACE-zeef van het bestaande prospect-universum. Overlap is dus de regel —
             de bron moet die tonen, niet verdubbelen.

ELEMENTS:    - Import-CLI `pnpm --filter jobradar prospects:import <pad.csv>`
             - Tabel `csv_prospects` (ondernemingsnummer PK + de negen CSV-kolommen
               + `imported_at` + `bestandsnaam`)
             - Herkomst-filter als segmented control ín de bestaande `FilterBar`,
               naast het regio- en statusfilter: KBO · CSV · beide
             - Omvang- en EBITDA-regel op `ProspectCard`, alleen voor CSV-rijen
             - Lege staat: nog niets geïmporteerd, mét het commando dat dat oplost

BEHAVIOUR:   - Import is idempotent: hetzelfde bestand twee keer laat de rijen ongemoeid
               en werkt alleen `imported_at` bij
             - Een bedrijf dat óók in de KBO-lijst zit is één rij met twee herkomst-labels,
               nooit twee kaarten
             - De 3 nummers zonder KBO-treffer blijven zichtbaar met wat de CSV zelf
               draagt (naam, stad) — stil weglaten is de faalklasse die deze app vermijdt
             - Import raakt `prospect_status` niet aan
             - De financiële kolommen sorteren en filteren, maar voeden geen score

CONSTRAINTS: - Het CSV-bestand blijft buiten git: pad als argument, opslag in `.data/`
             - Geen upload-route — deze app heeft geen auth
             - Bedragen afgerond in de UI (k€/M€), de ruwe waarde blijft in de DB
             - `@umanex/config/tailwind/preset` + `@umanex/ui`, geen lokale primitives
             - SQLite-migratie: `SCHEMA_VERSION` 6 → 7
```

---

**Bronbestand.** `~/Downloads/signumi-companies (1).csv` — 29.302 bytes, sha256
`f1c54415c16c16b1ab3a9bc8b2b41359c05d0d9c378b7696a9fd96ebe4f462d6`, 218 datarijen,
geleverd 2026-09-08. Elke meting hieronder slaat op precies deze inhoud: een nieuwe
export vraagt een nieuwe meting, geen overgenomen getal. Geparkeerd op 2026-09-08 als
`apps/jobradar/.data/prospects-signumi-2026-09-08.csv` (byte-voor-byte identiek, zelfde
sha256) — dát is het pad waartegen de import draait. Het origineel in `~/Downloads` draagt
een `(1)`-suffix en overleeft de volgende download niet; `.data/` staat in `.gitignore`
(`apps/jobradar/.gitignore:6`), dus de commerciële data komt niet in git terecht.

## Open vragen

- **Eenmalig of terugkerend?** Komt er periodiek een nieuw bestand (dan hoort er een
  `bestandsnaam`/`imported_at`-historiek bij en moet "verdwenen uit de nieuwste export"
  een zichtbare toestand zijn), of is dit één lijst die blijft staan?
- **Rechtsgrond.** `companies` draagt `rechtsgrond` en `opt_out`. Krijgen CSV-prospects
  diezelfde twee kolommen, of geldt de verwerkingsgrond pas bij het eerste contact
  (zie de contactopvolging-briefing)?
- **Herkomst van het bestand.** De kolomnamen wijzen op een externe waarderingstool.
  Mag die herkomst als bron-label in de UI staan, of blijft dat intern?

## Aannames

- `[ASSUMPTION: import via CLI, niet via een upload-scherm — de app heeft geen auth en
  draait lokaal]`
- `[ASSUMPTION: de negen kolommen worden overgenomen zoals ze zijn; geen afgeleide velden
  bij import — afleiden gebeurt bij het renderen, net als de KBO-koppeling]`
- `[ASSUMPTION: employeeCount en EBITDA zijn een sorteer-as, geen score-as]` — dit is
  bewust: `context-snapshot.md` legt vast dat de vacaturescore en de classificatie niet
  mogen samenvallen, en `LEARNINGS.md` draagt die faalklasse. Een derde as die stil in de
  lead-score lekt is dezelfde fout in nieuwe kleren.
- `[ASSUMPTION: de lijst is klein genoeg (218) om zonder paginering te tonen binnen het
  bestaande plafond van 60 per pagina]`

## Acceptatie

- [ ] Import van het geleverde bestand levert 218 rijen in `csv_prospects` — bewijs: `SELECT count(*)` na de import
- [ ] Alle 218 ondernemingsnummers zijn uniek in de tabel — bewijs: `count(*) = count(DISTINCT enterprise_number)`
- [ ] Tweede import van hetzelfde bestand houdt het rijaantal op 218 — bewijs: rijtelling vóór en ná de tweede run
- [ ] Tweede import werkt `imported_at` wél bij — bewijs: de waarde vóór en ná de tweede run staat niet gelijk
- [ ] `prospect_status` is na een import ongewijzigd — bewijs: rijtelling plus `md5` van de gesorteerde inhoud, vóór en ná
- [ ] De rij `DAENINCK, AUDENAERT en Co` komt heel binnen op nummer `0465416688` — bewijs: `SELECT name` op dat nummer (dit is de regel waarop een naïeve komma-split brak, gemeten 2026-09-08)
- [ ] De 3 nummers zonder KBO-treffer (`0899434379`, `0468585818`, `0835734875`) staan in de lijst met naam en stad — bewijs: DOM-telling op die drie kaarten in de flow-harness
- [ ] Een bedrijf dat in beide bronnen zit levert één kaart, niet twee — bewijs: DOM-telling van kaarten met dat ondernemingsnummer, hoort 1 te zijn
- [ ] Typologie: het herkomst-filter is een segmented control en staat binnen `FilterBar` — bewijs: de gerenderde markup van dat element in de DOM
- [ ] Het aantal tabbladen is ongewijzigd ten opzichte van vóór deze feature — bewijs: telling van de tabbladen in de DOM, vóór en ná
- [ ] State *empty*: een DB zonder import toont de uitleg en niet stil nul — bewijs: `JOBRADAR_DB_PATH` naar een wegwerp-pad, dan de flow-harness
- [ ] States *loading* en *error*: `[NIET TE VERIFIËREN — jobradar heeft geen fixture-laag en geen mock-route; zie `## Verify-pad` → "State forceren". Wie ze wil toetsen bouwt eerst een onderschepte route zoals `apps/cashflow/scripts/flow-harness.mjs` die heeft.]`
- [ ] Interactie: het herkomst-filter is met het toetsenbord te bereiken en te bedienen — bewijs: de toetsenbord-pass van de flow-harness (differentiële focus-meting)
- [ ] Edge case: de 44 rijen met lege `enterpriseValue` renderen als "—" — bewijs: DOM-telling van die 44 kaarten
- [ ] Edge case: `employeeCount` met decimaal (`35.8`) rendert afgerond zonder te breken — bewijs: DOM-waarde op nummer `0747501103`
- [ ] De financiële kolommen komen niet voor in de score-afleiding — bewijs: `git diff` toont geen wijziging in `lib/signals.ts` en `lib/config/`
- [ ] `pnpm --filter jobradar scenarios` blijft groen, inclusief zijn eigen tegenproef — bewijs: exit 0 op de suite, exit ≠ 0 op `SCENARIO_SELFTEST=1`

## Beslissingsgeschiedenis

- 2026-09-08: TC-EBC aangemaakt. Scope gesplitst in drie briefings (bron · opvolging · kaart) omdat de assen los kunnen falen: de kaart hangt op geocoding, de opvolging op een migratie.
- 2026-09-08: Rol van de CSV vastgelegd als eigen bron náást de KBO-prospects, niet als vervanging en niet als verrijking. Gevolg: overlap (178 van de 218) moet expliciet getoond worden.
- 2026-09-08: Typologie beslist (Jeroen): segmented control in de bestaande `FilterBar`, geen apart CSV-tabblad. Daarmee zijn de vier kritische items van deze briefing beantwoord.
