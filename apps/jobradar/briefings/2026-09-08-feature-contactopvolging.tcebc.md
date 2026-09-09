# Contactopvolging

---
Datum:   2026-09-08
Type:    feature
Project: jobradar
Klant:   umanex
Status:  gebouwd
---

---

```
TASK:        Contactmomenten en een volgende actie per bedrijf, zodat opvolging meer is
             dan een status-vinkje.

CONTEXT:     Vandaag draagt jobradar per item één enum — `jobs.job_status`,
             `companies.lead_status`, `prospect_status.status`, alle vier
             `new/saved/dismissed/contacted`. Die zegt of je iets gedaan hebt, niet
             wanneer, via welk kanaal, of wat er uit kwam. Deze feature voegt de
             historiek toe en maakt "wat is de volgende zet" de sorteersleutel van
             de lijst. Werkt over alle drie de herkomsten heen: leads, KBO-prospects
             en CSV-prospects.

             De sleutel is `subject_type` + `subject_key`, niet het ondernemingsnummer
             alleen. Reden, gemeten: `companies` draagt geen nummer-kolom, de koppeling
             gebeurt bij het renderen, en daarvan zijn 12 van de 27 leads gekoppeld en
             15 niet gevonden — en één van die twaalf wijst naar een tandartspraktijk.
             Sleutelen op het nummer verliest dus stil 15 leads en hangt één historiek
             aan het verkeerde bedrijf.

ELEMENTS:    - Tabel `contact_moments` (id, subject_type `lead`|`prospect`,
               subject_key = `companies.id` respectievelijk het ondernemingsnummer,
               datum, kanaal, notitie, created_at)
             - Tabel `next_actions` (subject_type + subject_key PK, datum, omschrijving)
             - `rechtsgrond` op elk contactmoment, overgenomen van het bedrijf op het
               moment van opslaan. Een register wil weten op welke grond je tóén
               contacteerde; die kan later wijzigen
             - `ContactPanel` — een sheet die van rechts inschuift, met de historiek en
               het formulier per bedrijf. De kaartlijst blijft zichtbaar en de historiek
               kan groeien zonder dat de feed van drie kolommen verspringt
             - `Sheet` bestaat nog niet in `@umanex/ui` — die primitive komt dáár, mét
               story, en niet lokaal zoals `HerkomstFilter`. Dat betekent ook een
               Figma-pagina in het manifest, anders faalt `figma-sync-check.mjs`
             - `ContactTimeline` — de momenten in omgekeerde chronologie
             - `NextActionBadge` op `LeadCard` en `ProspectCard`, met datum-toestand
               (verlopen · vandaag · gepland · geen)
             - Sorteer- en filteroptie "volgende actie" in `FilterBar`
             - API: POST/DELETE contactmoment, PUT volgende actie

BEHAVIOUR:   - Een contactmoment toevoegen zet de status op `contacted` als die nog
               `new` of `saved` was; `dismissed` wordt nooit stil overschreven
             - Een volgende actie is optioneel — een bedrijf zonder actie verdwijnt niet
               uit de lijst, het sorteert alleen achteraan
             - Verlopen acties staan bovenaan bij sorteren op volgende actie
             - Een contactmoment verwijderen vraagt bevestiging en laat de status staan
             - Staat `opt_out` aan, dan weigert het formulier een nieuw contactmoment en
               legt uit waarom. De fout voorkomen is meer waard dan hem achteraf kunnen
               aantonen — en de API weigert het ook, niet alleen de UI
             - De historiek overleeft elke sync: sync raakt deze twee tabellen niet aan
             - Krijgt een lead later een bevestigde KBO-koppeling, dan verhuist zijn
               historiek niet. De kaart toont beide historieken onder elkaar. Reden: van
               de 12 gekoppelde leads wees er één naar een tandartspraktijk, en een
               migratie zou daar andermans contactmomenten meeslepen

CONSTRAINTS: - Desktop-first, zoals de rest van het dashboard
             - `@umanex/config/tailwind/preset` + `@umanex/ui`; nieuwe primitives horen
               in `packages/ui` met story, niet in deze app
             - Geen nieuwe dependencies — geen datepicker-library, `input[type=date]`
             - SQLite-migratie op dezelfde `SCHEMA_VERSION`-stap als de CSV-bron
             - Kanaal is een vaste enum (mail · LinkedIn · telefoon · in persoon),
               geen vrije tekst
```

---

## Open vragen


## Aannames

- `[ASSUMPTION: één volgende actie per bedrijf, niet meerdere]` — meerdere open acties
  maakt de sorteersleutel dubbelzinnig, en de lijst is de reden dat dit veld bestaat.
- `[ASSUMPTION: notitie is vrije tekst zonder opmaak, max ±2000 tekens]`
- `[ASSUMPTION: geen herinneringen of notificaties]` — er is geen server-proces en geen
  auth; een verlopen actie is zichtbaar in de lijst, meer niet.
- `[ASSUMPTION: geen undo op verwijderen, wel een bevestiging]` — zelfde regime als de
  status-tracking briefing van 2026-06-02.

## Acceptatie

- [ ] Typologie: `ContactPanel` opent als sheet en de kaartlijst blijft in de DOM staan — bewijs: DOM-telling van de kaarten vóór en na het openen, plus `flow --shot`
- [ ] De sheet-primitive staat in `packages/ui` met een story, niet in app-code — bewijs: `pnpm ds:guard` groen plus het bestandspad
- [ ] `figma-sync-check.mjs` blijft groen na de nieuwe story — bewijs: exit 0 op die guard
- [x] Een contactmoment verwijderen laat de status staan — bewijs: probe test 11, DELETE geeft 200, rijen 4 → 3, `lead_status` blijft `contacted`
- [ ] En het vraagt eerst bevestiging — bewijs: nog niet meetbaar, de bevestiging zit in de UI die nog niet bestaat
- [x] Elk contactmoment draagt de rechtsgrond van het bedrijf op het moment van opslaan — bewijs: `SELECT rechtsgrond` op een verse rij tegen de kolom op `companies` — bewijs: probe test 1 — `SELECT rechtsgrond` geeft `gerechtvaardigd belang`, overgenomen van `companies`
- [x] De opt-out-rem geldt óók voor prospects — bewijs: `opt_out` toegevoegd aan `prospect_status`, en `pasKolomMigratiesToe` vult hem bij op een bestaande database (kolommen vóór: 3, ná: 4, rij bewaard)
- [x] Een bedrijf met `opt_out` krijgt geen contactmoment, ook niet via de API — bewijs: POST levert 4xx en `count(*)` blijft gelijk — bewijs: probe test 3 — HTTP 409 en het rijaantal blijft 2
- [ ] Het formulier legt uit waarom het weigert in plaats van stil te falen — bewijs: de tekst van die melding in de DOM
- [x] Een lead-historiek blijft bij de lead staan — bewijs: `subject_type='lead'` op de rij, en geen migratiepad in de diff — bewijs: probe test 9 — `lead:1,lead:1,lead:3,prospect:0747501103`, geen migratiepad in de diff
- [x] Een contactmoment toevoegen levert precies één rij in `contact_moments` — bewijs: rijtelling vóór en ná via de API-route — bewijs: `opvolging:probe` test 1 — 200, `contact_moments` van 0 naar 1
- [x] Een lead zonder KBO-koppeling kan een contactmoment dragen — bewijs: POST op één van de 15 ongekoppelde leads levert 200 plus een rij — bewijs: de sleutel is `companies.id`, niet het ondernemingsnummer — probe test 1 op lead 1, die geen nummer heeft
- [x] Een lead en een prospect met hetzelfde getal als `subject_key` delen geen historiek — bewijs: twee rijen met gelijke key en verschillend `subject_type`, elk zichtbaar bij precies één bedrijf — bewijs: `contact-scenarios.ts`: lead 42 en prospect 42 leveren twee rijen, één per subject_type
- [x] Status springt van `new` naar `contacted` bij het eerste contactmoment — bewijs: `SELECT status` vóór en ná — bewijs: probe test 1 — respons `status=contacted`, en `SELECT lead_status` op de rij geeft `contacted`
- [x] Status `dismissed` blijft `dismissed` na een contactmoment — bewijs: `SELECT status` vóór en ná op een bewust op `dismissed` gezet bedrijf — bewijs: probe test 4 — 200 met `status=dismissed`, en de database zegt `dismissed`
- [ ] De historiek overleeft een sync — bewijs: `count(*)` op `contact_moments` vóór en ná een sync tegen een wegwerp-DB (`JOBRADAR_DB_PATH=/tmp/…`, nooit tegen `.data/jobradar.db`)
- [ ] Sorteren op volgende actie zet een verlopen datum bóven een toekomstige — bewijs: de volgorde van de eerste drie kaarten in de DOM tegen de datums in de DB
- [ ] Een bedrijf zónder volgende actie blijft zichtbaar in die sortering — bewijs: kaart-telling met en zonder de sortering, hoort gelijk te zijn
- [ ] State *empty*: een bedrijf zonder historiek toont uitleg in plaats van een leeg paneel — bewijs: flow-harness op een verse DB
- [ ] States *loading* en *error*: `[NIET TE VERIFIËREN — geen fixture-laag en geen mock-route in jobradar; zie `## Verify-pad` → "State forceren". Deze feature schrijft naar de DB, dus een gefaalde POST is een echte toestand: als er een fixture-laag komt, is dít de eerste die hem nodig heeft.]`
- [ ] Interactie: het formulier is volledig met het toetsenbord te bedienen en elke stop toont focus — bewijs: de toetsenbord-pass van de flow-harness op het geopende paneel
- [ ] Interactie: het paneel sluit met `Escape` en geeft focus terug aan de kaart — bewijs: `document.activeElement` vóór openen en na sluiten
- [ ] Kopstructuur binnen het paneel slaat geen niveau over — bewijs: de kopstructuur-pass van de flow-harness op het verse paneel
- [ ] Edge case: een notitie van 2000 tekens wordt bewaard en breekt de kaartlayout niet — bewijs: opgeslagen lengte plus de gemeten kaarthoogte
- [x] Edge case: een datum in het verleden is toegestaan bij een contactmoment — bewijs: POST met een datum van vorig jaar levert 200 en een rij — bewijs: `contact-scenarios.ts`: 2025-01-02 wordt aanvaard, 2026-09-10 geweigerd met "ligt niet in de toekomst"
- [x] Edge case: twee contactmomenten op dezelfde dag blijven twee rijen — bewijs: `count(*)` na twee POSTs met dezelfde datum — bewijs: probe test 2 — twee POSTs met dezelfde datum geven rijen=2; ook in de suite
- [x] Geen nieuwe dependency in `apps/jobradar/package.json` — bewijs: `git diff` op dat bestand — bewijs: `git diff` op dat bestand toont alleen twee script-regels, geen dependency
- [x] `pnpm --filter jobradar scenarios` blijft groen, inclusief zijn eigen tegenproef — bewijs: 878 checks over 7 suites, exit 0, en elke suite valt om op zijn geïnjecteerde fout

## Beslissingsgeschiedenis

- 2026-09-08: TC-EBC aangemaakt. Diepte vastgelegd op volledige contacthistoriek met volgende actie, boven de lichtere variant met één contactdatum plus notitie.
- 2026-09-08: Sleutelkeuze geopend als expliciete vraag in plaats van als aanname — het ondernemingsnummer alleen verliest de 15 ongekoppelde leads stil.
- 2026-09-08: Sleutel beslist (Jeroen): `subject_type` + `subject_key`, samenvoegen pas bij een bevestigde koppeling. De vraag verhuist van Open vragen naar CONTEXT, mét de meting die haar draagt.
- 2026-09-09: Drie beslissingen (Jeroen). `ContactPanel` wordt een sheet van rechts — en daarmee een nieuwe primitive in `packages/ui` mét story en Figma-pagina, niet lokaal zoals `HerkomstFilter`. De rechtsgrond wordt per contactmoment vastgelegd én het formulier krijgt een opt-out-rem. De historiek van een lead verhuist niet bij een latere koppeling.
- 2026-09-09: Datalaag, domeinlogica en API gebouwd; de UI wacht. `Sheet` moet in `packages/ui` mét story, en `figma-sync-check.mjs` eist daar een Figma-pagina met échte node-id's bij — die worden door Figma uitgegeven en de Console MCP is deze sessie losgekoppeld. Verzonnen id's zijn geen id's, dus dat deel staat stil in plaats van dat het half gebouwd wordt.
- 2026-09-09: Onderweg bleek `opt_out` alleen op `companies` te bestaan. De rem zou dus stil alleen voor leads gelden — twee van de drie herkomsten onbeschermd, en een guard die compleet lijkt en het niet is. Kolom toegevoegd aan `prospect_status`, mét migratie voor bestaande databases.
- 2026-09-09: Nieuw instrument: `pnpm --filter jobradar opvolging:probe <werkmap>` rijdt de routes echt af tegen een verse database. Het Verify-pad van deze app had geen request/response-as; die staat er nu in. Zijn eigen falen is ook gerepareerd — de eerste versie sprak met de achtergebleven server van de vorige run en rapporteerde gevulde, geloofwaardige uitkomsten over de verkeerde database. Hij heeft nu een poortcheck, ruimt zijn wees op, en doet een positieve controle (verse database = nul momenten) vóór de eerste meting.
