'use client'

import { ExternalLink, Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@umanex/ui/components/ui/card'
import { Badge } from '@umanex/ui/components/ui/badge'
import { cn } from '@umanex/ui/lib/utils'
import { focusRing } from '@umanex/ui/lib/focus'
import { StatusDropdown } from './StatusDropdown'
import { NextActionBadge } from './NextActionBadge'
import { NACE_LABEL, leeftijdInJaren } from '@/lib/kbo/universum'
import type { ItemStatus } from '@/lib/db/schema'

export type Prospect = {
  nummer: string
  naam: string
  handelsnaam: string | null
  opgericht: string | null
  postcode: string | null
  gemeente: string | null
  codes: string | null
  website: string | null
  werkgever: number
  status: ItemStatus
  /** 1 wanneer dit bedrijf ook in de aangeleverde lijst staat. */
  uitCsv: number
  csvNaam: string | null
  werknemers: number | null
  ebitda: number | null
  multiple: number | null
  ondernemingswaarde: number | null
  eigenVermogen: number | null
  actieDatum: string | null
  actieOmschrijving: string | null
}

type ProspectCardProps = {
  prospect: Prospect
  /** Er kwamen vacatures van dit ondernemingsnummer binnen: dit is óók een lead. */
  heeftVacatures: boolean
  vandaag: string
  onStatusChange: (status: ItemStatus) => void
  /** Opent de contacthistoriek van dit bedrijf. */
  onOpvolging: () => void
}

/**
 * Bedragen afgerond, want de kaart is geen jaarrekening: `18695779.31` leest als ruis waar
 * `18,7 mln` een orde van grootte geeft. De ruwe waarde blijft in de database staan.
 *
 * Een negatief bedrag houdt zijn teken en krijgt geen eigen kleur: 44 van de 218 bedrijven
 * in het geleverde bestand draaien verlies, en dat rood kleuren zou van een feit een oordeel
 * maken op een kaart die verder geen oordeel velt (dezelfde reden dat er geen scorepil op
 * staat).
 */
function bedrag(waarde: number): string {
  const abs = Math.abs(waarde)
  const teken = waarde < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${teken}${(abs / 1_000_000).toLocaleString('nl-BE', { maximumFractionDigits: 1 })} mln`
  if (abs >= 1_000) return `${teken}${Math.round(abs / 1_000).toLocaleString('nl-BE')} k`
  return `${teken}${Math.round(abs).toLocaleString('nl-BE')}`
}

/** `0417238867` → `0417.238.867`, de vorm waarin een ondernemingsnummer geschreven wordt. */
function metPunten(nummer: string): string {
  return nummer.length === 10 ? `${nummer.slice(0, 4)}.${nummer.slice(4, 7)}.${nummer.slice(7)}` : nummer
}

/**
 * Een prospect is géén lead: er is geen vacature, dus ook geen signaal en geen score. Wat de
 * kaart toont is wat KBO wél weet — activiteit, leeftijd, plaats — plus een website bij de
 * 6% die er een heeft. Bewust geen scorepil: een getal suggereert een rangschikking die de
 * data niet draagt.
 */
export function ProspectCard({
  prospect,
  heeftVacatures,
  vandaag,
  onStatusChange,
  onOpvolging,
}: ProspectCardProps) {
  const codes = (prospect.codes ?? '').split(',').filter(Boolean)
  const jaren = leeftijdInJaren(prospect.opgericht, vandaag)
  const jaartal = prospect.opgericht?.slice(0, 4) ?? null

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <h3 className="truncate text-sm font-semibold">{prospect.naam}</h3>
              {heeftVacatures && (
                <Badge variant="default" className="shrink-0 text-2xs">
                  heeft vacatures
                </Badge>
              )}
              {prospect.uitCsv === 1 && (
                <Badge variant="secondary" className="shrink-0 text-2xs">
                  uit lijst
                </Badge>
              )}
            </div>
            {prospect.handelsnaam && prospect.handelsnaam !== prospect.naam && (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{prospect.handelsnaam}</p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {codes.map((code) => (
                <Badge key={code} variant="outline" className="text-2xs">
                  {NACE_LABEL[code] ?? code}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {jaartal && (
            <span className="tabular-nums">
              {jaartal}
              {jaren !== null && ` · ${jaren} jaar`}
            </span>
          )}
          {!prospect.werkgever && <span>geen personeel bekend</span>}
          <span className="tabular-nums">{metPunten(prospect.nummer)}</span>
        </div>

        {prospect.uitCsv === 1 && (
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {prospect.werknemers !== null && (
              <span className="tabular-nums">
                {prospect.werknemers.toLocaleString('nl-BE', { maximumFractionDigits: 1 })} medewerkers
              </span>
            )}
            {prospect.ebitda !== null && (
              <span className="tabular-nums">
                EBITDA {bedrag(prospect.ebitda)}
                {/* Het minteken alleen draagt dit onderscheid niet: gemeten op de 218
                    geïmporteerde rijen renderen elf verliesgevende bedrijven zonder dat
                    teken byte-identiek aan een winstgevend bedrijf in dezelfde lijst
                    (−2,5 mln tegenover 2,5 mln). Eén afgekapte kolom, één schermlezer die
                    U+2212 overslaat, en het verschil is weg. */}
                {prospect.ebitda < 0 && <span className="ml-1">(verlies)</span>}
              </span>
            )}
            {/* Geen waarde tonen is hier informatie, geen gat: bij een negatieve EBITDA is de
                multiple niet toepasbaar, dus staat er niets — en dat is precies wat we weten. */}
            {prospect.ondernemingswaarde !== null && (
              <span className="tabular-nums">waarde {bedrag(prospect.ondernemingswaarde)}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            {prospect.postcode && <span className="rounded bg-muted px-1.5 py-0.5 tabular-nums">{prospect.postcode}</span>}
            {prospect.gemeente && <span className="truncate">{prospect.gemeente}</span>}
          </span>
          {prospect.website && (
            <a
              href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn('flex items-center gap-1 rounded-sm transition-colors hover:text-foreground', focusRing)}
            >
              Website <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
          <StatusDropdown
            endpoint={`/api/prospects/${prospect.nummer}`}
            status={prospect.status}
            onStatusChange={onStatusChange}
          />
          <span className="flex items-center gap-2">
            <NextActionBadge
              datum={prospect.actieDatum}
              omschrijving={prospect.actieOmschrijving}
              vandaag={vandaag}
            />
            <button
              type="button"
              onClick={onOpvolging}
              className={cn('rounded-md border px-2 py-1 text-2xs', focusRing)}
            >
              Opvolging
            </button>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
