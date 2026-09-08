# Schermen naar RowTrack - Design

| | |
|---|---|
| **Datum** | 2026-09-08 |
| **Type** | feature |
| **Project** | rowtrack |
| **Klant** | umanex |
| **Status** | gepland |

---

```
TASK:        De schermen horen niet in de componentenbibliotheek. Haal ActivePhase en
             IdlePhase uit `RowTrack -  Design System` en zet alle RowTrack-schermen in
             `RowTrack - Design`, op de pagina *Screens v2*.

CONTEXT:     `RowTrack -  Design System` (QkRgMc7Quqtbow71DiYa1n) is de gepubliceerde library:
             33 pagina's, 15 component sets + 18 losse componenten, 24 slots, leesbare
             laagnamen. Twee van die 33 pagina's zijn géén component maar een scherm —
             ActivePhase (5 frames) en IdlePhase (4 frames). Ze staan er omdat de builder ze
             als "scherm" modelleert (representatieve frames, geen variant-assen), niet omdat
             ze in een library thuishoren. `RowTrack - Design` (T1bGrvIzSNeLyh5CbarATZ) draait
             sinds vandaag volledig op de library-variabelen en heeft een lege pagina
             *Screens v2* die hiervoor bedoeld is.

ELEMENTS:    Pagina *Screens v2* in RowTrack - Design · de 9 bestaande schermframes
             (ActivePhase ×5, IdlePhase ×4) · de overige RowTrack-schermen (aantal en
             samenstelling: OPEN VRAAG) · de gepubliceerde library als bron van instances ·
             de builder (figma/builder.js) en de bouwspec.

BEHAVIOUR:   Een designer opent *Screens v2* en ziet de schermen naast elkaar, elk met zijn
             naam. Wat hij daar aanraakt, hoort te reageren zoals de library het bedoelt:
             een knop in een scherm is een instance van Button, geen platte kopie.

CONSTRAINTS: De library blijft gepubliceerd en mag niet opnieuw breken — pagina's verwijderen
             raakt de publicatiestatus, dus dat gaat door dezelfde poort als een herbouw.
             Schermen zijn geen component sets: hun assen zijn in beeld niet orthogonaal
             (dat staat al als uitsluiting in `figma:check`). De guard verwacht per story-
             component één Figma-pagina in het library-bestand; twee pagina's weghalen raakt
             de `[dekking]`- en `[pagina]`-as.
```

---

## Open vragen

Geen. De vier kritische items zijn beantwoord — zie Beslissingen hieronder.

## Beslissingen (2026-09-08, door Jeroen)

**1. Uit library-instances.** Een knop in een scherm wordt een échte `Button`-instance met zijn
slots gevuld; wijzigt Button in de library, dan schuiven de schermen mee. Dat vraagt een nieuw
mechanisme, want de bouwspec is een DOM-boom zonder componentgrenzen. **De haak bestaat al:**
de naamgevingspas markeert nodes met `naamBron === 'component'` wanneer de winnende
StyleSheet-sleutel uit een ánder componentbestand komt — dat is precies een componentgrens.
Gemeten na reviewronde 1: 12 zulke paren, alle twaalf tegen de broncode getoetst, waaronder
`IdlePhase > Chip` (12×), `IdlePhase > DeviceRow` (8×), `ActivePhase > Button` (5×).

**2. Alle elf routes.** Niet alleen de negen frames die al een render-pad hebben. Zeven routes
hebben er geen: vier auth-schermen (145–192 regels, alleen een router-mock nodig) en drie
data-schermen (`profile` 1003 regels, `history/index` 308, `history/[id]` 683 — supabase,
auth, route-parameters en data-fetch). Voor elk daarvan komt er eerst een story.

**3. Pagina's uit de library verwijderen, guard aanpassen.** `[dekking]` en `[pagina]` eisen nu
één Figma-pagina per story-component. Schermen krijgen daar een **expliciete uitsluiting** met
reden — telbaar, zoals de bestaande uitsluitingen — in plaats van dat de assen stil zachter
worden.

**4. Interactie-modaliteit: geen.** Statische schermweergaven, geen prototype-bedrading.

## Aannames

- `[ASSUMPTION]` **Component-typologie**: schermen worden `FRAME`s op *Screens v2*, geen
  COMPONENT en geen COMPONENT_SET. Een scherm is geen herbruikbaar ding; er hoeft niets van
  geïnstantieerd te worden.
- `[ASSUMPTION]` **States**: de bestaande 9 frames zijn de states (Playground, Niet Verbonden,
  Doel Afstand, Toestel Keuze, Zonder Hartslagband, Doel Bereikt, Samenvatting). Loading,
  empty en error zijn eigen componenten en horen niet als schermvariant terug.
- `[ASSUMPTION]` De verplaatsing gaat via een herbouw in het doelbestand plus verwijderen in
  de bron, niet via kopiëren-plakken tussen bestanden — dat laatste is niet scriptbaar en
  breekt de bouwhash.

## Acceptatie

**Fase 1 — render-pad voor de zeven routes zonder story**

- [ ] Een `expo-router`-mock in `.storybook/` vangt `useRouter`, `Link`, `useLocalSearchParams` en `Stack` af — bewijs: de vier auth-stories renderen zonder console-fout
- [ ] De supabase-mock levert vulbare data in plaats van alleen `{data:null,error:null}` — bewijs: `history/index` toont rijen, niet zijn empty state
- [ ] Een auth-context-mock levert een ingelogde gebruiker — bewijs: `profile` rendert zijn ingelogde vorm
- [ ] Zeven nieuwe stories, elk met minstens één benoemde frame-story naast Playground
- [ ] `render:sweep` blijft groen op álle stories, oud en nieuw, zonder lege render

**Fase 2 — het instance-mechanisme**

- [ ] De builder plaatst op elke node met `naamBron === 'component'` een instance uit de library in plaats van de subboom na te bouwen
- [ ] De slots van zo'n instance worden gevuld uit de tekstnodes die de spec op die plek meet — komt een waarde niet precies één keer voor, dan meldt hij dat in plaats van te gokken
- [ ] Een geplaatste instance is en blijft `type === 'INSTANCE'` met een `remote` main component — bewijs: teruggelezen via de runtime ná het zetten van de slots
- [ ] Elke instance die de builder NIET kan plaatsen (geen library-tegenhanger, of de variant is niet af te leiden) komt in `meldingen`, niet stil als platte kopie
- [ ] De variantkeuze is gemeten, niet gegokt: de gekozen variant komt overeen met de gemeten geometrie, of de builder meldt dat hij de default nam

**Fase 3 — de verhuizing**

- [ ] `Screens v2` in `RowTrack - Design` draagt alle schermframes, elk met zijn naam
- [ ] De pagina's ActivePhase en IdlePhase zijn weg uit `RowTrack -  Design System`
- [ ] `[dekking]` en `[pagina]` sluiten schermen expliciet uit, mét reden, en die uitsluiting is telbaar in de guard-uitvoer
- [ ] De 31 resterende library-componenten blijven `CURRENT` — het verwijderen van twee pagina's raakt hun publicatiestatus niet
- [ ] `figma:check` blijft groen op alle assen, met een vers manifest ná de wijziging en vóór `figma:links`
- [ ] `parity` meet de schermen in hun nieuwe bestand — of, als dat niet kan, staat er `[NIET TE VERIFIËREN — reden]` in plaats van een zachter item

**Afgeschreven assen**

- [ ] States n.v.t. voor de verhuizing zelf; de bestaande 9 frames ZIJN de states van het workout-scherm, en de zeven nieuwe routes krijgen hun states uit hun eigen stories
- [ ] Interactie n.v.t. — statische weergaven, geen prototype-bedrading

## Beslissingsgeschiedenis

- 2026-09-08: briefing geopend. Vraag 1 (instances of plat) is de kantelvraag; de rest volgt eruit.
- 2026-09-08: alle drie beantwoord — instances, alle elf routes, pagina's weg uit de library. De
  scope groeide daarmee van "twee pagina's verplaatsen" naar "zeven render-paden bouwen plus een
  nieuw bouwmechanisme"; dat is drie fasen, niet één.
