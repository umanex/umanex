# Prospectkaart

---
Datum:   2026-09-08
Type:    feature
Project: jobradar
Klant:   umanex
Status:  gebouwd
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
             - `ProspectMap` als inline SVG — geen kaart-library, geen tiles
             - `public/geo/provincies.json` — de drie provinciegrenzen, 6 KB
             - Marker per bedrijf, kleur uit de rollaag = opvolgstatus. Twee vórmen: een
               adres uit de KBO-bron, en een KBO-*vermoeden* bij een lead — dat tweede is
               een gok en hoort er anders uit te zien
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

CONSTRAINTS: - **Geen tiles, dus ook geen tile-bron.** Gemeten 2026-09-09: de drie
               provinciegrenzen wegen als GeoJSON 6 KB (Natural Earth admin-1, uitgekleed
               tot naam plus geometrie); het tile-pad over datzelfde gebied kost z7-z12
               samen 528 tiles, en bij een gemeten 218 KB per tile is dat +/-112 MB per
               volledige sessie. Bij 227 stippen voegt een basemap die 18 000x zwaarder is
               niets toe dat de stippen niet zelf zeggen.
             - **Geen kaart-library.** maplibre-gl@6.8.0 is 19,1 MB uitgepakt met 17
               dependencies (gemeten op de npm-registry) - voor drie polygonen en 227
               punten. Het wordt inline SVG met een eigen projectie; pan, zoom en
               clustering bouwen we zelf. Deze keuze verving MapLibre nadat de
               tile-aanname kantelde, niet stil maar met de keuze opnieuw voorgelegd.
             - Dit houdt de flow-harness per constructie schoon: geen enkel verzoek naar
               buiten, dus de origin-guard (scripts/flow-harness.mjs:213-218) kan niets
               afbreken.
             - Geocoding gebeurt eenmalig in een CLI, nooit tijdens een request
             - Marker-kleuren komen uit de rollaag, geen rauwe hex
             - Attributie van de grenzendata staat zichtbaar bij de kaart
             - Adresdata gaat alleen naar de geocoding-bron, en alleen tijdens die run
```

---

## Open vragen

- **Wat is "precisie"?** Nominatim geeft niet altijd een huisnummer-treffer. Voorstel: een
  derde markervorm, zodat de kaart drie zekerheidsniveaus draagt — KBO-adres, KBO-vermoeden
  bij een lead, en een geocode die het huisnummer niet vond.

## Aannames

- `[ASSUMPTION: het zeteladres (TypeOfAddress REGO) is het adres dat we mappen]` — niet
  de vestigingseenheden. 215 van de 218 hebben er één; vestigingen zijn een aparte tabel
  en een aparte vraag.
- `[ASSUMPTION: de provinciegrenzen komen uit Natural Earth (admin-1, 10m)]` — gemeten
  6 KB voor de drie, 37 KB voor alle elf. De fijnere geoBoundaries-set (17
  arrondissementen, 130 KB) is afgewezen: die draagt Franse namen in een Nederlandse UI.
- `[ASSUMPTION: geocoding via Nominatim, éénmalig, resultaat in de DB]` — gekozen boven
  het Vlaamse adressenregister omdat 74 van de 215 in Brussel liggen en dat register die
  niet dekt. Het tempo van max één verzoek per seconde komt uit de gebruiksvoorwaarden
  van de dienst, niet uit een meting van mij.
- `[ASSUMPTION: desktop-first]` — de kaart is een werkinstrument, geen veldtoepassing.
- `[ASSUMPTION: geen realtime; de kaart leest wat de laatste geocode-run opleverde]`

## Acceptatie

- [x] Na één geocode-run heeft elk bedrijf met een KBO-adres een rij in `geocode_cache` — bewijs: `count(*)` tegen het aantal bedrijven met zeteladres — bewijs: 220 van de 230 gelukt (198 huisnummer, 22 straat); 7 niet gevonden en 3 zonder zeteladres staan als bewaarde uitkomst
- [x] Elke opgeslagen coördinaat ligt binnen België — bewijs: `SELECT count(*)` op lat buiten 49,4–51,6 of lon buiten 2,5–6,5, hoort 0 te zijn — bewijs: de CLI weigert een treffer buiten 49,4–51,6 / 2,5–6,5 als verkeerde treffer; 0 rijen erbuiten
- [x] Een tweede geocode-run doet geen enkel verzoek voor een al gelukte rij — bewijs: het verzoek-aantal van de tweede run tegen dat van de eerste — bewijs: tweede run meldde "3 al gegeocodeerd · 227 te doen"
- [x] Een afgebroken run verliest niets: wat vóór de onderbreking gelukt was staat er ná nog — bewijs: rijtelling vóór het afbreken en na de herstart — bewijs: elke uitkomst wordt onmiddellijk weggeschreven; na --max=3 stond de cache op 3 en hervatte de volgende run daar
- [x] De kaart tekent de selectie van het **actieve filter**, niet een vaste set — bewijs: flow-harness `kaart: bron "Lijst" versmalt 215 → 206 punten`; tegenproef met de fix weggenomen gaf `bron "Lijst" gaf 217 punten bij 217 — het filter doet niets` (rc=1)
- [x] Elk punt op de kaart zit in dezelfde selectie als de lijst — bewijs: `kbo`-scenario's, de nummers-projectie levert per filterstand exact het aantal dat de telling telt, over 5 standen (kbo · csv · beide · beide+winstgevend · geen regio)
- [x] Ook de lead-laag volgt regio, zoekterm en bron — bewijs: flow-harness `bron "Lijst" laat geen lead-vermoedens staan`; tegenproef gaf `toont nog 9 lead-vermoedens`
- [x] Wat door een filterkeuze wegvalt, verdwijnt niet stil — bewijs: flow-harness `de 32 punten buiten het filter worden gemeld`, telling `buitenFilter` naast de bestaande drie
- [x] Een filter dat niets overlaat legt uit dát het aan het filter ligt — bewijs: browsertoets op :3003, `zoek=xyzzy` toont "Geen enkel bedrijf met een coördinaat valt binnen je huidige filters — 245 vallen erbuiten"
- [x] De 3 bedrijven zonder KBO-adres staan als telling naast de kaart en verdwijnen niet — bewijs: de tekst van die teller in de DOM — bewijs: de telregel in de DOM: "3 bedrijven uit de lijst staan niet in de KBO-spiegel"
- [ ] Typologie: de toggle vervangt de lijst binnen het bestaande tabblad en voegt geen tabblad toe — bewijs: telling van de tabbladen in de DOM, plus `flow --shot`
- [ ] Interactie: de kaartweergave is met het toetsenbord te bereiken en elke stop toont focus — bewijs: de toetsenbord-pass van de flow-harness op het kaartpaneel
- [ ] Interactie: er bestaat een niet-muis-pad naar de gegevens van één bedrijf — bewijs: `document.activeElement` na het tabben naar een marker of de bijbehorende lijst-fallback
- [ ] State *empty*: zonder geocode-cache legt de kaart uit wat er moet gebeuren — bewijs: `JOBRADAR_DB_PATH` naar een wegwerp-pad, dan de flow-harness
- [ ] States *loading* en *error*: `[NIET TE VERIFIËREN — geen fixture-laag in jobradar; zie `## Verify-pad` → "State forceren". Een kaart heeft een échte laadtoestand (tiles), dus hier is de leemte groter dan bij de lijst.]`
- [x] Edge case: 43 bedrijven op Gent vallen in een cluster in plaats van 43 markers op elkaar — bewijs: DOM-telling van markers op het uitgezoomde beeld — bewijs: de render toont clusters van 32, 33 en 18 in plaats van een vlek
- [ ] Edge case: inzoomen op dat cluster levert de losse markers — bewijs: markertelling na de zoom-actie
- [ ] Marker-kleuren komen uit de rollaag — bewijs: `getComputedStyle` op een marker tegen de CSS-variabele, gemeten ná 400 ms (zie `## Meten in dark mode`)
- [x] De flow-harness meldt geen enkel verzoek buiten de eigen origin — bewijs: exit 0 met die regel in de uitvoer — bewijs: exit 0 met die regel — er is geen basemap, dus per constructie niets om te lekken
- [x] Er staat geen kaart-library in `package.json` — bewijs: `git diff` op dat bestand toont geen dependency — bewijs: `git diff` op dat bestand toont alleen script-regels, geen dependency
- [x] Het grenzenbestand is kleiner dan 20 KB — bewijs: `ls -l` op `public/geo/provincies.json` — bewijs: `ls -l public/geo/provincies.json` geeft 5,9 KB
- [x] De kaart toont zonder zeven alles wat gegeocodeerd is en binnen de provincies valt — bewijs: `/api/kaart?werkgevers=0` geeft 217 punten (208 uit de lijst, 9 lead-vermoedens) van de 220 gelukte geocodeerrijen; de 3 die overblijven liggen buiten de provincievlakken en staan als eigen teller. De 227 uit de eerste opzet klopte niet: 12 vermoedens werd 9 na aftrek van de drie die met een lijstrij samenvielen of buiten de vlakken lagen
- [x] De 15 leads zonder adres staan als teller boven de kaart — bewijs: de tekst van die melding in de DOM — bewijs: flow-harness: "de 15 leads zonder adres worden gemeld"
- [x] Een lead-vermoeden is zichtbaar anders dan een KBO-adres — bewijs: telling per markervorm in de DOM — bewijs: flow-harness: alle 9 vermoedens gemarkeerd, als losse ruit of als gestreept cluster
- [ ] `pnpm --filter jobradar flow --selftest` blijft zijn drie assen vangen — bewijs: exit 0 op de zelftest-run

## Beslissingsgeschiedenis

- 2026-09-08: TC-EBC aangemaakt. MapLibre GL gekozen boven Leaflet en een statische SVG-provinciekaart; Nominatim gekozen boven het Vlaamse adressenregister omdat dat Brussel (74 van de 215) niet dekt.
- 2026-09-09: **De kaart volgde het filter niet, en geen enkele check zag dat.** `/api/kaart` las nul parameters en `ProspectMap` stuurde er nul; `/api/kaart?herkomst=kbo&regio=OVL&zoek=xyzzy` gaf dezelfde 217 punten als een kale aanroep. Alle bestaande kaart-checks telden markers tégen het antwoord, en dat antwoord negeerde het filter zélf — die klasse is per constructie onzichtbaar voor een telling in één filterstand. De fix is niet de ontbrekende parameter maar de dubbele plek: `filterQuery` (client) en `leesFilter` (server) staan nu naast `ProspectFilter` in `lib/kbo/universum.ts`, en lijst én kaart gebruiken allebei die ene declaratie. De harness heeft er een tweede filterstand bij, want alleen die kan dit rood maken.
- 2026-09-09: De **lead-laag volgt niet de volledige prospectselectie**, wél regio, zoekterm en bron. Gemeten: van de 12 lead-vermoedens halen er **2** de prospectselectie — een lead komt uit een vacaturebron en draagt geen NACE-hoofdactiviteit, geen RSZ-registratie en geen EBITDA, dus die zeven toepassen zou er tien stil laten verdwijnen. Dat is de afkapping-zonder-melding die deze app elders juist vermijdt.
- 2026-09-09: Zonder KBO-spiegel geeft de kaart **nul punten met uitleg** in plaats van 220 ongefilterde stippen. De selectie vertrekt van `enterprise`, dus zonder spiegel bestaat er geen selectie om tegen af te zetten — een kaart die dan tóch alles tekent, spreekt de lijst ernaast tegen die op datzelfde moment zegt dat er niets te tonen valt.
- 2026-09-08: De origin-guard van de flow-harness (`scripts/flow-harness.mjs:213-218`) gelezen op de bron en tot harde constraint gemaakt — de tile-bron is daarmee een ontwerpbeslissing, geen implementatiedetail.
- 2026-09-09: Tile-vraag beslist op een meting in plaats van een voorkeur. Drie provinciegrenzen: 6 KB. Het tile-pad over hetzelfde gebied: 528 tiles x 218 KB gemeten = +/-112 MB. Gekozen: alleen grenzen, geen basemap — dus geen proxy, geen externe dienst, en de origin-guard van de harness kan per constructie niets afbreken.
- 2026-09-09: MapLibre GL vervangen door inline SVG. Die keuze was gemaakt toen tiles nog het uitgangspunt waren; zonder tiles is 19,1 MB met 17 dependencies (gemeten) te veel voor drie polygonen en 227 punten. Opnieuw voorgelegd nadat de aanname kantelde, niet stil bijgesteld.
- 2026-09-09: Herkomsten: de lijst plus de leads, en dat is kleiner dan gedacht — 215 + 12 = 227 punten, niet 242. Vijftien van de 27 leads hebben geen adres: een lead draagt geen ondernemingsnummer en de KBO-koppeling vindt er maar 12. Die 12 zijn vermoedens en krijgen een eigen markervorm; de 15 staan als teller boven de kaart.
- 2026-09-09: Gebouwd. De volledige geocode-run gaf 220 van de 230; de eerste ronde faalde op 16, waarvan 13 in Brussel of met een gemeente-achtervoegsel — OSM voert daar de Franse namen. Een tweede zoekvariant met StreetFR/MunicipalityFR haalde er 6 terug.
- 2026-09-09: De eerste render legde iets bloot dat geen enkele check zag: drie lead-vermoedens stonden als losse ruiten in leeg wit, buiten elk provincievlak. `binnenKaart` toetst de rechthoek, en die is ruimer dan de vlakken. Punt-in-polygoon erbij, de drie apart geteld en gemeld — de zoekstraal van de vacaturebron loopt over de provinciegrens, wat voor vacatures al in `CLAUDE.md` staat.
