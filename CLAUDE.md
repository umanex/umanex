# CLAUDE.md — umanex monorepo

Monorepoconventies voor de umanex codebase. Lees dit vóór je iets implementeert.

## Context

- **Eigenaar**: Jeroen (jeroen@umanex.be), Belgische freelance UX/UI designer & developer
- **Stack**: Next.js 14 App Router, TypeScript strict, Tailwind CSS, pnpm workspaces, Turborepo
- **Apps**: cashflow (persoonlijke cashflow prognose tool), meer volgen
- **Deployment**: Vercel, één project per app

## Structuurregels

- 1 component = 1 file, named exports (geen default exports voor componenten)
- Interne packages via workspace protocol: `"workspace:*"`
- Packages zijn private; exports field in package.json bepaalt publieke API
- Geen feature code zonder expliciete opdracht — geen Zustand, dnd-kit, auth of API routes tenzij gevraagd

## TypeScript

- `strict: true` overal, geen `any`
- `moduleResolution: "bundler"` (niet `node`)
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

## Design tokens

- `packages/tokens/tokens.json` is Tokens Studio GitHub sync target — nooit handmatig bewerken
- Figma plugin File path: `packages/tokens/tokens.json`
- Style Dictionary wiring volgt in aparte prompt

## Prompting framework (TC-EBC)

Gebruik dit framework voor consistente implementaties:

- **T**ask: wat moet gemaakt worden
- **C**ontext: welke app/package, welke bestaande patronen
- **E**lements: file paths, component names, props, types
- **B**ehavior: interacties, states, edge cases
- **C**onstraints: wat mag niet, wat volgt later

## Wat nog komt (aparte prompts)

- Style Dictionary platforms configuratie in packages/tokens
- ShadCN componenten initialiseren in packages/ui
- Zustand store voor cashflow
- Feature code cashflow tool (data model, dnd-kit, BTW, yearly reservering)
- Verdere apps in apps/
