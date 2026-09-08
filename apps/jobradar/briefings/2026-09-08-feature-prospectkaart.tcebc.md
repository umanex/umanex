# Prospectkaart

---
Datum:   2026-09-08
Type:    feature
Project: jobradar
Klant:   umanex
Status:  gepland
---

---

```
TASK:        Leads en prospects uitmappen op een kaart, met de opvolgstatus zichtbaar
             per bedrijf.

CONTEXT:     jobradar toont vandaag alleen lijsten. De adressen bestaan wél: gemeten op
             2026-09-08 hebben 215 van de 218 CSV-bedrijven een volledig zeteladres in
             de KBO-spiegel (straat + huisnummer + postcode), alle 215 actief. Wat er
             níet is, is één coördinaat — KBO levert geen lat/lon en de app heeft nul
             geo-code. Er komt dus een geocode-stap vóór de kaart, en die hoort in
             `jobradar.db`: de spiegel is wegwerpbaar en mag niets dragen wat jij
             beslist of betaald hebt.

ELEMENTS:    - Tabel `geocode_cache` (ondernemingsnummer PK, lat, lon, precisie, bron,
               opgehaald_at, mislukt_reden)
             - CLI `pnpm --filter jobradar geocode` — hervatbaar, respecteert het
               tempo van de bron, slaat op wat al gelukt is
             - `ProspectMap` op MapLibre GL, met de tiles via de eigen origin
             - Marker per bedrijf, kleur uit de rollaag = opvolgstatus
             - Clustering — 43 van de 218 staan in Gent, 29 in Brussel
             - Klik op marker → hetzelfde `ContactPanel` als in de lijst
             - Kaart/lijst-toggle, met het actieve filter gedeeld tussen beide
             - Lege staat: nog niets gegeocodeerd, mét het commando dat dat oplost

BEHAVIOUR:   - De kaart toont exact wat het actieve filter toont — geen tweede selectie
             - Een bedrijf zonder coördinaat verdwijnt niet: het staat als telling
               ("3 zonder locatie") naast de kaart, klikbaar naar de lijst
             - Klik op een cluster zoomt in tot de markers uit elkaar liggen
             - De geocode-CLI is idempotent: een tweede run vraagt alleen op wat nog
               ontbreekt of mislukt is
             - Wisselen tussen kaart en lijst bewaart filter, sortering en scrollpositie

CONSTRAINTS: - **Tiles moeten via de eigen origin.** `scripts/flow-harness.mjs:213-218`
               laat alleen `BASE`, `data:` en `blob:` door en laat de run falen bij één
               externe origin (`:387`). Een kaart die tiles van een tile-host haalt is
               daarmee per constructie niet te verifiëren. De guard verzwakken is de
               verkeerde kant: hij is precies de reden dat de harness geen echte data
               kan raken.
             - MapLibre GL is een nieuwe dependency — installeren pas na expliciete
               bevestiging (`CLAUDE.md`, "Acties die altijd eerst moeten worden bevestigd")
             - Geocoding gebeurt éénmalig in een CLI, nooit tijdens een request
             - Marker-kleuren komen uit de rollaag, geen rauwe hex
             - Attributie van kaartdata en tiles staat zichtbaar op de kaart
             - Adresdata gaat alleen naar de geocoding-bron, en alleen tijdens die run
```

---

## Open vragen

- **Waar komen de tiles vandaan, gegeven dat ze via de eigen origin moeten?** Twee
  richtingen, geen van beide door mij gemeten: (a) een vector-tile-bestand lokaal
  meeleveren en serveren uit een eigen route, (b) een externe tile-bron proxyen achter
  `/api/tiles/…`. (a) maakt de app offline-verifieerbaar maar zet een bestand van
  onbekende grootte in het project; (b) is klein maar houdt de app afhankelijk van een
  dienst. Vóór de bouw hoort hier één meting onder: de werkelijke bestandsgrootte voor
  België bij (a), en de gebruiksvoorwaarden bij (b).
- **Component-typologie van de kaartweergave.** Voorstel: een toggle bovenaan het
  bestaande prospects-tabblad die de lijst vervángt door de kaart, met het filter
  ernaast. Alternatieven: kaart en lijst naast elkaar (halveert beide op een laptop)
  of de kaart als vierde tabblad (dan verliest hij het filter).
- **Welke herkomsten komen op de kaart?** Alleen CSV-prospects (218), of ook de
  KBO-prospects (14.613) en de leads? Dat laatste vraagt geocoding op een heel andere
  schaal en verandert de clustering van een detail in het hoofdprobleem.
- **Wat is "precisie"?** Nominatim geeft niet altijd een huisnummer-treffer. Tonen we
  een straat- of gemeente-treffer als gewone marker, of zichtbaar anders?

## Aannames

- `[ASSUMPTION: het zeteladres (TypeOfAddress REGO) is het adres dat we mappen]` — niet
  de vestigingseenheden. 215 van de 218 hebben er één; vestigingen zijn een aparte tabel
  en een aparte vraag.
- `[ASSUMPTION: geocoding via Nominatim, éénmalig, resultaat in de DB]` — gekozen boven
  het Vlaamse adressenregister omdat 74 van de 215 in Brussel liggen en dat register die
  niet dekt. Het tempo van max één verzoek per seconde komt uit de gebruiksvoorwaarden
  van de dienst, niet uit een meting van mij.
- `[ASSUMPTION: desktop-first]` — de kaart is een werkinstrument, geen veldtoepassing.
- `[ASSUMPTION: geen realtime; de kaart leest wat de laatste geocode-run opleverde]`

## Acceptatie

- [ ] Na één geocode-run heeft elk bedrijf met een KBO-adres een rij in `geocode_cache` — bewijs: `count(*)` tegen het aantal bedrijven met zeteladres
- [ ] Elke opgeslagen coördinaat ligt binnen België — bewijs: `SELECT count(*)` op lat buiten 49,4–51,6 of lon buiten 2,5–6,5, hoort 0 te zijn
- [ ] Een tweede geocode-run doet geen enkel verzoek voor een al gelukte rij — bewijs: het verzoek-aantal van de tweede run tegen dat van de eerste
- [ ] Een afgebroken run verliest niets: wat vóór de onderbreking gelukt was staat er ná nog — bewijs: rijtelling vóór het afbreken en na de herstart
- [ ] Het aantal markers op de kaart is gelijk aan het aantal kaarten in de lijst bij hetzelfde filter — bewijs: DOM-telling van beide bij één filterstand
- [ ] De 3 bedrijven zonder KBO-adres staan als telling naast de kaart en verdwijnen niet — bewijs: de tekst van die teller in de DOM
- [ ] Typologie: de toggle vervangt de lijst binnen het bestaande tabblad en voegt geen tabblad toe — bewijs: telling van de tabbladen in de DOM, plus `flow --shot`
- [ ] Interactie: de kaartweergave is met het toetsenbord te bereiken en elke stop toont focus — bewijs: de toetsenbord-pass van de flow-harness op het kaartpaneel
- [ ] Interactie: er bestaat een niet-muis-pad naar de gegevens van één bedrijf — bewijs: `document.activeElement` na het tabben naar een marker of de bijbehorende lijst-fallback
- [ ] State *empty*: zonder geocode-cache legt de kaart uit wat er moet gebeuren — bewijs: `JOBRADAR_DB_PATH` naar een wegwerp-pad, dan de flow-harness
- [ ] States *loading* en *error*: `[NIET TE VERIFIËREN — geen fixture-laag in jobradar; zie `## Verify-pad` → "State forceren". Een kaart heeft een échte laadtoestand (tiles), dus hier is de leemte groter dan bij de lijst.]`
- [ ] Edge case: 43 bedrijven op Gent vallen in een cluster in plaats van 43 markers op elkaar — bewijs: DOM-telling van markers op het uitgezoomde beeld
- [ ] Edge case: inzoomen op dat cluster levert de losse markers — bewijs: markertelling na de zoom-actie
- [ ] Marker-kleuren komen uit de rollaag — bewijs: `getComputedStyle` op een marker tegen de CSS-variabele, gemeten ná 400 ms (zie `## Meten in dark mode`)
- [ ] De flow-harness meldt geen enkel verzoek buiten de eigen origin — bewijs: exit 0 met de regel "geen enkel verzoek buiten de eigen origin"; dít is het item dat de tile-keuze beslist
- [ ] `pnpm --filter jobradar flow --selftest` blijft zijn drie assen vangen — bewijs: exit 0 op de zelftest-run

## Beslissingsgeschiedenis

- 2026-09-08: TC-EBC aangemaakt. MapLibre GL gekozen boven Leaflet en een statische SVG-provinciekaart; Nominatim gekozen boven het Vlaamse adressenregister omdat dat Brussel (74 van de 215) niet dekt.
- 2026-09-08: De origin-guard van de flow-harness (`scripts/flow-harness.mjs:213-218`) gelezen op de bron en tot harde constraint gemaakt — de tile-bron is daarmee een ontwerpbeslissing, geen implementatiedetail.
