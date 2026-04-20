# @umanex/tokens

Design tokens voor het umanex design system.

## tokens.json

`tokens.json` in deze map is de **Tokens Studio GitHub sync target**.

- Tokens worden automatisch gecommit door de Figma plugin
- **Nooit handmatig bewerken** — wijzigingen worden overschreven door Tokens Studio
- Figma plugin instelling: File path = `packages/tokens/tokens.json`

## Style Dictionary

Style Dictionary build pipeline is gereserveerd voor een aparte prompt.

Wanneer geconfigureerd:

```bash
pnpm build   # genereert build/variables.css en build/tailwind.js
```

Exports (nog niet beschikbaar):

```ts
import "@umanex/tokens/variables.css";
import tailwindTokens from "@umanex/tokens/tailwind";
```
