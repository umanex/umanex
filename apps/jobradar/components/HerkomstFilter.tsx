'use client'

import { useRef } from 'react'
import { cn } from '@umanex/ui/lib/utils'
import { focusRing } from '@umanex/ui/lib/focus'
import type { Herkomst } from '@/lib/kbo/universum'

const OPTIES: { value: Herkomst; label: string; uitleg: string }[] = [
  { value: 'beide', label: 'Beide', uitleg: 'KBO-universum en de aangeleverde lijst samen' },
  { value: 'kbo', label: 'KBO', uitleg: 'Alleen het KBO-universum' },
  { value: 'csv', label: 'Lijst', uitleg: 'Alleen de aangeleverde lijst' },
]

type HerkomstFilterProps = {
  waarde: Herkomst
  onChange: (waarde: Herkomst) => void
}

/**
 * Segmented control voor de bron van een prospect.
 *
 * Waarom hier en niet in `FilterBar`: die balk staat bóven de `Tabs` en geldt dus voor alle
 * drie de tabbladen. Een herkomst-filter daar zou op Vacatures en Leads zichtbaar zijn en
 * niets doen. Het prospects-tabblad heeft om precies die reden al een eigen regel controls
 * ("Alleen met personeel"); deze hoort daarnaast.
 *
 * Waarom lokaal en niet in `packages/ui`: er bestaat daar geen segmented control (gemeten
 * 2026-09-08, met positieve controle op `TabsTrigger`), en een nieuwe story erbij zetten
 * laat `figma-sync-check.mjs` falen zolang er geen bijbehorende Figma-pagina is. De vorm
 * leent wél de klassenreeks van `TabsList`/`TabsTrigger`, zodat hij niet naast de tabbladen
 * een tweede visuele taal introduceert.
 *
 * Semantiek is `radiogroup`, niet een rij knoppen: het is één keuze uit drie, en een
 * schermlezer hoort "2 van 3" te melden. Met roving tabindex — één stop in de tabvolgorde,
 * pijltjes eroverheen — want drie losse tabstops voor één keuze is precies wat de
 * WAI-ARIA-praktijk voor radiogroups vermijdt.
 */
export function HerkomstFilter({ waarde, onChange }: HerkomstFilterProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const verplaats = (van: number, stap: number) => {
    const naar = (van + stap + OPTIES.length) % OPTIES.length
    onChange(OPTIES[naar]!.value)
    refs.current[naar]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label="Herkomst van de prospect"
      className="inline-flex items-center rounded-md bg-muted p-1"
    >
      {OPTIES.map((optie, i) => {
        const actief = optie.value === waarde
        return (
          <button
            key={optie.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={actief}
            // Roving tabindex: alleen de gekozen optie zit in de tabvolgorde.
            tabIndex={actief ? 0 : -1}
            title={optie.uitleg}
            onClick={() => onChange(optie.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault()
                verplaats(i, 1)
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault()
                verplaats(i, -1)
              }
            }}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium transition-all',
              focusRing,
              actief ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {optie.label}
          </button>
        )
      })}
    </div>
  )
}
