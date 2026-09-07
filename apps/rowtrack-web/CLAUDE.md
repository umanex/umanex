# rowtrack-web — projectcontext

Commerciële site voor de RowTrack iOS-app. Next.js (App Router) + next-intl, dev op poort 3004.

Dit bestand is bewust **minimaal**: het bevat alleen wat gemeten is. Vul de rest aan wanneer er
echt aan deze app gewerkt wordt — verzonnen projectcontext is schadelijker dan geen.

## Design-DNA — RowTrack, niet umanex

Deze app consumeert **niet** `@umanex/config/tailwind/preset` en **niet** `@umanex/tokens`.
De site moet eruitzien als de app, dus hij draait op RowTrack's eigen dark-only rollaag via
`@umanex/rowtrack-tokens` — een package die `apps/rowtrack/tokens/tokens.json` leest en de
web-helft levert (CSS-variabelen + Tailwind-preset). De RN-helft blijft
`apps/rowtrack/style-dictionary.config.mjs`.

Gevolg: de utility-set is gelijk aan de tokenset. `bg-bg-base`, `text-fg-primary`,
`bg-accent`, `text-achievement`, `rounded-card`, `shadow-button-primary`. Wat geen rol is,
heeft geen utility. Wat ontbreekt staat in `packages/rowtrack-tokens/TOKENS-TODO.md` —
signaleren, niet verzinnen.

**Let op de DEFAULT-sleutel.** `border.default` wordt `border-border`, niet
`border-border-default`; hetzelfde geldt voor `accent.default` → `bg-accent`. Een klasse die
niet bestaat wordt door Tailwind in een `className` stil genegeerd — de kleur valt dan terug
op Tailwinds eigen palet zonder één foutmelding. Daar staat een guard op:

```
pnpm --filter @umanex/rowtrack-tokens guard
pnpm --filter @umanex/rowtrack-tokens guard:selftest   # bewijst dat hij kán falen
```

**Nog niet compleet.** Web-typeschaal, spacing boven 48, container-widths, motion en
focus-ring ontbreken in de bron. Tot die er zijn gebruikt de scaffold Tailwinds eigen
schaal voor maten; dat is gemarkeerd met een `TODO` in `app/[locale]/page.tsx` en het is
géén precedent.

## Copy

Alle gebruikerszichtbare tekst staat in `messages/nl.json` en loopt via next-intl. Geen
hardcoded strings in `.tsx`. Locales staan op één plek: `i18n/routing.ts`. Er staat bewust
alleen `nl` in — zie de toelichting in dat bestand.

**Elke feitelijke claim** over de app wordt getoetst aan de waarheidstabel in
`briefings/2026-08-09-feature-rowtrack-web-marketingsite.tcebc.md`. De app heeft geen
Apple Health, geen in-app-aankopen, twee persoonlijke records (niet drie), en calorieën
worden berekend in plaats van uitgelezen. De site mag niets beloven dat daar niet in staat.

## Design-systeem-bron

Welke laag deze app zijn vorm van krijgt. Gemeten, niet afgeleid: `scripts/design-system-guard.mjs`
toetst elke regel hieronder tegen wat er op schijf staat. "geen" is overal een geldig antwoord,
mits het er staat.

- **Preset:** `@umanex/rowtrack-tokens/tailwind/preset`
- **Componentbron:** `eigen` — `components/ui/`, op RowTrack's dark-only rollaag
- **Storybook:** `geen` — de componenten zijn site-specifiek en hebben geen tweede consument

Zie ook *Design-DNA — RowTrack, niet umanex* hierboven. Krijgt deze laag ooit een tweede
consument, dan is de vorm een eigen Storybook die als `ref` in die van `packages/ui` hangt,
niet een verhuizing naar `@umanex/ui`.

---

## Verify-pad

Wat de `verify`-skill hier kan uitvoeren. Vastgesteld 2026-08-09 door het te draaien, niet door
het af te leiden. Staat er "geen", dan is dat een gat dat gebouwd moet worden — geen vergetelheid.

| Capability | Commando / status |
|---|---|
| **Render vastleggen** | `pnpm --filter rowtrack-web flow --shot=.flow-shots` — full-page PNG per route op de verse build. `.flow-shots/` is gitignored: bewijs van één run, geen artefact. |
| **Flow aandrijven** | `pnpm --filter rowtrack-web flow` — Playwright op een verse build. Laadt de routes uit `ROUTES` en telt console-fouten. `--headed` om mee te kijken. |
| **State forceren** | **Geen.** Statische marketingsite zonder data-laag en zonder formulier: er is niets dat kan laden, leeg zijn of falen. Loading/empty/error zijn hier niet van toepassing in plaats van onbereikbaar — dat verschil is belangrijk, want het is géén gat dat gedicht moet worden. Komt er een supportformulier, dan verandert dit. |
| **Invariant draaien** | **Geen, en niet nodig.** Geen afgeleide berekeningen in deze app. |
| **Verse build** | Zit ín de harness: altijd eerst `next build`, dan `next start` op **3104**, en hij weigert als daar al iets luistert. Een dev-server op 3004 blijft ongemoeid. |

**De harness kan falen, en dat is getoetst.** `pnpm --filter rowtrack-web flow --selftest` voegt
een scenario toe dat hóórt te falen. Let op de omkering: die run eindigt op **exit 0** wanneer de
bewuste assertie inderdaad faalde. Blijft hij groen zónder die melding, dan meet de harness niets.

**Routes gaan altijd met locale-prefix.** `/` verwijst door naar `/nl`; een harness-route zonder
prefix meet de redirect, niet de pagina.

## Tokens herbouwen

```
pnpm --filter @umanex/rowtrack-tokens build
```

Draait automatisch mee via `turbo`'s `^build` vóór elke app-build. Let op: de `pre-commit`-hook
herbouwt alleen `constants/` van apps mét een `tokens:build`-script — deze package valt daar
buiten en wordt dus door `turbo` gedekt, niet door de hook.
