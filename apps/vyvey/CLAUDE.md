# vyvey — projectcontext

Next.js (App Router), dev op poort 3002.

Dit bestand is bewust **minimaal**: het bevat alleen wat gemeten is. Vul de rest aan wanneer er
echt aan deze app gewerkt wordt — verzonnen projectcontext is schadelijker dan geen.

## Design-systeem-bron

Welke laag deze app zijn vorm van krijgt. Gemeten, niet afgeleid: `scripts/design-system-guard.mjs`
toetst elke regel hieronder tegen wat er op schijf staat. "geen" is overal een geldig antwoord,
mits het er staat.

- **Preset:** `geen` — zelfstandig Vyvey-theme in `tailwind.config.ts`, geen umanex-tokens
- **Componentbron:** `eigen` — `components/ui/`, want het klantthema deelt geen rollaag met `@umanex/ui`
- **Storybook:** `geen` — één klant-onepager; een tweede Storybook kost meer dan hij hier oplevert

`Button`, `Input`, `Checkbox`, `Card` en `Select` dubbelen bewust namen uit `@umanex/ui`. De
structuur zou te delen zijn, de styling niet: deze app draait op Vyvey's merk, niet op umanex'.
Verandert dat, dan verandert deze sectie mee — de guard vergelijkt hem met de config.

---

## Verify-pad

Wat de `verify`-skill hier kan uitvoeren. Vastgesteld 2026-08-08 door het te draaien, niet door
het af te leiden. Staat er "geen", dan is dat een gat dat gebouwd moet worden — geen vergetelheid.

| Capability | Commando / status |
|---|---|
| **Render vastleggen** | `pnpm --filter vyvey flow --shot=.flow-shots` — full-page PNG per route op de verse build. Gemeten: `index`, `privacy`, `algemene-voorwaarden`. `.flow-shots/` is gitignored: bewijs van één run, geen artefact. |
| **Flow aandrijven** | `pnpm --filter vyvey flow` — Playwright op een verse build. Laadt drie routes, klikt één echte interne link (gemeten: `/algemene-voorwaarden → /privacy`) en telt console-fouten. `--headed` om mee te kijken. |
| **State forceren** | **Geen.** Statische site zonder data-laag: er is niets dat kan laden, leeg zijn of falen. Niet van toepassing in plaats van onbereikbaar — dat verschil telt, want dit is géén gat dat gedicht moet worden. |
| **Invariant draaien** | **Geen, en niet nodig.** Geen afgeleide berekening in deze app. |
| **Verse build** | Zit ín de harness: altijd eerst `next build`, dan `next start` op **3102**, en hij weigert als daar al iets luistert. Een dev-server op 3002 blijft ongemoeid. |

**Twee dunne pagina's.** `/privacy` (219 tekens) en `/algemene-voorwaarden` (232 tekens) renderen
aantoonbaar, maar bevatten opvallend weinig tekst voor wat ze horen te zijn. De harness haalt de
drempel (>20 tekens) en meldt dus niets — dit is een observatie voor wie aan de inhoud werkt, geen
bevinding van de flow-as.

**De harness kan falen, en dat is getoetst.** `pnpm --filter vyvey flow --selftest` voegt een
scenario toe dat hóórt te falen. Let op de omkering: die run eindigt op **exit 0** wanneer de
bewuste assertie inderdaad faalde. Blijft hij groen zónder die melding, dan meet de harness niets.
