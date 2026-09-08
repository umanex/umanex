'use client'

import { useEffect, useRef } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@umanex/ui/components/ui/tooltip'
import { cn } from '@umanex/ui/lib/utils'
import { focusRing } from '@umanex/ui/lib/focus'
import type { Herkomst } from '@/lib/kbo/universum'

const OPTIES: { value: Herkomst; label: string; uitleg: string }[] = [
  { value: 'beide', label: 'Beide', uitleg: 'Het KBO-universum en de aangeleverde lijst samen' },
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
 * niets doen. Het prospects-tabblad heeft om precies die reden al een eigen regel controls.
 *
 * Waarom lokaal en niet in `packages/ui`: er bestaat daar geen segmented control (gemeten
 * 2026-09-08, met positieve controle op `TabsTrigger`), en een nieuwe story erbij zetten
 * laat `figma-sync-check.mjs` falen zolang er geen bijbehorende Figma-pagina is. Het staat
 * als openstaand werk in `apps/jobradar/BACKLOG.md`.
 *
 * Semantiek is `radiogroup`: één keuze uit drie, met roving tabindex zodat de groep één
 * stop in de tabvolgorde is in plaats van drie.
 */
export function HerkomstFilter({ waarde, onChange }: HerkomstFilterProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const naarIndex = useRef<number | null>(null)

  /**
   * Focus verplaatsen ná de render, niet ín de toetsafhandeling.
   *
   * React 18 flusht de update van een discrete event pas nadat de handler is teruggekeerd.
   * Focussen binnen die handler laat het focus-event dus vuren op een knop die in de DOM
   * nog `aria-checked="false"` draagt: een schermlezer meldt dan "niet aangevinkt" over
   * precies de optie die de gebruiker net gekozen heeft.
   */
  useEffect(() => {
    if (naarIndex.current === null) return
    refs.current[naarIndex.current]?.focus()
    naarIndex.current = null
  }, [waarde])

  const verplaats = (van: number, stap: number) => {
    const naar = (van + stap + OPTIES.length) % OPTIES.length
    naarIndex.current = naar
    onChange(OPTIES[naar]!.value)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Een zichtbaar groepslabel: zonder dit leest een ziende gebruiker drie losse
          woorden zonder te weten waarover ze gaan. De `aria-label` alleen bedient
          schermlezers en laat iedereen daarbuiten raden. */}
      <span id="herkomst-label" className="text-sm font-medium">
        Bron
      </span>
      <div
        role="radiogroup"
        aria-labelledby="herkomst-label"
        className="inline-flex h-10 items-center rounded-md bg-muted p-1 text-muted-foreground"
      >
        {OPTIES.map((optie, i) => {
          const actief = optie.value === waarde
          return (
            <Tooltip key={optie.value}>
              <TooltipTrigger asChild>
                <button
                  ref={(el) => {
                    refs.current[i] = el
                  }}
                  type="button"
                  role="radio"
                  aria-checked={actief}
                  // Roving tabindex: alleen de gekozen optie zit in de tabvolgorde.
                  tabIndex={actief ? 0 : -1}
                  onClick={() => onChange(optie.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault()
                      verplaats(i, 1)
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault()
                      verplaats(i, -1)
                    } else if (e.key === 'Home') {
                      e.preventDefault()
                      verplaats(i, -i)
                    } else if (e.key === 'End') {
                      e.preventDefault()
                      verplaats(i, OPTIES.length - 1 - i)
                    }
                  }}
                  className={cn(
                    'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
                    focusRing,
                    // De actieve toestand hangt niet aan kleur alleen: `bg-background` tegen
                    // `bg-muted` haalt 1,10:1 in light en 1,29:1 in dark, ver onder de 3:1
                    // die WCAG 1.4.11 voor de toestand van een control vraagt. De rand doet
                    // het werk dat de vulling niet kan.
                    actief
                      ? 'border border-input bg-background text-foreground shadow-sm'
                      : 'border border-transparent hover:text-foreground'
                  )}
                >
                  {optie.label}
                </button>
              </TooltipTrigger>
              {/* Radix Tooltip in plaats van `title`: dat attribuut verschijnt alleen bij
                  muis-hover, dus een toetsenbord- of touchgebruiker zag de uitleg nooit. */}
              <TooltipContent>{optie.uitleg}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
