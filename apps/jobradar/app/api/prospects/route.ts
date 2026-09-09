import { NextResponse } from 'next/server'
import { inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { haalProspects } from '@/lib/kbo/spiegel'
import { leesFilter } from '@/lib/kbo/universum'
import type { ItemStatus } from '@/lib/db/schema'
import type { Sortering } from '@/lib/kbo/universum'

export const dynamic = 'force-dynamic'

/**
 * Een paginanummer uit de querystring. Alles wat geen bruikbaar geheel getal is wordt 1;
 * de bovengrens houdt de OFFSET binnen wat SQLite als integer accepteert. De ondergrens
 * zit óók in `haalProspects`, maar een route die zijn invoer niet nakijkt leunt op een
 * laag die daar niet voor bestaat.
 */
const MAX_PAGINA = 100_000
function paginaVan(ruw: string | null): number {
  const n = Number(ruw ?? '1')
  if (!Number.isFinite(n)) return 1
  return Math.min(MAX_PAGINA, Math.max(1, Math.trunc(n)))
}

/**
 * De prospect-lijst, per pagina van 60.
 *
 * Waarom een route en geen server component: de lijst telt 14.613 rijen en het tabblad
 * filtert en bladert client-side aangestuurd. Alles vooraf meesturen zou precies de
 * afkapping-zonder-melding opleveren die deze app elders juist vermijdt.
 *
 * De statussen komen uit `jobradar.db`, de rijen uit `kbo.db`. Twee databases, één antwoord:
 * de spiegel is wegwerpbaar en mag niets dragen wat jij beslist hebt.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)

  const sorteringRuw = url.searchParams.get('sortering')
  const sortering: Sortering =
    sorteringRuw === 'omvang' || sorteringRuw === 'ebitda' || sorteringRuw === 'actie'
      ? sorteringRuw
      : 'oprichting'

  const filter = {
    // Regio, zoekterm, bron en de twee zeven: dezelfde lezer als `/api/kaart`, zodat de
    // twee routes niet elk hun eigen idee van de filterstand kunnen krijgen.
    ...leesFilter(url.searchParams),
    sortering,
    // Als enige parameter ging deze ongefilterd door. `?pagina=1e20` levert een OFFSET
    // van 6e21, en dat is voor SQLite geen integer meer: `datatype mismatch` uit de
    // prepare, ongevangen, HTTP 500 — nadat de tellingsquery al een volledige aggregatie
    // over de selectie gedraaid heeft. Klemmen op een geheel getal in een reëel bereik.
    pagina: paginaVan(url.searchParams.get('pagina')),
  }

  const vandaag = new Date().toISOString().slice(0, 10)
  const resultaat = haalProspects(filter, vandaag)

  const nummers = resultaat.rijen.map((r) => r.nummer)
  const statussen = new Map<string, ItemStatus>()
  if (nummers.length) {
    const db = getDb()
    const rijen = await db
      .select()
      .from(schema.prospectStatus)
      .where(inArray(schema.prospectStatus.enterpriseNumber, nummers))
    for (const r of rijen) statussen.set(r.enterpriseNumber, r.status as ItemStatus)
  }

  return NextResponse.json({
    ok: true,
    staat: resultaat.staat,
    totaal: resultaat.totaal,
    pagina: resultaat.pagina,
    paginas: resultaat.paginas,
    zonderKbo: resultaat.zonderKbo,
    // Ongefilterd, zodat de lege staat "nog niets geïmporteerd" kan onderscheiden van
    // "wel geïmporteerd, maar je filters laten niets over". Zonder dit getal stelt het
    // scherm een diagnose die het niet gecontroleerd heeft.
    csvTotaal: resultaat.csvTotaal,
    prospects: resultaat.rijen.map((r) => ({
      ...r,
      status: statussen.get(r.nummer) ?? 'new',
    })),
  })
}
