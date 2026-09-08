# Profile — umanex

Klant-laag voor umanex (jouw eigen werk). Gelaagd op de globale `CLAUDE.md` in `umanex-os`. Bevat wat over umanex als merk en werkstijl weten nodig is om zinvolle design-, copy- en architectuur-keuzes te maken.

Belangrijk verschil met klant-profiles: hier ben *jij* het merk. Het profile beschrijft jou als product-stijl en werkstijl, niet een externe klant.

**Wat hier niet hoort:** een opsomming van concrete apps of hun status. Die is afleidbaar met één `ls apps/` in `umanex-apps`, en veroudert hier stil — zodat een sessie redeneert over een app die er niet meer is. Per-app context staat in `apps/{app}/CLAUDE.md`. Wat wél hier hoort: wat je nergens uit de code kan aflezen.

---

## Wie en wat

**umanex** is Jeroens label voor zowel klantwerk als eigen producten en diensten. Eén aanspreekpunt — Jeroen — maar het werk wordt geleverd door Jeroen plus freelancers plus een agent-stack. Geen loonlijst: freelancers op afroep, tot er drie lopende opdrachten zijn.

Positionering: **een designteam voor softwarebedrijven met meer producten dan designers.** Je verkoopt capaciteit in dagen per maand, niet losse dagen en niet projecten. Het koopsignaal is het aantal softwarepakketten tegenover het aantal designers, niet de omvang van het bedrijf.

**De schaarste waar dat op rust:** bouwen is goedkoop geworden, oordelen en verifiëren niet. umanex-os is de machine voor precies die schaarste — en het komt in de repo van de klant te staan, niet in Jeroens hoofd. Dat eigendom is het verkoopargument tegenover "afhankelijk worden van iemand anders zijn systeem".

Vastgelegd in het bureau-plan *umanex 2027* (24 augustus 2026, artifact `0d79a364-bbcd-4880-8829-1d254d92bb78`), doorgerekend op de eigen cashflow-cijfers en op marktonderzoek. De uitwerking naar publieke copy staat in `apps/portfolio/briefings/2026-08-24-feature-bureau-positionering.tcebc.md`.

**Historiek.** Tot 2026-08-24 luidde de positionering **"Design Team Of One"**, later "Design Team Of One + AI". Die is vervallen, niet verzacht: het model maakt freelancers structureel vanaf de eerste lopende opdracht, dus één-persoon-zijn beloven spreekt het model tegen. Kom je die term nog tegen in oudere audits, briefings of op de Framer-site — dat is historiek, geen huidige lijn.

### Soorten output

Vijf categorieën, die bepalen hoe je over een vraag redeneert:

- **Bureauwerk** — designcapaciteit bij productbedrijven, onder umanex-merk. De groeilijn: scan → afgebakend traject → capaciteit per maand
- **Portfolio** — eigen showcase op umanex.be. Sinds 2026-08-24 de voordeur van het bureau, niet langer een persoonlijk portfolio voor hiring-beslissers
- **Eigen producten** — apps, tools en websites die je verkoopt of weggeeft
- **Klantwerk via een tussenpartij** — niet onder umanex-merk gepubliceerd, wel onder de hood gebouwd door umanex. Dit is de vloer waar het bureau bovenop groeit, niet de groei zelf
- **Consultancy** — strategisch werk, AI-aanpakken, design system rollouts

Alle eigen web- en mobile-apps leven in de `umanex-apps` monorepo, onder `apps/{app}/`.

### Doelgroep

**De koper staat voorop.** Eén profiel draagt het bureau; de rest is nevenpubliek.

- **Productbedrijven met meer software dan designers** — 20 tot 100 mensen, meer dan één softwarepakket in productie, eigen repo, meerdere developers, hoogstens één of twee designers. Beslisser: CTO, oprichter of head of product, tekenbevoegd zonder aanbesteding. Dit is de doelgroep waar copy, aanbod en site op geschreven zijn
- **Designers en dev teams in business software** — voor consultancy en klantwerk via een tussenpartij
- **Jezelf** — tools die je dagelijks gebruikt en deelt

**Uitdrukkelijk niet de doelgroep: "KMO" in de Vlaamse betekenis.** Dat woord is formeel betekenisloos en selecteert in het spraakgebruik precies de groep zonder repo en zonder budget. Onder 50 werknemers ontbreken zowel de developers als het geld — het *totale* IT-budget van een bedrijf met €1 mln omzet ligt in de orde van een enkel traject. Ook uit: freelancers en kleine bedrijven die hun eigen tools willen bouwen. Die stonden hier tot 2026-08-24 als doelgroep en zijn bewust geschrapt.

---

## Tone of voice

### Aanspreking en register

- **Je-vorm** — persoonlijk en warm. *"Je krijgt een design dat..."*
- **Direct + zelfverzekerd + vakman** — combinatie van *"Ik bouw..."* en *"In mijn ervaring..."*. Niet bescheiden. Niet ambtelijk. Niet over-marketing
- **Expert-toon mag** — *"Hier zijn de drie patronen die ik altijd zie:"* — past bij 10+ jaar ervaring

Geen aanspreking-vermijding zoals bij Columba. Geen voornaamwoord-nuance per taal zoals bij Luminus. umanex spreekt mensen aan als persoon — *"je"*, niet *"u"* of *"de gebruiker"*.

### Lengte en stijl

Geen vaste regels rond lengte. Geschikt voor:
- *Long-form copy* — blogposts, project case-studies, LinkedIn artikels
- *Korte zelfstandige zinnen* — portfolio intro's, button labels
- *Concrete actie-formuleringen* — bij prospect-reacties (zie voorbeelden onder)

### Taal

**Nederlands hoofdzakelijk**. Engels waar onvermijdelijk (technische termen die in NL ongebruikelijk zijn — *"design system", "tokens", "components", "edge cases"*).

Niet vertalen wat in het vakgebied actief Engels gebruikt wordt.

### Vocabulair

**Vakwoorden die actief gebruikt worden:**
- Design: design system, tokens, components, edge cases
- Positionering: B2B software, complex UX, business software teams
- Aanbod: capaciteit, dagen per maand, componentlaag, drift, nulmeting, scan
- Toekomst: workflow, AI-aanpak, agent, prompt
- Product/startup: lean, ship, iterate

**Termen die actief vermeden worden:**
- *Buzzwords:* "unleash", "empower", "transform", "next-level"
- *Corporate-jargon:* "leverage", "synergize", "best-in-class"
- *Zelfondermijning:* "misschien", "ik denk", "ik weet niet zeker"
- *Te-veel-modesty:* "gewoon", "simpel", "niets bijzonders"

Het juiste midden: **direct, met vakkennis, zonder marketing-fluff of ondermijning**.

### Drie naamregels rond het aanbod

Geen stijlvoorkeur maar bevindingen uit het marktonderzoek in het bureau-plan. Ze gelden overal waar het aanbod ter sprake komt — site, LinkedIn, mail, offerte, gesprek.

1. **Nooit "design abonnement" of "design retainer" in het Nederlands.** Die categorie zit in België op €249–1.295 per maand. Wie het woord gebruikt, verdedigt daarna een factor zes. Zeg: capaciteit, dagen, of een design-system-programma.
2. **Nooit "goedkoper dan een aanwerving".** Dat argument is aan tafel falsifieerbaar — een oprichter kent zijn loonlijst en rekent het in dertig seconden na, en de uitkomst valt de verkeerde kant op. Het anker is het projectbudget: een design system als project ligt in België rond €60.000, vooraf getekend en in één scope.
3. **Nooit onbeperkte inzet suggereren.** Het aantal dagen staat in het contract, dagen vervallen per maand met maximaal één maand doorrol. Onbeperkte-verzoeken-modellen bestaan alleen onder €1.500 per maand; erboven durft niemand de blootstelling aan.

Deze regels zijn afdwingbaar gemaakt in de portfolio-copy: `apps/portfolio/briefings/2026-08-24-feature-bureau-positionering.tcebc.md` heeft ze als toetsbare acceptatie-items, gemeten op de gerenderde pagina.

### Concrete voorbeelden

**Portfolio of LinkedIn intro:**

> "Meer producten dan designers? Ik lever de capaciteit om dat om te keren — één gedeelde componentlaag over al je interfaces, ingekocht in dagen per maand, met een systeem eronder dat bewaakt dat wat eruit komt klopt."

**Eerste reactie op een prospect-aanvraag:**

> "Bedankt. Een snelle eerste check leert dat dit haalbaar is. Ik kom morgen terug met een concreter voorstel."

Concreet, met expert-signaal, met tijdsindicatie. Niet *"Bedankt voor je bericht! Ik kijk graag..."* (te zacht, ondermijnt de directe-vakman-stem).

---

## Visueel en design

### Centrale design source

umanex heeft een **eigen `tokens.json` + Figma library** — gedeeld over portfolio en eigen producten. Eén umanex-DNA voor visueel werk. Dat is de default voor élk umanex-project.

**Een app mag een eigen token-set hebben** wanneer de context genoeg verschilt van web-DNA. De staande uitzondering is RowTrack (mobile): eigen `tokens.json`, eigen Figma-bron. Werk je aan zo'n app, gebruik dan de token-set van die app, niet de gedeelde umanex-set.

Bij twijfel welke tokens te gebruiken: vraag of het project umanex-DNA volgt of project-eigen DNA heeft. Welke set een app effectief gebruikt, lees je in zijn eigen `CLAUDE.md` — niet hier.

### Visuele karakteristiek

**ShadCN-stijl** — minimaal, neutraal, modern. Light + dark mode altijd ondersteund.

Niet "eigen merkstijl met sterke kleur en typografie". Niet "luxe en visueel rijk". Functioneel-neutraal — past bij de B2B software focus.

### Iconen

Geen vaste regel — wat past per project. Geen verplichte icon-bron over alle umanex projecten heen.

Staande keuzes per platform:
- **Web:** typisch Lucide
- **Mobile (Expo):** `@expo/vector-icons` (Ionicons) — om historische redenen rond de Fabric renderer, niet uit voorkeur

Bij twijfel: kijk naar het project zelf, of vraag.

### Layout-patronen

Geen vast voorgeschreven layout-patroon op profile-niveau. Per project context-passend gekozen.

### Visuele/structurele regels

Twee regels die wel altijd gelden:

- **Mobile-first denken** voor portfolio en consumer-tools
- **Toegankelijkheid** als basisprincipe — keyboard navigatie, screen readers, semantische HTML

---

## Tech

### Web werk

- **Next.js 14** + **TypeScript** + **Tailwind** + **ShadCN** — standaard stack voor portfolio en web producten
- **Tokens Studio + Style Dictionary** — design tokens pipeline, output naar CSS variables

### Mobile werk

- **React Native + Expo** — standaard stack voor mobile

### Hosting en infra

- **Vercel** — web hosting voor portfolio en web producten
- **Supabase** — default backend waar een app er een nodig heeft (auth, data, realtime)
- **GitHub** — code hosting voor alle umanex projecten (organisatie: github.com/umanex)

### Deploys

Vercel deployments doe **ik zelf manueel** — niet automatisch laten triggeren door Claude. Dit is een umanex-specifieke regel die de globale CLAUDE.md "geen Vercel deploys" regel concretiseert.

---

## Werkstijl

### Do's

- **Snelle iteraties met tussentijdse demo's** — *"ship to learn"*. Niet maandenlang in stealth bouwen
- **Klant betrekken in keuzes** — design-as-conversation. Niet beslissen voor de klant maar mét de klant
- **Pragmatisme boven perfectie** — 80/20 regel actief toepassen. Goed genoeg dat verzonden kan, niet eindeloos polijsten
- **Eigen onderzoek/experiment integreren in elk project** — RowTrack ontstond als uitloper van onderzoek naar BLE-integratie en gamification, niet als geïsoleerd product

### Don'ts

- **Werk zonder eind aan refinement** — tijd voor *"goed genoeg"*. Bij twijfel: ship en itereer
- **Endless scope creep** — strakke scope-discipline. Wanneer een vraag buiten scope valt: benoem het, parkeer het, of bespreek scope-uitbreiding expliciet

---

## Spanningen om bewust van te zijn

Vier dingen die in elke umanex-beslissing kunnen meespelen:

1. **De koper en de vakgenoot zijn verschillende lezers** — een CTO die capaciteit koopt en een designer die je werkwijze leest, hebben niet dezelfde vraag. De umanex-stem (direct, vakman, je-vorm) is constant, maar de *diepte* en het *vakjargon* mag schalen. Bij twijfel wint de koper: dat is waar het aanbod op geschreven is

2. **Je verkoopt input, je verhaal gaat over uitkomst** — het aanbod is in dagen geprijsd met een programma eromheen, terwijl het argument eronder over oordeel en verificatie gaat. Dat is bewust en tijdelijk: uitkomsten verkopen vraagt risico dragen op iets dat je niet volledig controleert, en dat kan pas met een buffer. Geloof de these over *wat* je bouwt en hoe je je positioneert; nog niet over hoe je betaald wordt. De scan is de brug — die levert het meetpunt dat outcome-pricing later mogelijk maakt

3. **Klant- versus eigen werk** — klantwerk wordt onder de hood gemaakt door umanex maar niet onder umanex-merk gepubliceerd. Eigen werk wel. Tone, depth en stijl kunnen verschillen — bij twijfel: vraag voor wie de output bedoeld is

4. **umanex-DNA versus project-DNA** — RowTrack heeft eigen tokens en eigen styling-keuzes. Niet alles wat onder umanex-paraplu valt deelt automatisch dezelfde visuele DNA. Wanneer een briefing voor een umanex project is, vraag eerst of het project umanex-DNA volgt of project-eigen DNA heeft.
