'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@umanex/ui/components/ui/tabs'
import { TooltipProvider } from '@umanex/ui/components/ui/tooltip'
import { cn } from '@umanex/ui/lib/utils'
import { focusRing } from '@umanex/ui/lib/focus'
import { FilterBar } from './FilterBar'
import { SyncButton } from './SyncButton'
import { CoverageBar } from './CoverageBar'
import { JobCard } from './JobCard'
import { LeadCard } from './LeadCard'
import { ProspectCard, type Prospect } from './ProspectCard'
import { HerkomstFilter } from './HerkomstFilter'
import { Button } from '@umanex/ui/components/ui/button'
import { Checkbox } from '@umanex/ui/components/ui/checkbox'
import { Label } from '@umanex/ui/components/ui/label'
import type { SpiegelStaat, KboVermoeden } from '@/lib/kbo/spiegel'
import { VEROUDERD_NA_DAGEN, type Herkomst, type Sortering } from '@/lib/kbo/universum'
import type { Job, Company, ItemStatus } from '@/lib/db/schema'
import { normaliseerBedrijf } from '@/lib/matching'
import type { RegionCode } from '@/lib/regions'
import type { Dekking } from '@/lib/coverage'

type DashboardClientProps = {
  jobs: Job[]
  companies: Company[]
  previousSyncAt: string
  dekking: Dekking
  /** Bedrijfsnaam → wat KBO er vermoedelijk over zegt. Leeg zonder spiegel. */
  vermoedens: Record<string, KboVermoeden>
}

const ALL_REGIONS: RegionCode[] = ['WVL', 'OVL', 'BRU']

export function DashboardClient({
  jobs: initialJobs,
  companies: initialCompanies,
  previousSyncAt,
  dekking,
  vermoedens,
}: DashboardClientProps) {
  const [jobs, setJobs] = useState(initialJobs)
  const [companies, setCompanies] = useState(initialCompanies)
  const [regions, setRegions] = useState<RegionCode[]>(ALL_REGIONS)
  const [minScore, setMinScore] = useState(0)
  const [statusFilter, setStatusFilter] = useState<ItemStatus | ''>('')
  const [zoek, setZoek] = useState('')
  // Controlled, want de doorklik vanaf een lead moet het tabblad kunnen zetten.
  const [tab, setTab] = useState('jobs')
  // Onthouden of de huidige zoekterm van een doorklik komt: dan verdient een lege lijst
  // een andere uitleg dan een gewone mistreffer.
  const [viaLead, setViaLead] = useState(false)

  // ── Prospects ──────────────────────────────────────────────────────────────
  // Eigen staat, want deze lijst komt niet van de server-render mee: 14.613 rijen gaan niet
  // als prop naar de client. Het tabblad haalt zijn eigen pagina op zodra het actief wordt.
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [prospectTotaal, setProspectTotaal] = useState(0)
  const [prospectPaginas, setProspectPaginas] = useState(1)
  const [prospectPagina, setProspectPagina] = useState(1)
  const [prospectBezig, setProspectBezig] = useState(false)
  const [prospectFout, setProspectFout] = useState<string | null>(null)
  const [spiegel, setSpiegel] = useState<SpiegelStaat | null>(null)
  // Standaard aan: zonder deze zeef heeft vier vijfde van de lijst geen personeel.
  const [alleenWerkgevers, setAlleenWerkgevers] = useState(true)
  const [herkomst, setHerkomst] = useState<Herkomst>('beide')
  // Standaard UIT. De zeef verbergt op het geleverde bestand 44 van de 218 CSV-rijen, en
  // een lijst die bij het openen stil een vijfde van zichzelf wegneemt is precies de
  // afkapping-zonder-melding die deze app elders vermijdt.
  const [alleenWinstgevend, setAlleenWinstgevend] = useState(false)
  const [sortering, setSortering] = useState<Sortering>('oprichting')
  // CSV-rijen zonder KBO-tegenhanger. Ze kunnen niet in de lijst staan; ze worden gemeld.
  const [zonderKbo, setZonderKbo] = useState(0)
  const vandaag = new Date().toISOString().slice(0, 10)

  // De ondernemingsnummers die al als lead bestaan. Hiermee kan een prospectkaart tonen dat
  // er vacatures van dat bedrijf binnenkwamen — de brug tussen de twee tabbladen, gelegd op
  // het nummer in plaats van op een naam die op twee plekken anders geschreven staat.
  const leadNummers = new Set(Object.values(vermoedens).map((v) => v.nummer))

  // Gewone substring, geen regex — een zoekterm met een haakje erin is een zoekterm, geen patroon.
  const term = zoek.trim().toLowerCase()
  const raakt = (...velden: string[]) => term === '' || velden.some((v) => v.toLowerCase().includes(term))

  /**
   * Bij een doorklik matchen we op de bedrijfssleutel, niet op de vrije zoektekst.
   *
   * De telling op de kaart groepeert via `normaliseerBedrijf`; het zoekveld kijkt ook naar
   * titels. Dat liep uiteen: "Volvo Group" toonde 3 op de kaart en 6 na de klik, want een
   * uitzendkantoor zet de klantnaam in de titel. Twee getallen die elkaar tegenspreken op
   * één klik afstand, terwijl herleidbaarheid het hele punt van die knop is.
   */
  const bedrijfsSleutel = viaLead ? normaliseerBedrijf(zoek) : null
  const raaktJob = (titel: string, bedrijf: string) =>
    bedrijfsSleutel !== null ? normaliseerBedrijf(bedrijf) === bedrijfsSleutel : raakt(titel, bedrijf)

  const zoekveldRef = useRef<HTMLInputElement>(null)

  const toonVacaturesVan = (bedrijf: string) => {
    setZoek(bedrijf)
    setViaLead(true)
    setTab('jobs')
    // Het leadpaneel unmount bij het wisselen van tabblad, dus de knop verdwijnt onder de
    // focus vandaan en die valt terug op body. De focus verhuist mee naar het zoekveld, dat
    // nu de bedrijfsnaam draagt en waar je hem ook weer kunt wissen.
    requestAnimationFrame(() => zoekveldRef.current?.focus())
  }

  const wijzigZoek = (waarde: string) => {
    setZoek(waarde)
    setViaLead(false)
  }

  const filteredJobs = jobs
    .filter((j) =>
      regions.includes(j.region as RegionCode) &&
      j.score >= minScore &&
      (statusFilter === '' || j.jobStatus === statusFilter) &&
      raaktJob(j.title, j.company)
    )
    .sort((a, b) => b.score - a.score)

  const filteredCompanies = companies
    .filter((c) =>
      regions.includes(c.region as RegionCode) &&
      c.leadScore >= minScore &&
      (statusFilter === '' || c.leadStatus === statusFilter) &&
      raakt(c.companyName)
    )
    .sort((a, b) => b.leadScore - a.leadScore)

  const haalProspects = useCallback(
    async (signal: AbortSignal) => {
      setProspectBezig(true)
      setProspectFout(null)
      try {
        const p = new URLSearchParams()
        for (const r of regions) p.append('regio', r)
        if (zoek.trim()) p.set('zoek', zoek.trim())
        if (!alleenWerkgevers) p.set('werkgevers', '0')
        if (herkomst !== 'beide') p.set('herkomst', herkomst)
        if (alleenWinstgevend) p.set('winstgevend', '1')
        if (sortering !== 'oprichting') p.set('sortering', sortering)
        p.set('pagina', String(prospectPagina))
        const res = await fetch(`/api/prospects?${p}`, { signal })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          setProspectFout(data?.error ?? `Mislukt (HTTP ${res.status})`)
          return
        }
        setProspects(data.prospects)
        setProspectTotaal(data.totaal)
        setProspectPaginas(data.paginas)
        setZonderKbo(data.zonderKbo ?? 0)
        setSpiegel(data.staat)
      } catch (e) {
        // Een afgebroken verzoek is geen fout: dat is een filter die sneller wisselde dan
        // de server antwoordde. Zonder deze tak flikkert er een foutmelding bij elk woord.
        if ((e as Error).name !== 'AbortError') setProspectFout('Geen antwoord van de server.')
      } finally {
        setProspectBezig(false)
      }
    },
    [regions, zoek, alleenWerkgevers, herkomst, alleenWinstgevend, sortering, prospectPagina]
  )

  useEffect(() => {
    if (tab !== 'prospects') return
    const ctrl = new AbortController()
    // Kleine vertraging: dit tabblad vraagt de server, en typen in het zoekveld zou anders
    // per letter een query over 14.613 rijen starten.
    const t = setTimeout(() => void haalProspects(ctrl.signal), 250)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [tab, haalProspects])

  // Een filterwijziging hoort je op pagina 1 te zetten; anders sta je op pagina 7 van een
  // lijst die er nog maar drie heeft en lijkt het resultaat leeg.
  useEffect(() => {
    setProspectPagina(1)
  }, [regions, zoek, alleenWerkgevers, herkomst, alleenWinstgevend, sortering])

  const handleProspectStatusChange = (nummer: string, status: ItemStatus) => {
    setProspects((prev) => prev.map((p) => (p.nummer === nummer ? { ...p, status } : p)))
  }

  const handleJobStatusChange = (id: number, status: ItemStatus) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, jobStatus: status } : j)))
  }

  const handleLeadStatusChange = (id: number, status: ItemStatus) => {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, leadStatus: status } : c)))
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">JobRadar</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/instellingen"
              className={cn(
                'rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground',
                focusRing
              )}
            >
              Instellingen
            </Link>
            <SyncButton />
          </div>
        </div>

        <CoverageBar dekking={dekking} />

        <FilterBar
          veldRef={zoekveldRef}
          zoek={zoek}
          onZoekChange={wijzigZoek}
          regions={regions}
          minScore={minScore}
          statusFilter={statusFilter}
          onRegionsChange={setRegions}
          onMinScoreChange={setMinScore}
          onStatusFilterChange={setStatusFilter}
        />

        {/* Na een doorklik verandert de lijst zonder dat er iets verplaatst; zonder dit hoort
            een schermlezergebruiker niet wat er gebeurde. */}
        <p aria-live="polite" className="sr-only">
          {viaLead
            ? `${filteredJobs.length} ${filteredJobs.length === 1 ? 'vacature' : 'vacatures'} van ${zoek}`
            : ''}
        </p>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="jobs">
              Vacatures
              <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {filteredJobs.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="leads">
              Leads
              <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {filteredCompanies.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="prospects">
              Prospects
              <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {prospectTotaal}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs">
            {/* Het tabblad draagt het label al zichtbaar en Radix hangt het paneel er via
                aria-labelledby aan; wat ontbrak was het NIVEAU. Zonder deze h2 sprong de
                koppen-outline van h1 naar 327 kaart-h3's (ux-audit 2026-08-11, P3). */}
            <h2 className="sr-only">Vacatures</h2>
            {filteredJobs.length === 0 ? (
              <EmptyState
                message={
                  // Geen diagnose die niet gecontroleerd is. Er zijn twee toestanden en het
                  // verschil is meetbaar: staat het bedrijf wél in de database, dan filteren
                  // regio, score of status het weg. Staat het er niet, dan is dat het antwoord.
                  bedrijfsSleutel !== null
                    ? jobs.some((j) => normaliseerBedrijf(j.company) === bedrijfsSleutel)
                      ? `Geen vacatures van "${zoek}" binnen je huidige filters — pas regio, status of minimumscore aan.`
                      : `Er staan geen vacatures van "${zoek}" in de database.`
                    : term
                      ? `Geen vacatures gevonden voor "${zoek}".`
                      : "Geen vacatures gevonden. Druk op 'Sync nu' om data op te halen."
                }
              />
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    isNew={job.firstSeenAt >= previousSyncAt}
                    onStatusChange={(status) => handleJobStatusChange(job.id, status)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="leads">
            <h2 className="sr-only">Leads</h2>
            {filteredCompanies.length === 0 ? (
              <EmptyState
                message={
                  term
                    ? `Geen leads gevonden voor "${zoek}".`
                    : "Geen leads gevonden. Druk op 'Sync nu' om data op te halen."
                }
              />
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredCompanies.map((company) => (
                  <LeadCard
                    key={company.id}
                    company={company}
                    vermoeden={vermoedens[company.companyName] ?? null}
                    isNew={company.firstSeenAt >= previousSyncAt}
                    onStatusChange={(status) => handleLeadStatusChange(company.id, status)}
                onToonVacatures={toonVacaturesVan}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="prospects">
            <h2 className="sr-only">Prospects</h2>

            {/* Twee meldingen die BOVEN de lijst horen, niet in plaats ervan: een ontbrekende
                of verouderde spiegel zegt iets over de data, niet over het resultaat. */}
            {spiegel?.soort === 'ontbreekt' && (
              <p className="mt-3 rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                Er staat nog geen KBO-spiegel op deze machine. Draai{' '}
                <code className="rounded bg-background px-1 py-0.5">pnpm --filter jobradar kbo:sync --full</code>{' '}
                — dat haalt de volledige extract op (~298 MB) en vult{' '}
                <code className="rounded bg-background px-1 py-0.5">.data/kbo.db</code>.
              </p>
            )}
            {spiegel?.soort === 'ok' && spiegel.ouderdomDagen !== null && spiegel.ouderdomDagen > VEROUDERD_NA_DAGEN && (
              <p className="mt-3 rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                De spiegel is van {spiegel.snapshot} — {spiegel.ouderdomDagen} dagen oud. Draai{' '}
                <code className="rounded bg-background px-1 py-0.5">pnpm --filter jobradar kbo:sync</code>{' '}
                voor de dagelijkse updates. FOD Economie bewaart er 32 dagen; daarna is een verse{' '}
                <code className="rounded bg-background px-1 py-0.5">--full</code> nodig.
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <HerkomstFilter waarde={herkomst} onChange={setHerkomst} />
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="alleen-werkgevers"
                    checked={alleenWerkgevers}
                    onCheckedChange={(v) => setAlleenWerkgevers(v === true)}
                  />
                  <Label htmlFor="alleen-werkgevers" className="cursor-pointer text-sm">
                    Alleen met personeel
                  </Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="alleen-winstgevend"
                    checked={alleenWinstgevend}
                    onCheckedChange={(v) => setAlleenWinstgevend(v === true)}
                  />
                  <Label htmlFor="alleen-winstgevend" className="cursor-pointer text-sm">
                    Alleen winstgevend
                  </Label>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label htmlFor="prospect-sortering" className="text-sm text-muted-foreground">
                  Sorteer
                </label>
                <select
                  id="prospect-sortering"
                  value={sortering}
                  onChange={(e) => setSortering(e.target.value as Sortering)}
                  className={cn(
                    'cursor-pointer rounded-md border bg-background px-2 py-1 text-sm text-foreground',
                    focusRing
                  )}
                >
                  <option value="oprichting">Nieuwste eerst</option>
                  <option value="omvang">Grootste eerst</option>
                  <option value="ebitda">Hoogste EBITDA eerst</option>
                </select>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {prospectBezig ? 'Bezig…' : `${prospectTotaal} prospect${prospectTotaal === 1 ? '' : 's'}`}
                </p>
              </div>
            </div>

            {/* Twee meldingen die een gevolg van de filters uitleggen in plaats van het stil
                te laten gebeuren. Beide staan boven de lijst, niet in plaats ervan. */}
            {alleenWinstgevend && (
              <p className="mt-3 rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                Alleen winstgevend zeeft op EBITDA, en die staat alleen in de aangeleverde
                lijst. Bedrijven die je enkel uit het KBO-universum kent vallen hier dus weg —
                niet omdat ze verlies maken, maar omdat er geen cijfer over bekend is.
              </p>
            )}
            {zonderKbo > 0 && (
              <p className="mt-3 rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                {zonderKbo} {zonderKbo === 1 ? 'bedrijf uit de lijst staat' : 'bedrijven uit de lijst staan'} niet
                in de KBO-spiegel. {zonderKbo === 1 ? 'Het valt' : 'Ze vallen'} daardoor buiten deze selectie:
                zonder KBO-adres {zonderKbo === 1 ? 'is er' : 'zijn er'} geen postcode en dus geen regio om op
                te filteren.
              </p>
            )}

            {prospectFout ? (
              <p role="alert" className="mt-8 text-center text-sm text-destructive">
                {prospectFout}
              </p>
            ) : prospects.length === 0 && !prospectBezig ? (
              <EmptyState
                message={
                  spiegel?.soort === 'ontbreekt'
                    ? 'Zonder spiegel valt er niets te tonen — ook een geïmporteerde lijst niet, want die wordt aan de spiegel gekoppeld.'
                    : herkomst === 'csv'
                      ? 'Nog niets uit een aangeleverde lijst. Draai pnpm --filter jobradar prospects:import <pad.csv> om er een in te lezen.'
                      : alleenWerkgevers
                      ? 'Geen prospects binnen je huidige filters. Zet "Alleen met personeel" uit om ook eenmanszaken te zien.'
                      : 'Geen prospects binnen je huidige filters — pas regio of zoekterm aan.'
                }
              />
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {prospects.map((p) => (
                  <ProspectCard
                    key={p.nummer}
                    prospect={p}
                    heeftVacatures={leadNummers.has(p.nummer)}
                    vandaag={vandaag}
                    onStatusChange={(status) => handleProspectStatusChange(p.nummer, status)}
                  />
                ))}
              </div>
            )}

            {prospectPaginas > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={prospectPagina <= 1 || prospectBezig}
                  onClick={() => setProspectPagina((p) => Math.max(1, p - 1))}
                >
                  Vorige
                </Button>
                <span className="text-sm tabular-nums text-muted-foreground">
                  pagina {prospectPagina} van {prospectPaginas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={prospectPagina >= prospectPaginas || prospectBezig}
                  onClick={() => setProspectPagina((p) => Math.min(prospectPaginas, p + 1))}
                >
                  Volgende
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
      <p className="text-sm">{message}</p>
    </div>
  )
}
