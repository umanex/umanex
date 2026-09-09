# Schermen naar RowTrack - Design

| | |
|---|---|
| **Datum** | 2026-09-08 |
| **Type** | feature |
| **Project** | rowtrack |
| **Klant** | umanex |
| **Status** | gebouwd |

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

- [x] Een `expo-router`-mock in `.storybook/` vangt `useRouter`, `Link`, `useLocalSearchParams` en `Stack` af — bewijs: `.storybook/mocks/expo-router.tsx` (commit `f681424`), en de vier auth-stories staan in de 257 die `render:sweep` zonder console-fout rendert. Eén afwijking: `useFocusEffect` mocht geen no-op zijn — als no-op bleef ProfileScreen stil in zijn loading-tak (7 nodes, geen tekst, geen fout), dus hij draait als `useEffect`.
- [x] De supabase-mock levert vulbare data in plaats van alleen `{data:null,error:null}` — bewijs: `HistoryScreen/Playground` meet **130 nodes** tegen **35** voor `HistoryScreen/Leeg` (geteld in `figma/build-spec.min.json`), en de tekstinventaris van Playground draagt vijf ritten (1 t/m 5 sep) met hun waarden.
- [x] Een ingelogde gebruiker bereikt het scherm — bewijs: `ProfileScreen/Playground` toont *"Jeroen"* onder `ACCOUNT`, `ProfileScreen/Onvolledig` toont daar `—`. **De briefing vroeg een auth-context-mock; die is er bewust niet.** `lib/auth-context.tsx` haalt zijn gebruiker uit `supabase.auth.getSession()`, dus een sessie in de supabase-mock voedt de échte `AuthProvider`. Het item is daarom herschreven naar wat er te meten valt — als "auth-context-mock" kon het per constructie nooit meer waar worden.
- [ ] Zeven nieuwe stories, elk met minstens één benoemde frame-story naast Playground — **4 van de 7**, en dat blijft zo. `ResetPasswordScreen` (Met Link), `HistoryScreen` (Leeg, Een Record), `WorkoutDetailScreen` (Zonder Hartslag, Niet Gevonden) en `ProfileScreen` (Onvolledig, Zonder Gewicht) hebben er een; `LoginScreen`, `RegisterScreen` en `ForgotPasswordScreen` niet. Reden: hun enige tweede vorm is de validatiefout, en die ontstaat uit component-state ná een submit — een story kan hem niet zetten zonder dat het scherm er een ingang voor krijgt. Zie `BACKLOG.md` (2026-09-09, drie auth-schermen).
- [x] Geen console-fout in enige story — bewijs: `render:sweep` meldt *alle 257 stories renderen: geen console-fout* (was 197 stories vóór deze ronde).
- [x] Geen lege render in enige story — bewijs: dezelfde run, *geen lege render*; `figma:spec` meet daarnaast 54 grenzen en `fouten: 0`.

**Fase 2 — het instance-mechanisme**

- [x] De builder plaatst op elke node met een GEDECLAREERDE grens een instance in plaats van de subboom na te bouwen — bewijs: 88 instances over 10 frames, exact het aantal buitenste grenzen dat vooraf uit de bouwspec gemeten werd (teruggelezen via `figma_execute` in RowTrack - Design). De haak is `data-testid`/`data-bron` geworden, niet `naamBron === 'component'`: die heuristische tak bestaat sinds ingreep 1 niet meer.
- [x] De slots worden gevuld uit wat de spec op die plek meet — bewijs: de zes KpiRow-instances in ActivePhase/Playground tonen Split 01:52, Watt 208, SPM 26, BPM 148, Totaal afstand 5.000 m, Totaal Kcal 238, elk zijn eigen waarde. Niet via de `slot`-markering (die komt uit story-args en staat niet op een schermnode) maar via het PAD waar die markering in de eigen variant zat, gerekend vanaf de componentgrens.
- [x] Een geplaatste instance is en blijft `type === 'INSTANCE'` met een `remote` main component — bewijs: teruggelezen via de runtime, 88 van 88 `remote: true`, 0 lokaal.
- [x] Elke instance die de builder NIET kan plaatsen komt in `meldingen` — bewijs: de tak bestaat en is onderweg gezien (15 meldingen toen de slotpaden nog één niveau te hoog stonden); de eindbouw geeft er 0 voor ActivePhase en 2 voor IdlePhase, en die twee gaan over een ontbrekende text style, niet over een instance.
- [x] De variantkeuze is gemeten, niet gegokt — bewijs: `data-variant` uit `lib/variantData.ts`, en de teruglezing toont per instance de gekozen as-waarden (KpiRow `divider=false` op de laatste rij, `disabled=true` op de BPM-rij, ProgressBar `fillKind=gradient, richting=h`). Een afdruk op de gemeten geometrie is expliciet verworpen: op de buitenmaat botsen 11 van de 21 componenten, en diep matchte hij 1 van de 88.

**Fase 3 — de verhuizing**

- [x] `Screens v2` draagt alle schermframes, elk met zijn naam — bewijs: **24 frames over 9 schermen** (stand 2026-09-09, geteld in `figma/geometry.schermen.json` en live teruggelezen op `Screens v2`), elk met zijn `scherm`/`frame`-pluginData. Bij het schrijven van dit item waren het er 10 — alleen de twee workout-schermen; de veertien route-frames kwamen er in fase 1 bij.
- [x] De pagina's ActivePhase en IdlePhase zijn weg uit de library — bewijs: 33 → 31 pagina's, 786 nodes verwijderd, `resterendMetSchermnaam: 0` (fase 0a, 2026-09-08).
- [x] `[dekking]` en `[pagina]` sluiten schermen expliciet uit mét reden, telbaar in de uitvoer — bewijs: `scripts/schermen.mjs` is één bron, en de guard toont per scherm een `[uitgesloten]`-regel met reden — negen sinds fase 1, twee toen dit item geschreven werd; `[pagina]` FAALT bovendien zolang een scherm nog een library-pagina heeft.
- [x] De resterende library-componenten blijven bruikbaar — bewijs: 45 van 45 `gepubliceerd` in `figma/library-component-keys.json`, en alle 88 instances hebben een `remote` main component.
- [x] `figma:check` groen op alle assen met een vers manifest — bewijs: 13 van 13 assen, 44 van 44 tegenproef-mutaties.
- [x] `parity` meet de schermen in hun nieuwe bestand — bewijs: `figma/geometry.schermen.json` wordt samengevoegd met de library-geometrie; 205 varianten, 2 807 nodes, 22 227 velden. **0 verschillen**, over 205 varianten, 2 830 nodes en 22 391 velden. De eerste bouw gaf er 42, en die zijn bij de bron opgelost in plaats van weggeratelt: de gemeten layout gaat als override op de instance, ná het aanhangen toetst de builder of elke instance getrouw is en vervangt hij de rest door de nagebouwde subboom (16 van de 88), en in een tweede bestand importeert hij de remote stijlen en variabelen — `RowTrack - Design` heeft er nul lokaal, waardoor twee Buttons hun `shadow/buttonPrimary` verloren. Tweezijdig getoetst: één gemuteerde node geeft exit 1, hersteld exit 0.

**Afgeschreven assen**

- [x] States n.v.t. voor de verhuizing zelf — bewijs: de states zitten in de frames, niet in een aparte as. `figma/geometry.schermen.json` telt 24 frames over 9 schermen, waaronder `HistoryScreen/Leeg` (35 nodes tegen 130 voor Playground) en `WorkoutDetailScreen/Niet Gevonden` (8 nodes): de lege en niet-gevonden toestanden zijn gebouwd en gemeten.
- [x] Interactie-modaliteit n.v.t. — bewijs: `Screens v2` draagt geen enkele prototype-verbinding; de frames zijn statische weergaven. De builder legt er ook geen (`figma/builder.js` kent `reactions` niet).
- [x] Edge cases: de kappen van de walker zijn de edge case, en ze zijn nu telbaar — bewijs: de dieptekap staat op 12 en de walker rapporteert per run wat hij weggooit (`dieptekap: 0 node(s) weggekapt` op de huidige spec, tegen 3 018 bij de oude waarde 8). De breedtekap blijft bewust staan (62 confetti-kinderen → 4) en logt elke afkapping in `afkappingen`: 1 072 nodes over 11 plekken, alle elf breedte.

## Eindmeting (het plan vroeg vijf getallen)

Het plan `vivid-kindling-hollerith.md` sluit af met vijf getallen die "te meten" waren. Ze stonden
nergens vastgelegd; hier staan ze, gemeten op 2026-09-09 uit `figma/laagnamen.json` per commit.

| | plan-baseline `f4824d9` | na ronde D `dcef5b1` | main `2026-09-09` | plan verwachtte |
|---|---:|---:|---:|---|
| `perBron.testid` | — | 242 | **304** | ≥ 44 ✅ |
| `componentZonderTestID` | 44 | 0 | **0** | 0 ✅ |
| `terugval` | 288 | 47 | **82** | ≈ 0 ❌ |
| `ambigu` | 177 | 97 | **302** | "te meten" ❌ |
| app-nodes (de noemer) | 1 935 | 2 982 | 3 700 | — |

**Twee van de vijf zijn na ronde D verslechterd, en dat is geen noemer-effect.** De noemer groeide
24% (2 982 → 3 700), de ambiguïteit 211% (97 → 302). Als *aandeel*: 3,3% → **8,2%**. Voor `terugval`
1,6% → 2,2%. De oorzaak is niet toegewezen — het kan de zeven route-schermen zijn (nieuwe code die
sleutels deelt met bestaande componenten) of de diepere dieptekap (nodes die er altijd waren en nu
pas meetellen), en dat verschil is met twee `--hernoem`-runs uit te rekenen.

**Wat dit blootlegt is erger dan het getal.** Er is geen ratel op `ambigu` of `terugval` — de guard
rapporteert ze alleen in `uitgesloten`. En de tegenproef van de guard bevat letterlijk
`ok controle-ambigu — verdrievoudig het aantal ambigue nodes → exit 0 (hoort 0)`: de zelftest
*bevestigt* dat de as groen blijft bij precies de verandering die daarna echt gebeurde (bijna exact
een verdrievoudiging). De as is dus per constructie blind voor deze regressie. Zie `BACKLOG.md`
(2026-09-09, ambiguïteit).

**Instance-ratio, in één noemer.** Het plan vroeg "ActivePhase-scherm van 2/45 naar — te meten".
Live geteld op `Screens v2` (2026-09-09), waarbij een node meetelt als hij een instance *kan* zijn —
alles ónder een instance is library-inhoud en telt niet mee: **`ActivePhase/Playground` 9 van 12**,
over alle 24 frames **100 van 1 096**. De 2/45 uit het plan telde spec-nodes aan de browserkant en is
dus geen zuivere vergelijking; wat wél vergelijkbaar is: waar het scherm vóór dit plan twee
instantieerbare nodes had, dragen de drie kleinste ActivePhase-frames er nu negen van hun twaalf.

## Beslissingsgeschiedenis

- 2026-09-08: briefing geopend. Vraag 1 (instances of plat) is de kantelvraag; de rest volgt eruit.
- 2026-09-09: fase 2 en 3 gebouwd. Besluit 1 (instances) is uitgevoerd met een andere haak dan gedacht: de briefing rekende op `naamBron === 'component'` — 12 gemeten paren — maar die heuristiek bestaat niet meer. Ingreep 1 gaf elk component een gedeclareerde grens, en dat werden er 88 in plaats van 12. Wat de briefing niet voorzag: de variantkeuze vroeg een derde annotatie (`data-variant`), want uit de gemeten geometrie is hij niet af te leiden. Fase 1 — de zeven routes zonder render-pad — stond op dat moment nog open; die is later diezelfde dag gebouwd, zie de regel hieronder.
- 2026-09-08: alle drie beantwoord — instances, alle elf routes, pagina's weg uit de library. De
  scope groeide daarmee van "twee pagina's verplaatsen" naar "zeven render-paden bouwen plus een
  nieuw bouwmechanisme"; dat is drie fasen, niet één.
- 2026-09-09: fase 1 gebouwd — zeven route-schermen, 14 frames, 257 stories. Twee dingen liepen anders dan de briefing voorzag. De **auth-context-mock is er niet**: een sessie in de supabase-mock voedt de échte `AuthProvider`, en een tweede mock zou dezelfde waarheid een tweede keer opschrijven. En de bouw legde een gat in het instrument bloot dat groter was dan de fase: de **dieptekap van de walker sneed 3 018 nodes weg en meldde er 0**, omdat de teller ernaast alleen weggegooide `[data-testid]`-grenzen telde. Daardoor stond `parity` groen op een KPI-rij die in de browser `2:35:00` toont en in de spec leeg was. Kap naar 12, teller naar alles; GoalSheet bleek 48 nodes te missen en WorkoutCard een tweede vorm (de zebra-tegel) die de library niet kon uitdrukken.
- 2026-09-09: deze acceptatielijst is bijgewerkt ná een audit, niet tijdens de bouw. De vorige poging schreef niets: een `cd apps/rowtrack && python3 …` faalde op de `cd` (de shell stond er al), `&&` kortsloot, en de telling erná las het ónveranderde bestand als bevestiging. De commit-body van `c195a96` beweert daardoor iets dat niet gebeurd is — dat is een fout in het statusbericht, niet in het werk.
