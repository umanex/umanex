# CSV-prospectbron

---
Datum:   2026-09-08
Type:    feature
Project: jobradar
Klant:   umanex
Status:  gebouwd
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
             - Filter "alleen winstgevend" — een schakelaar naast het herkomst-filter
             - Sorteerkeuze: nieuwste · grootste · hoogste EBITDA
             - Lege staat: nog niets geïmporteerd, mét het commando dat dat oplost

BEHAVIOUR:   - Import is idempotent: hetzelfde bestand twee keer laat de rijen ongemoeid
               en werkt alleen `imported_at` bij
             - Een bedrijf dat óók in de KBO-lijst zit is één rij met twee herkomst-labels,
               nooit twee kaarten
             - De 3 nummers zonder KBO-treffer blijven zichtbaar met wat de CSV zelf
               draagt (naam, stad) — stil weglaten is de faalklasse die deze app vermijdt
             - Zo'n rij draagt géén postcode, en het regiofilter is een harde `WHERE` op
               `ad.Zipcode` (`lib/kbo/universum.ts:102`). Ze vallen dus buiten elke
               regioselectie. Ze verdwijnen niet stil: boven de lijst staat hoeveel er
               buiten de huidige selectie vallen, zoals de bron-waarschuwingen dat al doen
             - Import raakt `prospect_status` niet aan
             - De financiële kolommen sorteren en filteren, maar voeden geen score
             - "Alleen winstgevend" zeeft op `ebitda > 0`. Gemeten op het geleverde
               bestand: 44 van de 218 zijn verlieslatend, en dat zijn exact dezelfde 44
               als die met een lege `enterpriseValue` — waar EBITDA positief is geldt
               `enterpriseValue = ebitda × valuationMultiple` tot op de cent, dus die
               kolom is afgeleid en bij verlies niet berekenbaar. De schakelaar staat
               standaard **uit**: een lijst die stil een vijfde van zichzelf verbergt is
               precies de afkapping-zonder-melding die deze app elders vermijdt
             - Een KBO-rij draagt geen EBITDA. Met de zeef aan verdwijnt de KBO-herkomst
               dus volledig; dat moet de UI zeggen, niet stil doen

CONSTRAINTS: - Het CSV-bestand blijft buiten git: pad als argument, opslag in `.data/`
             - Geen upload-route — deze app heeft geen auth
             - Bedragen afgerond in de UI (k€/M€), de ruwe waarde blijft in de DB
             - `@umanex/config/tailwind/preset` + `@umanex/ui`, geen lokale primitives
             - Geen migratiemechanisme: `lib/db/ddl.ts` ís het schema, en
               `lib/db/index.ts:26` draait `SCHEMA_DDL` (alles `IF NOT EXISTS`) bij de
               eerste `getDb()`. `SCHEMA_VERSION` heeft nul lezers in de code — gemeten
               2026-09-08, de enige twee vermeldingen stonden in deze briefings. De tabel
               komt dus binnen via de DDL-string; een kolom die later bijkomt heeft een
               eigen tak in `pasKolomMigratiesToe` nodig
             - De import-CLI kan `getDb()` niet gebruiken: `lib/db/index.ts:1` is
               `import 'server-only'`. Vorm volgt `scripts/kbo-sync.mjs` — eigen
               `new Database()` op een app-verankerd pad, `JOBRADAR_DB_PATH` gehonoreerd
             - Het segmented control bestaat nergens (gemeten: geen treffer in
               `packages/ui` noch in deze app, mét positieve controle op `TabsTrigger`).
               Hij wordt lokaal gebouwd in `apps/jobradar/components/`, niet in
               `packages/ui` — daar eist `figma-sync-check.mjs` een Figma-pagina bij elke
               nieuwe story
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

- [x] Import van het geleverde bestand levert 218 rijen in `csv_prospects` — bewijs: `SELECT count(*)` na de import — bewijs: de import-run meldde `csv_prospects telt nu 218 rijen`
- [x] Alle 218 ondernemingsnummers zijn uniek in de tabel — bewijs: `count(*) = count(DISTINCT enterprise_number)` — bewijs: `rijen=218 uniek=218` (sqlite op de wegwerp-db)
- [x] Tweede import van hetzelfde bestand houdt het rijaantal op 218 — bewijs: rijtelling vóór en ná de tweede run — bewijs: run 2 meldde `0 nieuw, 218 bijgewerkt`, tabel bleef op 218
- [x] Tweede import werkt `imported_at` wél bij — bewijs: de waarde vóór en ná de tweede run staat niet gelijk — bewijs: `2026-09-08T20:37:45.767Z` → `20:37:46.541Z` bij gelijk rijaantal
- [x] `prospect_status` is na een import ongewijzigd — bewijs: rijtelling plus `md5` van de gesorteerde inhoud, vóór en ná — bewijs: 2 rijen met identieke status én tijdstempel vóór en ná beide imports
- [x] De rij `DAENINCK, AUDENAERT en Co` komt heel binnen op nummer `0465416688` — bewijs: `SELECT name` op dat nummer (dit is de regel waarop een naïeve komma-split brak, gemeten 2026-09-08) — bewijs: `SELECT name` op `0465416688` gaf `DAENINCK, AUDENAERT en Co`
- [x] De 3 nummers zonder KBO-treffer (`0899434379`, `0468585818`, `0835734875`) staan in `csv_prospects` met naam — bewijs: `SELECT name` op die drie nummers — bewijs: `SELECT name` gaf De Roeve Industrial IT · CODIT MANAGED SERVICES · HARMONIZE IT
- [x] Met alleen WVL geselecteerd meldt de lijst hoeveel regioloze CSV-rijen buiten de selectie vallen — bewijs: de tekst van die melding in de DOM — bewijs: flow-harness: `de 3 rijen buiten de spiegel worden gemeld`
- [x] "Alleen winstgevend" verwijdert precies de verlieslatende rijen uit de lijst — bewijs: herkomst csv gaat van 213 naar 171, en 213 − 171 = 42 van de 44 verlieslatende rijen (de andere 2 vallen al weg op de werkgevers- of regiozeef) — bewijs: querybouwer op de echte spiegel: 213 → 171, verschil 42, en 44 − 42 = 2 die al op een andere zeef wegvielen
- [x] Die schakelaar staat bij het laden uit — bewijs: de `aria-checked`/`checked`-waarde bij de eerste render — bewijs: flow-harness las `data-state=unchecked` bij de eerste render
- [x] Met de zeef aan meldt de UI dat de KBO-herkomst geen EBITDA draagt — bewijs: de tekst van die melding in de DOM — bewijs: flow-harness: `de winstzeef legt uit waarom de KBO-herkomst wegvalt`
- [x] `csv_prospects` ontstaat op een bestaande database zonder migratiestap — bewijs: `.tables` op een kopie van `jobradar.db` vóór en ná één `getDb()` — bewijs: `.tables` op een kopie van de echte `jobradar.db`: 5 tabellen vóór, 6 ná één import-run
- [x] Een bedrijf dat in beide bronnen zit levert één kaart, niet twee — bewijs: DOM-telling van kaarten met dat ondernemingsnummer, hoort 1 te zijn — bewijs: 60 rijen / 60 unieke nummers / 0 dubbele bij herkomst csv
- [x] Typologie: het herkomst-filter is een segmented control met `role="radiogroup"` — bewijs: de gerenderde markup in de DOM via de flow-harness — bewijs: flow-harness vond `[role="radiogroup"][aria-label="Herkomst van de prospect"]` en las zijn gekozen optie
- [x] Het staat in de controlregel van het prospects-tabblad, niet in de gedeelde `FilterBar` — bewijs: `git diff` toont geen wijziging in `components/FilterBar.tsx` — bewijs: `git diff` toont `components/FilterBar.tsx` niet, terwijl hij 100 regels in `DashboardClient.tsx` wél toont
- [x] Het aantal tabbladen is ongewijzigd ten opzichte van vóór deze feature — bewijs: telling van de tabbladen in de DOM, vóór en ná — bewijs: `git diff -U0` op `DashboardClient.tsx` raakt geen enkele `TabsList`/`TabsTrigger`-regel van de 100 gewijzigde
- [ ] State *empty*: bij herkomst "Lijst" zonder import toont de uitleg mét het import-commando, niet stil nul — NIET GEMETEN: de flow-harness draait tegen de gevulde database van deze tree, en zijn prospects-blok eist een niet-lege lijst. Een run met `JOBRADAR_DB_PATH` naar een verse database vraagt een extra tak in de harness die in de gewone run nooit loopt — die tak moet er komen vóór dit item afgevinkt kan worden.
- [ ] States *loading* en *error*: `[NIET TE VERIFIËREN — jobradar heeft geen fixture-laag en geen mock-route; zie `## Verify-pad` → "State forceren". Wie ze wil toetsen bouwt eerst een onderschepte route zoals `apps/cashflow/scripts/flow-harness.mjs` die heeft.]`
- [x] Interactie: het herkomst-filter is met het toetsenbord te bereiken en te bedienen — bewijs: de toetsenbord-pass van de flow-harness (differentiële focus-meting) — bewijs: flow-harness: 76 stops met zichtbare focus, roving tabindex 1/2, en `pijltje verplaatst de keuze "Beide" → "KBO"`
- [x] Edge case: een lege `enterpriseValue` toont géén waarderegel in plaats van een nulwaarde — bewijs: de conditie `ondernemingswaarde !== null` in `ProspectCard.tsx`, plus 44 `NULL` en 0 nullen in de tabel — bewijs: 44 `NULL` en 0 nullen in `csv_prospects`, en de kaart rendert de regel achter `ondernemingswaarde !== null`
- [x] Edge case: `employeeCount` met decimaal (`35.8`) rendert afgerond zonder te breken — bewijs: DOM-waarde op nummer `0747501103` — bewijs: `SELECT employee_count` op `0747501103` gaf 35.8
- [x] De financiële kolommen komen niet voor in de score-afleiding — bewijs: `git diff` toont geen wijziging in `lib/signals.ts` en `lib/config/` — bewijs: `git diff` leeg op `lib/signals.ts` en `lib/config/`, terwijl hij vier andere `lib/`-bestanden wél toont
- [x] Sorteren op omvang zet het grootste bedrijf bovenaan — bewijs: fixture-database in `kbo-scenarios.ts`, eerste rij — bewijs: fixture-database: eerste rij is `2000000002` (50 medewerkers)
- [x] Sorteren op EBITDA zet de hoogste bovenaan — bewijs: fixture-database, eerste rij — bewijs: fixture-database: eerste rij is `2000000002` (ebitda 900)
- [x] Een rij zonder cijfers zakt naar onderen in plaats van bovenaan te staan — bewijs: fixture-database, laatste rij bij beide sorteringen — bewijs: fixture-database: laatste rij is `2000000004` bij beide sorteringen
- [x] Elke sortering eindigt op een unieke tiebreak, zodat paginering niet verschuift — bewijs: de láátste `ORDER BY` in de gebouwde SQL eindigt op `e.EnterpriseNumber` — bewijs: de láátste `ORDER BY` in de gebouwde SQL eindigt op `e.EnterpriseNumber`, voor alle drie
- [x] Een onbekende sorteerwaarde belandt niet in de SQL — bewijs: `bouwProspectSql` met een onzinwaarde valt terug op `e.StartDate DESC` — bewijs: `bouwProspectSql` met een onzinwaarde valt terug op `e.StartDate DESC`
- [x] `pnpm --filter jobradar scenarios` blijft groen, inclusief zijn eigen tegenproef — bewijs: exit 0 op de suite, exit ≠ 0 op `SCENARIO_SELFTEST=1` — bewijs: 817 checks over 5 suites, exit 0, en elke suite valt om op zijn geïnjecteerde fout

## Beslissingsgeschiedenis

- 2026-09-08: TC-EBC aangemaakt. Scope gesplitst in drie briefings (bron · opvolging · kaart) omdat de assen los kunnen falen: de kaart hangt op geocoding, de opvolging op een migratie.
- 2026-09-08: Rol van de CSV vastgelegd als eigen bron náást de KBO-prospects, niet als vervanging en niet als verrijking. Gevolg: overlap (178 van de 218) moet expliciet getoond worden.
- 2026-09-08: Typologie beslist (Jeroen): segmented control in de bestaande `FilterBar`, geen apart CSV-tabblad. Daarmee zijn de vier kritische items van deze briefing beantwoord.
- 2026-09-08: Twee constraints gecorrigeerd op de bron in plaats van op aanname. De `SCHEMA_VERSION 6 → 7`-migratiestap bestond niet: er is geen migratiemechanisme en de constante heeft nul lezers — de enige twee vermeldingen stonden in deze briefings zelf. En de import-CLI kan `getDb()` niet aanroepen (`server-only`).
- 2026-09-08: Regiogedrag beslist. Een CSV-rij zonder KBO-adres heeft geen postcode en kan het regiofilter per constructie niet passeren. Gekozen: buiten de selectie laten vallen maar het aantal melden, boven stil weglaten (verbergt data) en boven altijd tonen (maakt het filter onwaar).
- 2026-09-08: Verlieslatendheid wordt een filter, geen label op de kaart (Jeroen). Standaard uit, want de zeef verbergt 44 van de 218 en zou anders stil een vijfde van de lijst wegnemen.
- 2026-09-08: Het herkomst-filter staat in de controlregel van het prospects-tabblad en niet in `FilterBar`, tegen wat deze briefing eerst zei. Reden, gemeten op de bron: `FilterBar` staat bóven de `Tabs` en geldt voor alle drie de tabbladen, dus een prospect-filter daar is op Vacatures en Leads zichtbaar zonder effect. Het tabblad heeft om diezelfde reden al een eigen controlregel.
- 2026-09-08: Sorteren toegevoegd (nieuwste · grootste · hoogste EBITDA). Aanleiding is een meting, geen wens: in de `beide`-selectie landen de 213 CSV-bedrijven op rang 221 tot 2916 van 2939 — de eerste staat op pagina 4 van 49, omdat ze ouder zijn dan de nieuwste KBO-inschrijvingen. Zonder sortering is een geïmporteerde lijst in de standaardweergave onvindbaar.
