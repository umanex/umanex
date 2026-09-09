import { sqliteTable, text, integer, real, index, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const SCHEMA_VERSION = 6

export type ItemStatus = 'new' | 'saved' | 'dismissed' | 'contacted'

export const jobs = sqliteTable(
  'jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    externalId: text('external_id').notNull(),
    source: text('source').notNull(),
    title: text('title').notNull(),
    company: text('company').notNull(),
    postcode: integer('postcode').notNull(),
    // Plaatsnaam van de bron. Adzuna levert geen postcode, dus draagt dit veld daar de
    // plaatsinfo — en daarmee de plaats-component van de dedupe-sleutel.
    city: text('city'),
    region: text('region').notNull(),
    url: text('url').notNull(),
    description: text('description'),
    postedAt: text('posted_at').notNull(),
    dedupeHash: text('dedupe_hash').notNull(),
    score: integer('score').notNull().default(0),
    scoreBreakdown: text('score_breakdown').notNull().default('{}'),
    jobStatus: text('job_status').notNull().default('new'),
    firstSeenAt: text('first_seen_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
  },
  (table) => ({
    dedupeHashIdx: uniqueIndex('jobs_dedupe_hash_idx').on(table.dedupeHash),
  })
)

export const companies = sqliteTable(
  'companies',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    externalId: text('external_id').notNull(),
    source: text('source').notNull(),
    companyName: text('company_name').notNull(),
    postcode: integer('postcode').notNull(),
    region: text('region').notNull(),
    naceCode: text('nace_code'),
    url: text('url'),
    signals: text('signals').notNull().default('[]'),
    // Waarop de lead rust. Nullable met opzet: een lead van vóór deze kolommen is niet
    // "0 vacatures" maar "nog niet geteld", en dat verschil hoort zichtbaar te blijven.
    vacatureAantal: integer('vacature_aantal'),
    designVacatures: integer('design_vacatures'),
    devVacatures: integer('dev_vacatures'),
    leadScore: integer('lead_score').notNull().default(0),
    scoreBreakdown: text('score_breakdown').notNull().default('{}'),
    rechtsgrond: text('rechtsgrond').notNull().default('gerechtvaardigd belang'),
    optOut: integer('opt_out', { mode: 'boolean' }).notNull().default(false),
    dedupeHash: text('dedupe_hash').notNull(),
    leadStatus: text('lead_status').notNull().default('new'),
    firstSeenAt: text('first_seen_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
  },
  (table) => ({
    dedupeHashIdx: uniqueIndex('companies_dedupe_hash_idx').on(table.dedupeHash),
  })
)

/**
 * Kleine key/value-opslag voor instellingen die in de app bewerkbaar zijn.
 *
 * Bewust key/value en geen kolom per instelling: er is er vandaag één (de zoekopdracht) en
 * een tabel met één kolom die telkens moet migreren is duurder dan een rij erbij.
 */
export const prospectStatus = sqliteTable('prospect_status', {
  /** Ondernemingsnummer zonder punten, zoals de KBO-spiegel het bewaart. */
  enterpriseNumber: text('enterprise_number').primaryKey(),
  status: text('status').notNull().default('new'),
  /** Dezelfde rem als op `companies`: zonder deze kolom gold de opt-out alleen voor leads. */
  optOut: integer('opt_out', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull(),
})

/**
 * Prospects uit een aangeleverde CSV — de derde herkomst.
 *
 * De sleutel is bewust dezelfde als die van `prospectStatus`: het ondernemingsnummer
 * zonder punten. Daardoor werkt de statuslaag zonder één regel wijziging, en valt een
 * bedrijf dat in beide bronnen zit vanzelf samen in plaats van te verdubbelen.
 */
export const csvProspects = sqliteTable('csv_prospects', {
  /** Ondernemingsnummer zonder punten, genormaliseerd met `kboNummer` bij de import. */
  enterpriseNumber: text('enterprise_number').primaryKey(),
  name: text('name').notNull(),
  naceLabel: text('nace_label'),
  city: text('city'),
  /** Decimaal: het geleverde bestand draagt 35.8 — een jaargemiddelde, geen hoofdtelling. */
  employeeCount: real('employee_count'),
  ebitda: real('ebitda'),
  valuationMultiple: real('valuation_multiple'),
  enterpriseValue: real('enterprise_value'),
  equityValue: real('equity_value'),
  /** Uit welk bestand deze rij komt, en wanneer hij voor het laatst is ingelezen. */
  bestandsnaam: text('bestandsnaam').notNull(),
  importedAt: text('imported_at').notNull(),
})

/** Waar een contactmoment aan hangt. Zie het commentaar bij de tabel in `ddl.ts`. */
export type SubjectType = 'lead' | 'prospect'

/** De kanalen waarlangs contact loopt. Vaste enum, geen vrije tekst. */
export const KANALEN = ['mail', 'linkedin', 'telefoon', 'in-persoon'] as const
export type Kanaal = (typeof KANALEN)[number]

export const contactMoments = sqliteTable(
  'contact_moments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    subjectType: text('subject_type').notNull(),
    /** `companies.id` als tekst voor een lead, het ondernemingsnummer voor een prospect. */
    subjectKey: text('subject_key').notNull(),
    datum: text('datum').notNull(),
    kanaal: text('kanaal').notNull(),
    notitie: text('notitie'),
    /** De grond zoals die gold op het moment van opslaan, niet zoals hij nu is. */
    rechtsgrond: text('rechtsgrond').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    subjectIdx: index('contact_moments_subject_idx').on(table.subjectType, table.subjectKey),
  })
)

export const nextActions = sqliteTable(
  'next_actions',
  {
    subjectType: text('subject_type').notNull(),
    subjectKey: text('subject_key').notNull(),
    datum: text('datum').notNull(),
    omschrijving: text('omschrijving').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.subjectType, table.subjectKey] }),
  })
)

/**
 * Coördinaten per onderneming, eenmalig opgehaald.
 *
 * `lat`/`lon` zijn nullable en `mislukt_reden` gevuld wanneer de bron niets vond: dat is een
 * uitkomst om te bewaren, niet een gat om opnieuw te bevragen.
 */
export const geocodeCache = sqliteTable('geocode_cache', {
  enterpriseNumber: text('enterprise_number').primaryKey(),
  lat: real('lat'),
  lon: real('lon'),
  /** Wat de bron werkelijk vond: `huisnummer`, `straat` of `gemeente`. */
  precisie: text('precisie'),
  bron: text('bron').notNull(),
  opgehaaldAt: text('opgehaald_at').notNull(),
  misluktReden: text('mislukt_reden'),
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export type Setting = typeof settings.$inferSelect

export const syncRuns = sqliteTable('sync_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  status: text('status').notNull().default('running'),
  jobsAdded: integer('jobs_added').notNull().default(0),
  jobsUpdated: integer('jobs_updated').notNull().default(0),
  leadsAdded: integer('leads_added').notNull().default(0),
  leadsUpdated: integer('leads_updated').notNull().default(0),
  sourceStatuses: text('source_statuses').notNull().default('{}'),
})

export type Job = typeof jobs.$inferSelect
export type Company = typeof companies.$inferSelect
export type SyncRun = typeof syncRuns.$inferSelect
export type ProspectStatus = typeof prospectStatus.$inferSelect
export type CsvProspect = typeof csvProspects.$inferSelect
export type ContactMoment = typeof contactMoments.$inferSelect
export type NextAction = typeof nextActions.$inferSelect
export type GeocodeRij = typeof geocodeCache.$inferSelect
