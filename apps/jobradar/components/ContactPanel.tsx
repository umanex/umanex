'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@umanex/ui/components/ui/sheet'
import { Button } from '@umanex/ui/components/ui/button'
import { Label } from '@umanex/ui/components/ui/label'
import { cn } from '@umanex/ui/lib/utils'
import { focusRing } from '@umanex/ui/lib/focus'
import { ContactTimeline } from './ContactTimeline'
import { KANALEN, type ContactMoment, type NextAction, type SubjectType } from '@/lib/db/schema'
import { MAX_NOTITIE } from '@/lib/contact'

type ContactPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: SubjectType
  /** `companies.id` als tekst voor een lead, het ondernemingsnummer voor een prospect. */
  subjectKey: string
  naam: string
  vandaag: string
  /** De lijst mag zijn eigen status bijwerken zodra een contactmoment die verzet. */
  onStatusChange?: (status: string) => void
}

const KANAAL_LABEL: Record<string, string> = {
  mail: 'Mail',
  linkedin: 'LinkedIn',
  telefoon: 'Telefoon',
  'in-persoon': 'In persoon',
}

/**
 * De contacthistoriek en het formulier van één bedrijf, in een sheet van rechts.
 *
 * Waarom een sheet en geen modal of inline uitklappen: de kaartlijst is een grid van drie
 * kolommen. Inline uitklappen duwt de twee buren uit elkaar bij elke lange historiek, een
 * modal blokkeert de lijst. Een sheet laat hem staan.
 *
 * De opt-out-rem staat óók in de API (`app/api/opvolging/route.ts` geeft 409). Hier gaat het
 * om uitleg vóór de gebruiker typt; daar om de garantie dat het niet kán.
 */
export function ContactPanel({
  open,
  onOpenChange,
  type,
  subjectKey,
  naam,
  vandaag,
  onStatusChange,
}: ContactPanelProps) {
  const [momenten, setMomenten] = useState<ContactMoment[]>([])
  const [actie, setActie] = useState<NextAction | null>(null)
  const [optOut, setOptOut] = useState(false)
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)
  const [teVerwijderen, setTeVerwijderen] = useState<number | null>(null)

  const [datum, setDatum] = useState(vandaag)
  const [kanaal, setKanaal] = useState<string>(KANALEN[0])
  const [notitie, setNotitie] = useState('')
  const [actieDatum, setActieDatum] = useState('')
  const [actieOms, setActieOms] = useState('')

  const haal = useCallback(
    async (signal?: AbortSignal) => {
      setLaden(true)
      setFout(null)
      try {
        const res = await fetch(
          `/api/opvolging?type=${type}&key=${encodeURIComponent(subjectKey)}`,
          { signal }
        )
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          setFout(data?.error ?? `Mislukt (HTTP ${res.status})`)
          return
        }
        setMomenten(data.momenten)
        setActie(data.actie)
        setOptOut(!!data.optOut)
        setActieDatum(data.actie?.datum ?? '')
        setActieOms(data.actie?.omschrijving ?? '')
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setFout('Geen antwoord van de server.')
      } finally {
        setLaden(false)
      }
    },
    [type, subjectKey]
  )

  useEffect(() => {
    if (!open) return
    const ctrl = new AbortController()
    void haal(ctrl.signal)
    return () => ctrl.abort()
  }, [open, haal])

  const voegToe = async () => {
    setBezig(true)
    setFout(null)
    try {
      const res = await fetch('/api/opvolging', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, key: subjectKey, datum, kanaal, notitie }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setFout(data?.error ?? `Mislukt (HTTP ${res.status})`)
        return
      }
      setNotitie('')
      setDatum(vandaag)
      if (data.status) onStatusChange?.(data.status)
      await haal()
    } finally {
      setBezig(false)
    }
  }

  const verwijder = async (id: number) => {
    setBezig(true)
    try {
      const res = await fetch(`/api/opvolging/moment/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        setFout(d?.error ?? `Verwijderen mislukt (HTTP ${res.status})`)
        return
      }
      setTeVerwijderen(null)
      await haal()
    } finally {
      setBezig(false)
    }
  }

  const bewaarActie = async () => {
    setBezig(true)
    setFout(null)
    try {
      const leeg = !actieDatum && !actieOms
      const res = leeg
        ? await fetch(
            `/api/opvolging/actie?type=${type}&key=${encodeURIComponent(subjectKey)}`,
            { method: 'DELETE' }
          )
        : await fetch('/api/opvolging/actie', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type, key: subjectKey, datum: actieDatum, omschrijving: actieOms }),
          })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setFout(data?.error ?? `Mislukt (HTTP ${res.status})`)
        return
      }
      await haal()
    } finally {
      setBezig(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{naam}</SheetTitle>
          <SheetDescription>
            {type === 'lead' ? 'Lead uit de vacaturedata' : 'Prospect'} · contacthistoriek en
            volgende actie.
          </SheetDescription>
        </SheetHeader>

        <p aria-live="polite" className="sr-only">
          {laden ? 'Historiek laden' : `${momenten.length} contactmomenten`}
        </p>

        {fout && (
          <p role="alert" className="rounded-md border border-destructive p-2 text-sm text-destructive">
            {fout}
          </p>
        )}

        {optOut && (
          <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
            Dit bedrijf heeft zich afgemeld. Een contactmoment vastleggen kan niet — het
            formulier hieronder is daarom uitgeschakeld, en de server weigert het ook.
          </p>
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Historiek</h3>
          {laden ? (
            <p className="text-sm text-muted-foreground">Laden…</p>
          ) : (
            <ContactTimeline
              momenten={momenten}
              teVerwijderen={teVerwijderen}
              onVerwijderVraag={setTeVerwijderen}
              onVerwijderBevestig={verwijder}
              bezig={bezig}
            />
          )}
        </section>

        <section className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">Contactmoment toevoegen</h3>
          <div className="flex flex-wrap gap-2">
            <div className="space-y-1">
              <Label htmlFor="contact-datum" className="text-2xs">
                Datum
              </Label>
              <input
                id="contact-datum"
                type="date"
                value={datum}
                max={vandaag}
                disabled={optOut || bezig}
                onChange={(e) => setDatum(e.target.value)}
                // `focus-within` bovenop de gedeelde ring: een native date-input bestaat uit
                // dag/maand/jaar-segmenten, en Chromium matcht `:focus-visible` niet op de
                // host wanneer je een segment binnentabt. Gemeten 2026-09-09 door de
                // flow-harness: drie stops zonder zichtbare focus, alle drie date-velden,
                // terwijl de select en textarea ernaast hun ring wél toonden.
                className={cn(
                  'rounded-md border bg-background px-2 py-1 text-sm text-foreground disabled:opacity-50',
                  'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background',
                  focusRing
                )}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact-kanaal" className="text-2xs">
                Kanaal
              </Label>
              <select
                id="contact-kanaal"
                value={kanaal}
                disabled={optOut || bezig}
                onChange={(e) => setKanaal(e.target.value)}
                className={cn(
                  'cursor-pointer rounded-md border bg-background px-2 py-1 text-sm text-foreground disabled:opacity-50',
                  focusRing
                )}
              >
                {KANALEN.map((k) => (
                  <option key={k} value={k}>
                    {KANAAL_LABEL[k] ?? k}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="contact-notitie" className="text-2xs">
              Notitie
            </Label>
            <textarea
              id="contact-notitie"
              value={notitie}
              rows={3}
              maxLength={MAX_NOTITIE}
              disabled={optOut || bezig}
              onChange={(e) => setNotitie(e.target.value)}
              placeholder="Wat kwam eruit?"
              className={cn(
                'w-full rounded-md border bg-background px-2 py-1 text-sm text-foreground disabled:opacity-50',
                focusRing
              )}
            />
          </div>
          <Button size="sm" onClick={voegToe} disabled={optOut || bezig || !datum}>
            Vastleggen
          </Button>
        </section>

        <section className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">Volgende actie</h3>
          <p className="text-2xs text-muted-foreground">
            Eén per bedrijf. Leeg laten en bewaren haalt hem weg.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              aria-label="Datum van de volgende actie"
              value={actieDatum}
              disabled={bezig}
              onChange={(e) => setActieDatum(e.target.value)}
              className={cn(
                'rounded-md border bg-background px-2 py-1 text-sm text-foreground disabled:opacity-50',
                'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background',
                focusRing
              )}
            />
            <input
              type="text"
              aria-label="Omschrijving van de volgende actie"
              value={actieOms}
              maxLength={200}
              disabled={bezig}
              onChange={(e) => setActieOms(e.target.value)}
              placeholder="Bellen, mail sturen…"
              className={cn(
                'min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm text-foreground disabled:opacity-50',
                focusRing
              )}
            />
          </div>
          <Button size="sm" variant="outline" onClick={bewaarActie} disabled={bezig}>
            {actie ? 'Bijwerken' : 'Bewaren'}
          </Button>
        </section>
      </SheetContent>
    </Sheet>
  )
}
