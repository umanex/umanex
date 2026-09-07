# portfolio — projectcontext

Portfoliosite. Next.js (App Router), dev op poort 3001.

Dit bestand is bewust **minimaal**: het bevat alleen wat gemeten is. Vul de rest aan wanneer er
echt aan deze app gewerkt wordt — verzonnen projectcontext is schadelijker dan geen.

## Design-systeem-bron

Welke laag deze app zijn vorm van krijgt. Gemeten, niet afgeleid: `scripts/design-system-guard.mjs`
toetst elke regel hieronder tegen wat er op schijf staat. "geen" is overal een geldig antwoord,
mits het er staat.

- **Preset:** `@umanex/config/tailwind/preset`
- **Componentbron:** `@umanex/ui`
- **Storybook:** `pnpm --filter @umanex/ui storybook` (:6006)

`components/ui/` bevat hier bewust géén primitives: `Reveal`, `RichText`, `AccentBar`,
`CheckList` en `PhotoPlaceholder` zijn portfolio-eigen presentatiecomponenten zonder
tegenhanger in `@umanex/ui`. Een `Button` of `Input` hoort hier niet te ontstaan.

---

## Verify-pad

Wat de `verify`-skill hier kan uitvoeren. Vastgesteld 2026-08-08 door het te draaien, niet door
het af te leiden. Staat er "geen", dan is dat een gat dat gebouwd moet worden — geen vergetelheid.

| Capability | Commando / status |
|---|---|
| **Render vastleggen** | `pnpm --filter portfolio flow --shot=.flow-shots` — full-page PNG per route op de verse build. Gemeten: `index`, `aanbod`, `scan`, `werkwijze`, `cases`, `carriere`. Voeg `--dark` toe voor de dark-variant (`*-dark.png`); die zet `theme=dark` in localStorage vóór het eerste document en toetst daarna dat de `dark`-class er écht staat, zodat een dark-run niet stilzwijgend light rendert. `.flow-shots/` is gitignored: bewijs van één run, geen artefact. |
| **Flow aandrijven** | `pnpm --filter portfolio flow` — Playwright op een verse build. Laadt zes routes, klikt één echte interne link (gemeten: `/carriere → /`), telt console-fouten, en meet daarna elke route opnieuw op 375 px breed op horizontale overflow. `--headed` om mee te kijken. |
| **State forceren** | **Geen.** Dit is een statische site zonder data-laag: er is niets dat kan laden, leeg zijn of falen. Loading/empty/error zijn hier niet van toepassing in plaats van onbereikbaar — dat verschil is belangrijk, want het is géén gat dat gedicht moet worden. |
| **Invariant draaien** | **Geen, en niet nodig.** Er is geen afgeleide berekening in deze app; de invariant-as heeft hier niets om over te gaan. |
| **Verse build** | Zit ín de harness: altijd eerst `next build`, dan `next start` op **3101**, en hij weigert als daar al iets luistert. Je test dus per definitie de huidige code. Een dev-server op 3001 blijft ongemoeid. |

**Zes routes, bewust geen dynamische.** `/cases/[slug]` staat niet in `ROUTES`: zonder een
bestaande slug is dat een 404 en dat zou een valse bevinding zijn. Voeg een concrete slug toe als
je die kant wilt dekken.

**Een screenshot van deze app is pas bewijs ná het doorrollen.** De `Reveal`-componenten animeren
met `whileInView`, dus bij een `fullPage`-screenshot zonder scrollen staat alles onder de vouw nog
op `opacity: 0` — een grotendeels leeg beeld dat er identiek uitziet als een pagina die niets
rendert. De harness rolt daarom eerst door en telt daarna hoeveel blokken nog doorzichtig zijn;
is dat er één of meer, dan is het een bevinding en geen render. Gemeten op 2026-08-24: 16 blokken
op de homepage vóór die stap bestond.

**De harness kan falen, en dat is getoetst.** `pnpm --filter portfolio flow --selftest` voegt drie
scenario's toe die hóóren te falen: de bewuste assertie, een opgewekte horizontale overflow van
2000 px, en een ongescrolde pagina waarop de doorzichtigheids-teller iets moet vinden. Let op de
omkering: die run eindigt op **exit 0** wanneer **alle drie** afgingen (`3/3 tegenproeven`). Gaat
er één niet af, dan is dát de bevinding — er zit dan een check in die niets meet. Komt er een check
bij, verhoog `SELFTEST_CASES` mee; anders maskeert één geslaagde tegenproef de andere.
