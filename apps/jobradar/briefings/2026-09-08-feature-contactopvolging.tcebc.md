# Contactopvolging

---
Datum:   2026-09-08
Type:    feature
Project: jobradar
Klant:   umanex
Status:  gepland
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
             - `ContactPanel` — de historiek plus het formulier, per bedrijf
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
             - De historiek overleeft elke sync: sync raakt deze twee tabellen niet aan

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

- **Component-typologie van `ContactPanel`.** Voorstel: een sheet die van rechts
  inschuift — de kaartlijst blijft zichtbaar, en de historiek kan groeien zonder de
  feed te verspringen. Alternatieven: modal (blokkeert de lijst) of inline uitklappen
  op de kaart (springt de feed uiteen bij lange historiek).
- **Wat gebeurt er bij een bevestigde koppeling achteraf?** (volgt op de sleutelkeuze) Als een lead later wél zijn
  ondernemingsnummer krijgt: verhuist de historiek mee, of blijft ze aan de lead hangen?
- **Rechtsgrond bij contact.** `companies` draagt `rechtsgrond` en `opt_out`. Moet een
  contactmoment die grond vastleggen op het moment zelf (dat is wat een register nodig
  heeft), of volstaat de kolom op het bedrijf?

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
- [ ] Een contactmoment toevoegen levert precies één rij in `contact_moments` — bewijs: rijtelling vóór en ná via de API-route
- [ ] Een lead zonder KBO-koppeling kan een contactmoment dragen — bewijs: POST op één van de 15 ongekoppelde leads levert 200 plus een rij
- [ ] Een lead en een prospect met hetzelfde getal als `subject_key` delen geen historiek — bewijs: twee rijen met gelijke key en verschillend `subject_type`, elk zichtbaar bij precies één bedrijf
- [ ] Status springt van `new` naar `contacted` bij het eerste contactmoment — bewijs: `SELECT status` vóór en ná
- [ ] Status `dismissed` blijft `dismissed` na een contactmoment — bewijs: `SELECT status` vóór en ná op een bewust op `dismissed` gezet bedrijf
- [ ] De historiek overleeft een sync — bewijs: `count(*)` op `contact_moments` vóór en ná een sync tegen een wegwerp-DB (`JOBRADAR_DB_PATH=/tmp/…`, nooit tegen `.data/jobradar.db`)
- [ ] Sorteren op volgende actie zet een verlopen datum bóven een toekomstige — bewijs: de volgorde van de eerste drie kaarten in de DOM tegen de datums in de DB
- [ ] Een bedrijf zónder volgende actie blijft zichtbaar in die sortering — bewijs: kaart-telling met en zonder de sortering, hoort gelijk te zijn
- [ ] State *empty*: een bedrijf zonder historiek toont uitleg in plaats van een leeg paneel — bewijs: flow-harness op een verse DB
- [ ] States *loading* en *error*: `[NIET TE VERIFIËREN — geen fixture-laag en geen mock-route in jobradar; zie `## Verify-pad` → "State forceren". Deze feature schrijft naar de DB, dus een gefaalde POST is een echte toestand: als er een fixture-laag komt, is dít de eerste die hem nodig heeft.]`
- [ ] Interactie: het formulier is volledig met het toetsenbord te bedienen en elke stop toont focus — bewijs: de toetsenbord-pass van de flow-harness op het geopende paneel
- [ ] Interactie: het paneel sluit met `Escape` en geeft focus terug aan de kaart — bewijs: `document.activeElement` vóór openen en na sluiten
- [ ] Kopstructuur binnen het paneel slaat geen niveau over — bewijs: de kopstructuur-pass van de flow-harness op het verse paneel
- [ ] Edge case: een notitie van 2000 tekens wordt bewaard en breekt de kaartlayout niet — bewijs: opgeslagen lengte plus de gemeten kaarthoogte
- [ ] Edge case: een datum in het verleden is toegestaan bij een contactmoment — bewijs: POST met een datum van vorig jaar levert 200 en een rij
- [ ] Edge case: twee contactmomenten op dezelfde dag blijven twee rijen — bewijs: `count(*)` na twee POSTs met dezelfde datum
- [ ] Geen nieuwe dependency in `apps/jobradar/package.json` — bewijs: `git diff` op dat bestand
- [ ] `pnpm --filter jobradar scenarios` blijft groen, inclusief zijn eigen tegenproef — bewijs: exit 0 op de suite, exit ≠ 0 op `SCENARIO_SELFTEST=1`

## Beslissingsgeschiedenis

- 2026-09-08: TC-EBC aangemaakt. Diepte vastgelegd op volledige contacthistoriek met volgende actie, boven de lichtere variant met één contactdatum plus notitie.
- 2026-09-08: Sleutelkeuze geopend als expliciete vraag in plaats van als aanname — het ondernemingsnummer alleen verliest de 15 ongekoppelde leads stil.
- 2026-09-08: Sleutel beslist (Jeroen): `subject_type` + `subject_key`, samenvoegen pas bij een bevestigde koppeling. De vraag verhuist van Open vragen naar CONTEXT, mét de meting die haar draagt.
