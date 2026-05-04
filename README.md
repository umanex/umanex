# umanex

Persoonlijke Turborepo monorepo voor umanex.be projecten. Bevat alle apps en gedeelde packages van Jeroen (jeroen@umanex.be).

## Structuur

```
umanex-apps/
├── apps/
│   ├── cashflow/          # Persoonlijke cashflow prognose tool
│   ├── rowtrack/          # React Native rowing tracker (Expo + BLE + Supabase)
│   └── watermark-remover/ # Next.js app met inpaint API
├── packages/
│   ├── config/            # Gedeelde tsconfig, eslint, tailwind preset
│   ├── tokens/            # Design tokens (Tokens Studio sync target)
│   └── ui/                # Gedeelde UI componenten
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Quickstart

```bash
git clone git@github.com:umanex/umanex-apps.git
cd umanex-apps
pnpm install
pnpm dev
```

## Ontwikkeling per app

```bash
pnpm dev --filter=cashflow
pnpm build
pnpm type-check
pnpm lint
```

## Design tokens

`packages/tokens/tokens.json` is de **Tokens Studio GitHub sync target**.

- **Figma plugin instellingen**: File path moet `packages/tokens/tokens.json` zijn
- Tokens worden door de Figma plugin gecommit — nooit handmatig bewerken
- Style Dictionary build pipeline volgt in aparte prompt

Zie ook: [packages/tokens/README.md](packages/tokens/README.md)

## Vercel deployment

Elke app wordt als apart Vercel project gedeployed. Configuratie via de Vercel dashboard (geen vercel.json in de code).

### apps/cashflow

| Instelling | Waarde |
|---|---|
| Root Directory | `apps/cashflow` |
| Framework preset | Next.js |
| Install Command | `cd ../.. && pnpm install --frozen-lockfile` |
| Build Command | `cd ../.. && pnpm turbo build --filter=cashflow` |
| Output Directory | `apps/cashflow/.next` |
| Node.js version | 20.x |
| Ignored Build Step | `npx turbo-ignore cashflow` |

**Remote cache (optioneel)**: voeg `TURBO_TOKEN` en `TURBO_TEAM` toe als GitHub repository secrets.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) draait bij elke push en PR naar main:

1. `pnpm install --frozen-lockfile`
2. `pnpm turbo type-check lint build`

## Packages

| Package | Naam | Beschrijving |
|---|---|---|
| `packages/config` | `@umanex/config` | Gedeelde tsconfig, eslint configs, tailwind preset |
| `packages/tokens` | `@umanex/tokens` | Design tokens + Style Dictionary pipeline |
| `packages/ui` | `@umanex/ui` | Gedeelde React UI componenten |

## Conventionele commits

```
feat(cashflow): ...
fix(ui): ...
chore: ...
docs: ...
ci: ...
```
