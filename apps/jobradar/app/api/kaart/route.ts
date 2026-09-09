import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { haalSelectie, koppelBedrijven } from '@/lib/kbo/spiegel'
import { leesFilter } from '@/lib/kbo/universum'
import { binnenKaart, inProvincie } from '@/lib/kaart'
import type { ItemStatus } from '@/lib/db/schema'
import type { RegionCode } from '@/lib/regions'

export const dynamic = 'force-dynamic'

export type KaartPunt = {
  nummer: string
  naam: string
  lat: number
  lon: number
  /** `lijst` = adres uit de KBO-bron. `lead` = een KBO-*vermoeden*, dus een gok. */
  herkomst: 'lijst' | 'lead'
  /** Wat de geocoder werkelijk vond: huisnummer, straat of gemeente. */
  precisie: string | null
  status: ItemStatus
}

/**
 * De punten voor de kaart in één antwoord, onder dezelfde filterstand als de lijst.
 *
 * Geen paginering, anders dan bij de lijst: het zijn er een paar honderd en een kaart met
 * een derde van zijn punten is geen kaart. Bij een universum dat groeit hoort hier een
 * grens — dan is een zichtbare afkapping beter dan een stille.
 */
/**
 * De ringen van de drie provincies, uit hetzelfde bestand dat de kaart tekent. Eén bron,
 * anders kan de teller iets anders zeggen dan het beeld.
 */
function provincieRingen(): number[][][] {
  const pad = join(process.cwd(), 'public', 'geo', 'provincies.json')
  const geo = JSON.parse(readFileSync(pad, 'utf8')) as {
    features: { geometry: { coordinates: number[][][] } }[]
  }
  return geo.features.map((f) => f.geometry.coordinates[0]!)
}

export async function GET(request: Request) {
  const filter = leesFilter(new URL(request.url).searchParams)

  // De selectie van de lijst, ongepagineerd. `null` = geen spiegel.
  const selectie = haalSelectie(filter)
  if (!selectie) {
    return NextResponse.json({
      ok: true,
      spiegel: 'ontbreekt',
      punten: [],
      leadsZonderAdres: 0,
      zonderCoordinaat: 0,
      buitenProvincies: 0,
      buitenFilter: 0,
      totaalGeocodeerd: 0,
    })
  }

  const db = getDb()
  const ringen = provincieRingen()

  const csv = await db.select().from(schema.csvProspects)
  const geo = await db.select().from(schema.geocodeCache)
  const statussen = await db.select().from(schema.prospectStatus)
  const leads = await db.select().from(schema.companies)

  const coord = new Map(geo.map((g) => [g.enterpriseNumber, g]))
  const status = new Map(statussen.map((s) => [s.enterpriseNumber, s.status as ItemStatus]))

  const punten: KaartPunt[] = []
  let zonderCoordinaat = 0
  // Een punt dat wél een coördinaat heeft maar buiten de drie provincies valt, is iets
  // anders dan een punt zonder coördinaat. Aparte teller, anders verdwijnt het verschil.
  let buitenProvincies = 0
  // Wat een coordinaat heeft maar buiten de huidige filterstand valt. Vierde teller en
  // geen stilte: een punt dat wegvalt door een keuze van de gebruiker is iets anders dan
  // een punt dat de geocoder niet vond.
  let buitenFilter = 0

  for (const rij of csv) {
    if (!selectie.has(rij.enterpriseNumber)) {
      buitenFilter++
      continue
    }
    const g = coord.get(rij.enterpriseNumber)
    if (!g || g.lat === null || g.lon === null || !binnenKaart(g.lon, g.lat)) {
      zonderCoordinaat++
      continue
    }
    if (!inProvincie(g.lon, g.lat, ringen)) {
      buitenProvincies++
      continue
    }
    punten.push({
      nummer: rij.enterpriseNumber,
      naam: rij.name,
      lat: g.lat,
      lon: g.lon,
      herkomst: 'lijst',
      precisie: g.precisie,
      status: status.get(rij.enterpriseNumber) ?? 'new',
    })
  }

  // Leads dragen geen ondernemingsnummer; hun adres bestaat alleen via de KBO-koppeling, en
  // die is een vermoeden — de app labelt het elders ook zo. Vandaar een eigen herkomst,
  // zodat de kaart het verschil kan tonen in plaats van een gok als feit te tekenen.
  const vermoedens = koppelBedrijven(
    leads.map((l) => ({ naam: l.companyName, regio: l.region as RegionCode }))
  )
  let leadsZonderAdres = 0
  const alGetekend = new Set(punten.map((p) => p.nummer))
  const term = filter.zoek?.trim().toLowerCase()

  for (const lead of leads) {
    // De lead-laag is een tweede laag, geen tweede selectie: hij volgt regio, zoekterm en
    // bron, maar niet de zeven die eigenschappen van het KBO-*universum* toetsen. Een lead
    // komt uit een vacaturebron en draagt geen NACE-hoofdactiviteit, geen RSZ-registratie
    // en geen EBITDA. Gemeten 2026-09-09: door de volledige prospectselectie halen 2 van
    // de 12 vermoedens het — die zeef toepassen zou er tien stil laten verdwijnen.
    if (
      filter.herkomst === 'csv' ||
      !filter.regions.includes(lead.region as RegionCode) ||
      (term && !lead.companyName.toLowerCase().includes(term))
    ) {
      buitenFilter++
      continue
    }
    const v = vermoedens.get(lead.companyName)
    if (!v) {
      leadsZonderAdres++
      continue
    }
    if (alGetekend.has(v.nummer)) continue
    const g = coord.get(v.nummer)
    if (!g || g.lat === null || g.lon === null || !binnenKaart(g.lon, g.lat)) {
      zonderCoordinaat++
      continue
    }
    if (!inProvincie(g.lon, g.lat, ringen)) {
      buitenProvincies++
      continue
    }
    punten.push({
      nummer: v.nummer,
      naam: lead.companyName,
      lat: g.lat,
      lon: g.lon,
      herkomst: 'lead',
      precisie: g.precisie,
      status: lead.leadStatus as ItemStatus,
    })
  }

  return NextResponse.json({
    ok: true,
    punten,
    // Drie tellers, want drie verschillende redenen om er niet te staan. Ze op één hoop
    // gooien maakt van "we weten het niet" en "het lukte niet" hetzelfde ding.
    leadsZonderAdres,
    zonderCoordinaat,
    buitenProvincies,
    buitenFilter,
    totaalGeocodeerd: geo.filter((g) => g.lat !== null).length,
  })
}
