/**
 * Laat Node de app-modules laden zoals de bundler ze leest.
 *
 * De app-code importeert relatief zónder extensie (`./config/profile`) — dat is wat
 * TypeScript met `moduleResolution: bundler` verwacht en wat webpack in de Next-build
 * oplost. Node's ESM-resolver doet dat niet: die eist een extensie en valt op
 * ERR_MODULE_NOT_FOUND. Daardoor was `lib/matching.ts` headless niet aan te roepen en
 * stond "Invariant draaien" in CLAUDE.md op **Geen**.
 *
 * Deze hook dicht dat gat aan de kant van de harness in plaats van in de app-code:
 * app-code met `.ts` in de imports zou de bundler-conventie breken om een testpad te
 * plezieren. Node 24 strip zelf de types, dus er komt geen transpiler aan te pas.
 *
 * Gebruik: node --import ./scripts/ts-resolve.mjs scripts/<harness>.ts
 */
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'

// Alleen relatieve, extensieloze specifiers raken we aan. Bare specifiers (`next`,
// `drizzle-orm`) en alles met een extensie gaan ongemoeid naar de standaardresolver,
// zodat een echte ontbrekende module nog steeds een echte fout geeft.
const KANDIDATEN = ['.ts', '.tsx', '/index.ts', '/index.tsx']

// `server-only` weigert per constructie te laden buiten een server-component-bundel, en
// dat sloot élke module die hem importeert uit van de invarianten — `lib/kbo/spiegel.ts`
// dus. Precies daar kwam de fout die dit bestand nu testbaar maakt: de tak die een
// ontbrekende app-database moest opvangen schreef via een readonly verbinding en gooide
// altijd, ongedekt omdat geen enkele suite die module kón importeren.
//
// De stub is leeg en raakt alleen scripts die déze loader gebruiken; de Next-build lost
// `server-only` gewoon zelf op en ziet hier niets van.
const SERVER_ONLY_STUB = 'data:text/javascript,export {}'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return { url: SERVER_ONLY_STUB, shortCircuit: true }
    }
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      const ouder = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : process.cwd()
      for (const ext of KANDIDATEN) {
        const kandidaat = resolvePath(ouder, specifier + ext)
        if (existsSync(kandidaat)) {
          return { url: pathToFileURL(kandidaat).href, shortCircuit: true }
        }
      }
    }
    return nextResolve(specifier, context)
  },
})
