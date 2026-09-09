# CLAUDE.md — umanex-apps monorepo

@.umanex-os/CLAUDE.md
@.umanex-os/profiles/umanex.md

Monorepoconventies voor de umanex-apps codebase. Lees dit vóór je iets implementeert.

## Context

- **Eigenaar**: Jeroen (jeroen@umanex.be), Belgische freelance UX/UI designer & developer
- **Deployment**: Vercel, één project per app

## Structuurregels

- 1 component = 1 file, named exports (geen default exports voor componenten)
- Interne packages via workspace protocol: `"workspace:*"`
- Packages zijn private; exports field in package.json bepaalt publieke API
- Geen feature code zonder expliciete opdracht — geen Zustand, dnd-kit, auth of API routes tenzij gevraagd

## TypeScript

- Paths via tsconfig, niet via runtime tricks

## Commits (Conventional Commits)

```
feat(cashflow): ...
fix(ui): ...
chore: ...
docs: ...
ci: ...
```

Scope = package of app naam. Eén logische stap per commit.

**De scope is afdwingbaar.** `.githooks/commit-msg` blokkeert een commit met een app-scope
die een ándere app raakt — `fix(cashflow):` komt niet aan `apps/rowtrack/`. Package-scopes
(`feat(tokens):`, `refactor(config):`) en scope-loze commits (`chore:`) mogen wél meerdere
apps tegelijk raken: een gedeelde laag hoort in één commit met de apps die hij aanpast.
Bewust cross-app? Zet een `Cross-app: <reden>` trailer in de body. Het werkprincipe staat
in `.umanex-os/CLAUDE.md` → Git workflow → Parallel werk.

**En de branch is afdwingbaar.** `.githooks/pre-commit` weigert een commit op `main` en op een
losse HEAD. Werk dus altijd op een branch — ook voor een eenregelige doc-fix. Rebase, cherry-pick
en een lopende merge worden met rust gelaten.

## Parallel aan twee apps werken

**App-werk gebeurt in de hoofdtree**, in `apps/<app>`, op een feature branch. Geen zusmappen
`../umanex-apps-<app>` meer — die conventie ("één app, één worktree") is op 2026-08-25
geschrapt; het werkprincipe staat in `.umanex-os/CLAUDE.md` → Git workflow → Parallel werk.
Tref je nog zo'n zusmap aan (`git worktree list`): niet zelf verwijderen, eerst kijken wat erin
zit — een ongepushte commit of een ongetrackt bestand daar bestaat nergens anders.

Een branch scheidt de bestanden op schijf niet: ongetrackt en ongecommit werk reist mee bij
elke `checkout`. Dat is hoe rowtrack- en cashflow-werk op 2026-08-07 door elkaar liepen ondanks
nette branches. Daarom, in de hoofdtree:

- **Eén taak tegelijk in deze repo.** Toont `git status --short` onvastgelegd werk, óf staat HEAD
  op een feature branch die niet van jou is (`git rev-parse --abbrev-ref HEAD` — een schone tree
  bewijst niets, de PR staat gewoon open): meld het en laat Jeroen kiezen; begin er niet stil
  naast, maak geen eigen tree. Is de tree vrij: `git fetch -q origin && git checkout -b
  <type>/<naam> origin/main`, nooit vanaf de HEAD die je aantreft.
- **Stage per pad, nooit `git add -A`.** `git stash push -u -- apps/<app>` parkeert de andere
  taak (mét `-u`, anders blijven haar ongetrackte bestanden staan); pop hem pas als je commit staat.
- **De hooks zijn het vangnet, niet de regel:** `.githooks/commit-msg` blokkeert een app-scope
  die een andere app raakt, `.githooks/pre-commit` meldt onvastgelegd werk in andere apps. Een
  `chore:` mét `git add -A` passeert allebei.

Een tweede tree alleen voor een schrijvende sub-agent (`isolation: "worktree"` →
`.claude/worktrees/agent-<id>/`, gitignored) of op expliciete vraag van Jeroen — dan óók onder
`.claude/worktrees/`, en weg na de merge. Wat in zo'n tree botst:

| | |
|---|---|
| Dev-poorten | cashflow `:3000` · portfolio `:3001` · vyvey `:3002` · jobradar `:3003` · dashboard `:3011` — hardcoded in de `dev`-scripts. Dezelfde app niet vanuit twee trees draaien. Het dashboard wijkt af van zijn PM2-poort (`:3010`) zodat dev en de draaiende build naast elkaar kunnen. |
| PM2-apps | Twee productie-builds draaien uit de hoofdtree — cashflow op `:3000` (config in `ecosystem.config.js`, absolute paden, gitignored) en het dashboard op `:3010` (`pnpm --filter dashboard pm2:start`, loopback-bind). Dat is dezelfde tree waarin je hun feature-branches uitcheckt. Geen `next build` of `pm2:rebuild` daar op een feature branch (het eerste breekt de draaiende server, het tweede deployt ongemergde code); verifieer cashflow-feature-werk via de flow-harness (`pnpm --filter cashflow flow` bouwt zelf in `.next-harness` en serveert op `:3100`, raakt `.next` niet) of via CI, herbouw pas op `main` na de merge. Beide komen na een reboot vanzelf terug via `pm2 resurrect` over `~/.pm2/dump.pm2` — wie een van beide opnieuw aanmaakt, doet er `pm2 save` achteraan. |
| rowtrack | Expo dev-client: een tweede tree betekent een tweede native build. |
| `.githooks` | Rijdt automatisch mee — `core.hooksPath` staat in de gedeelde git-config. Niets extra te doen. |

Wat juist **niet** meereist: gitignorede bestanden. `apps/cashflow/.env.local` staat niet in
git, dus in een verse tree valt `next build` om op de ontbrekende `NEXT_PUBLIC_SUPABASE_*`
— en wel pas bij het prerenderen, ná een geslaagde compile, dus de CSS staat er dan al en een
render-script lijkt gewoon te werken. Kopieer het bestand mee, of bouw met dezelfde
placeholders als CI (`ci.yml`, stap "Type-check, lint, build"). Geldt voor elk `.env.local`.

## Design tokens

- `packages/tokens/tokens.json` is Tokens Studio GitHub sync target
- Figma plugin File path: `packages/tokens/tokens.json`

**Handmatig bewerken: nee, met één uitzondering.** Losse tokenwijzigingen gaan altijd via
de plugin — een handmatige edit wordt bij de eerstvolgende push overschreven en is dus
stil verlies. De uitzondering is een *gecoördineerde bulk-restructurering* (sets splitsen,
hernoemen, een laag herindelen): die is in de plugin honderden klikken en foutgevoelig.
Voorwaarden: de wijziging gebeurt in één keer, gaat via een PR, en Jeroen doet er direct
na de merge een **Pull in Tokens Studio** op zodat de plugin de nieuwe structuur overneemt.
Push je vanuit de plugin vóór die pull, dan draai je de restructurering terug.

**Lagen.** Drie assen, elk hun eigen set(s):

```
Primitives          rauwe ramps, enige plek met een literal hex — resolve-only, geen output
Typography/Scale    families, size/leading/weight/tracking — levert build/typography.mjs
Theme/base          mode-blinde rollen (radius) — alleen in :root
Theme/light|dark    DE shadcn-rollaag, per mode
Semantic/light|dark domeinrollen (finance, overlay), per mode
```

De mode komt uit de **set-naam**, niet uit het token-pad. Een set `X/light` of `X/dark`
wordt automatisch een mode-blok; alles buiten `Theme/` en `Semantic/` is een primitive.

**Consumptieregel.** App-code en `packages/ui` raken uitsluitend de **rollaag** aan, via een
Tailwind-utility uit `@umanex/config/tailwind/preset`. Geen primitive, geen rauwe
paletklasse (`bg-green-500`), geen hardcoded hex, geen arbitrary font-size of radius.
De preset wordt gegenereerd uit de tokens, dus een kleur die geen rol is heeft geen utility.
Ontbreekt er een waarde? Voeg een rol toe in **beide** mode-sets — de build faalt op
asymmetrie — en gebruik hem als utility.

`pnpm --filter @umanex/tokens guard` dwingt dit af (draait ook in CI), met ESLint-regels
per app voor feedback in de editor.

## Design-systeem-bron

**Elke app declareert in zijn eigen `CLAUDE.md` een `## Design-systeem-bron`-sectie**, met drie
regels: welke Tailwind-preset, welke componentbron, welke Storybook. Zelfde regime als
`## Verify-pad`: **"geen" is een geldig antwoord en hoort er te staan** — een lege regel laat de
vraag terugkomen, het woord "geen" maakt de keuze telbaar.

```markdown
- **Preset:** `@umanex/config/tailwind/preset`
- **Componentbron:** `@umanex/ui`
- **Storybook:** `pnpm --filter @umanex/ui storybook` (:6006)
```

`pnpm ds:guard` toetst die declaratie tegen wat er op schijf staat, en draait in CI met zijn
tegenproef (`pnpm ds:guard:selftest`). Vijf assen: de sectie bestaat · de drie velden zijn
ingevuld · de gedeclareerde preset is de preset die `tailwind.config` echt importeert · een app
op `@umanex/ui` heeft geen lokale kopie van een van zijn exports · en een app op `@umanex/ui`
importeert hem ook echt, in app-code.

**Die laatste as is de reden dat dit een guard is en geen afspraak.** `@umanex/ui` bestond
maanden mét Storybook, mét Figma-sync en mét een CI-build, terwijl cashflow — het grootste
UI-oppervlak van de monorepo — hem in nul app-bestanden importeerde. De dependency stond in
`package.json`, de enige gebruiker was `scripts/render-screens.tsx`. Storybook maakt de laag
zichtbaar; hij maakt hem niet gebruikt. `scripts/` telt daarom niet mee voor adoptie, en een
vermelding in `next.config.mjs` (`transpilePackages`) evenmin.

**Nieuw project: koppelen is de default, niet aanmaken.** Zit de app op
`@umanex/config/tailwind/preset`, dan krijgt hij géén eigen Storybook — een nieuwe primitive
gaat naar `packages/ui` mét story, en de app importeert hem. Alleen een app met een eigen
tokenbron (vyvey's klantthema, rowtrack's mobile-DNA) verantwoordt een eigen componentlaag; de
vorm is dan een eigen Storybook die als `ref` in die van `packages/ui` hangt, niet een tweede
losse installatie.

## Briefings (TC-EBC)

TC-EBC framework staat volledig in `.umanex-os/CLAUDE.md` — werkprincipe, niet hier herhaald.

Briefings-bestanden landen op deze plek:
- **App-specifieke briefing:** `apps/{app}/briefings/{YYYY-MM-DD}-{type}-{naam}.tcebc.md`
- **Cross-app briefing (raakt meerdere apps of monorepo-niveau):** `briefings/{YYYY-MM-DD}-{type}-{naam}.tcebc.md` aan de root

Bij twijfel — vraag.

Folders worden aangemaakt wanneer ze nodig zijn, niet vooraf.
