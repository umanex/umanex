'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@umanex/ui/components/ui/badge'
import { cn } from '@umanex/ui/lib/utils'
import { focusRing } from '@umanex/ui/lib/focus'
import { StatusDropdown } from './StatusDropdown'
import { clusterPunten, projecteer, ringNaarPad, verhouding } from '@/lib/kaart'
import { filterQuery, type UiFilter } from '@/lib/kbo/universum'
import type { ItemStatus } from '@/lib/db/schema'

const BREEDTE = 1000
const HOOGTE = Math.round(BREEDTE / verhouding())
/** In SVG-eenheden. Bij 43 bedrijven in Gent is groeperen het verschil tussen kaart en vlek. */
const CLUSTER_STRAAL = 18

type Punt = {
  nummer: string
  naam: string
  lat: number
  lon: number
  herkomst: 'lijst' | 'lead'
  precisie: string | null
  status: ItemStatus
}

type Grenzen = {
  bron: string
  features: { properties: { naam: string }; geometry: { coordinates: number[][][] } }[]
}

/** De statuskleuren komen uit de rollaag; geen rauwe hex, geen paletklasse. */
const KLEUR: Record<ItemStatus, string> = {
  new: 'fill-muted-foreground',
  saved: 'fill-primary',
  contacted: 'fill-success',
  dismissed: 'fill-muted',
}

/**
 * De prospectkaart: drie provincievlakken en de bedrijven erop.
 *
 * Geen kaart-library en geen basemap-tiles. Gemeten 2026-09-09: de grenzen wegen 5,9 KB, het
 * tile-pad over hetzelfde gebied ±112 MB, en `maplibre-gl` 19,1 MB met 17 dependencies — voor
 * drie polygonen en 227 punten. Bijkomend gevolg dat niet bijkomstig is: er gaat geen enkel
 * verzoek naar buiten, dus de origin-guard van de flow-harness kan hier per constructie niets
 * afbreken.
 */
type ProspectMapProps = {
  /** Dezelfde filterstand als de lijst. De kaart is geen tweede selectie. */
  filter: UiFilter
}

export function ProspectMap({ filter }: ProspectMapProps) {
  const [punten, setPunten] = useState<Punt[] | null>(null)
  const [grenzen, setGrenzen] = useState<Grenzen | null>(null)
  const [tellers, setTellers] = useState({
    leadsZonderAdres: 0,
    zonderCoordinaat: 0,
    buitenProvincies: 0,
    buitenFilter: 0,
  })
  const [zonderSpiegel, setZonderSpiegel] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [gekozen, setGekozen] = useState<string[] | null>(null)

  // De querystring als string in de dependency-lijst: een object is elke render een nieuwe
  // referentie, dus een effect dat op `filter` zelf hangt vuurt eindeloos.
  const vraag = filterQuery(filter).toString()

  useEffect(() => {
    const ctrl = new AbortController()
    void (async () => {
      try {
        const [k, g] = await Promise.all([
          fetch(`/api/kaart?${vraag}`, { signal: ctrl.signal }).then((r) => r.json()),
          fetch('/geo/provincies.json', { signal: ctrl.signal }).then((r) => r.json()),
        ])
        if (!k?.ok) {
          setFout(k?.error ?? 'De kaartgegevens konden niet geladen worden.')
          return
        }
        setPunten(k.punten)
        setZonderSpiegel(k.spiegel === 'ontbreekt')
        setTellers({
          leadsZonderAdres: k.leadsZonderAdres,
          zonderCoordinaat: k.zonderCoordinaat,
          buitenProvincies: k.buitenProvincies ?? 0,
          buitenFilter: k.buitenFilter ?? 0,
        })
        setGrenzen(g)
        // Een selectie die kleiner wordt kan de aangeklikte stip wegnemen; het paneel ernaast
        // zou dan een bedrijf tonen dat niet meer op de kaart staat.
        setGekozen(null)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setFout('Geen antwoord van de server.')
      }
    })()
    return () => ctrl.abort()
  }, [vraag])

  const clusters = useMemo(() => {
    if (!punten) return []
    const geprojecteerd = punten.map((p) => ({
      nummer: p.nummer,
      ...projecteer(p.lon, p.lat, BREEDTE, HOOGTE),
    }))
    return clusterPunten(geprojecteerd, CLUSTER_STRAAL)
  }, [punten])

  const perNummer = useMemo(() => new Map((punten ?? []).map((p) => [p.nummer, p])), [punten])

  if (fout) {
    return (
      <p role="alert" className="mt-8 text-center text-sm text-destructive">
        {fout}
      </p>
    )
  }

  if (!punten || !grenzen) {
    return <p className="mt-8 text-center text-sm text-muted-foreground">Kaart laden…</p>
  }

  if (!punten.length) {
    // Drie redenen om leeg te zijn, drie verschillende antwoorden. Ze op één hoop gooien
    // maakt van "draai de sync", "draai de geocoder" en "je filter is te smal" hetzelfde ding.
    return (
      <div className="mt-3 rounded-md border border-border bg-muted p-4 text-sm text-muted-foreground">
        {zonderSpiegel ? (
          <>
            Er staat nog geen KBO-spiegel op deze machine, en de kaart tekent wat de lijst
            selecteert. Draai{' '}
            <code className="rounded bg-background px-1 py-0.5">
              pnpm --filter jobradar kbo:sync --full
            </code>
            .
          </>
        ) : tellers.buitenFilter > 0 ? (
          <>
            Geen enkel bedrijf met een coördinaat valt binnen je huidige filters —{' '}
            {tellers.buitenFilter} {tellers.buitenFilter === 1 ? 'valt' : 'vallen'} erbuiten. Pas
            regio, bron of de zeven aan.
          </>
        ) : (
          <>
            Nog geen coördinaten. Draai{' '}
            <code className="rounded bg-background px-1 py-0.5">pnpm --filter jobradar geocode</code>{' '}
            — dat haalt ze eenmalig op en bewaart ze, dus het hoeft één keer.
          </>
        )}
      </div>
    )
  }

  const uitLijst = punten.filter((p) => p.herkomst === 'lijst').length
  const uitLeads = punten.length - uitLijst

  return (
    <div className="mt-3">
      {/* Wat er níet op staat en waarom — drie verschillende redenen, dus drie tellers. */}
      <p className="mb-2 text-sm text-muted-foreground">
        {punten.length} bedrijven op de kaart: {uitLijst} uit de lijst, {uitLeads} lead
        {uitLeads === 1 ? '' : 's'} op een KBO-vermoeden.
        {tellers.leadsZonderAdres > 0 && ` ${tellers.leadsZonderAdres} leads hebben geen adres.`}
        {tellers.zonderCoordinaat > 0 && ` ${tellers.zonderCoordinaat} zonder coördinaat.`}
        {tellers.buitenProvincies > 0 &&
          ` ${tellers.buitenProvincies} liggen buiten de drie provincies — de zoekstraal van de vacaturebron loopt over de grens.`}
        {tellers.buitenFilter > 0 && ` ${tellers.buitenFilter} vallen buiten je huidige filters.`}
      </p>

      <p aria-live="polite" className="sr-only">
        {gekozen ? `${gekozen.length} bedrijven geselecteerd` : ''}
      </p>

      <div className="flex flex-col gap-4 lg:flex-row">
        <svg
          viewBox={`0 0 ${BREEDTE} ${HOOGTE}`}
          className="w-full rounded-lg border bg-card"
          role="img"
          aria-label={`Kaart van West-Vlaanderen, Oost-Vlaanderen en Brussel met ${punten.length} bedrijven`}
        >
          {grenzen.features.map((f) => (
            <path
              key={f.properties.naam}
              d={ringNaarPad(f.geometry.coordinates[0]!, BREEDTE, HOOGTE)}
              className="fill-muted stroke-border"
              strokeWidth={2}
            />
          ))}

          {clusters.map((c) => {
            const eersten = c.punten.map((p) => p.nummer)
            const info = eersten.map((n) => perNummer.get(n)!).filter(Boolean)
            const meerdere = info.length > 1
            const isLead = !meerdere && info[0]?.herkomst === 'lead'
            // Een cluster tekent één vorm, dus de ruit-markering van een vermoeden zou
            // erin verdwijnen — en juist waar het druk is (Brussel, Gent) zitten de meeste
            // leads. Gemeten: 3 losse ruiten bij 12 lead-punten, de andere 9 zaten in een
            // cluster. Een cluster met een vermoeden erin krijgt daarom een streepomtrek.
            const bevatVermoeden = info.some((p) => p.herkomst === 'lead')
            const actief = gekozen?.[0] === eersten[0]
            return (
              <g
                key={eersten[0]}
                onClick={() => setGekozen(eersten)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setGekozen(eersten)
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={
                  meerdere
                    ? `${info.length} bedrijven bij ${info[0]?.naam}` +
                      (bevatVermoeden ? `, waarvan ${info.filter((p) => p.herkomst === 'lead').length} op een KBO-vermoeden` : '')
                    : `${info[0]?.naam}${isLead ? ', KBO-vermoeden' : ''}`
                }
                className={cn('cursor-pointer', focusRing)}
              >
                {meerdere ? (
                  <>
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={11}
                      className="fill-primary/20 stroke-primary"
                      strokeWidth={1.5}
                      strokeDasharray={bevatVermoeden ? '3 2' : undefined}
                    />
                    <text
                      x={c.x}
                      y={c.y + 4}
                      textAnchor="middle"
                      className="fill-foreground text-2xs font-medium"
                    >
                      {info.length}
                    </text>
                  </>
                ) : isLead ? (
                  // Een lead-adres is een vermoeden, geen bronwaarde. Andere vórm, niet
                  // alleen een andere kleur — dat onderscheid moet ook zonder kleur werken.
                  <rect
                    x={c.x - 4}
                    y={c.y - 4}
                    width={8}
                    height={8}
                    transform={`rotate(45 ${c.x} ${c.y})`}
                    className={cn(KLEUR[info[0]!.status], 'stroke-background')}
                    strokeWidth={1}
                  />
                ) : (
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={actief ? 7 : 5}
                    className={cn(KLEUR[info[0]!.status], 'stroke-background')}
                    strokeWidth={1}
                  />
                )}
              </g>
            )
          })}
        </svg>

        <aside className="w-full shrink-0 lg:w-72">
          {gekozen ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                {gekozen.length === 1 ? 'Bedrijf' : `${gekozen.length} bedrijven`}
              </h3>
              <ul className="space-y-2">
                {gekozen.map((nr) => {
                  const p = perNummer.get(nr)
                  if (!p) return null
                  return (
                    <li key={nr} className="rounded-md border p-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium">{p.naam}</span>
                        {p.herkomst === 'lead' && (
                          <Badge variant="outline" className="shrink-0 text-2xs">
                            vermoeden
                          </Badge>
                        )}
                      </div>
                      {p.precisie && p.precisie !== 'huisnummer' && (
                        <p className="mt-0.5 text-2xs text-muted-foreground">
                          locatie op {p.precisie}, niet op huisnummer
                        </p>
                      )}
                      {p.herkomst === 'lijst' && (
                        <div className="mt-2">
                          <StatusDropdown
                            endpoint={`/api/prospects/${p.nummer}`}
                            status={p.status}
                            onStatusChange={() => undefined}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Klik een stip aan om te zien welk bedrijf er staat. Een ruit is een lead waarvan het
              adres een KBO-vermoeden is; een cluster met een streepomtrek bevat er minstens één.
            </p>
          )}
          <p className="mt-4 text-2xs text-muted-foreground">Grenzen: {grenzen.bron}</p>
        </aside>
      </div>
    </div>
  )
}
