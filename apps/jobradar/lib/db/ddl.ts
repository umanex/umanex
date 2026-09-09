/**
 * De DDL en de kolom-migraties, los van `index.ts`.
 *
 * Dat bestand begint met `import 'server-only'`, dus alles erin is buiten Next niet aan te
 * roepen — en daarmee was er geen manier om de sync-logica tegen een echt schema te toetsen
 * zonder de database van de gebruiker te openen. Hiermee kan een suite een `:memory:`-database
 * opzetten die byte-voor-byte hetzelfde schema draagt als de echte.
 */
export const SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT NOT NULL,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    postcode INTEGER NOT NULL,
    city TEXT,
    region TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    posted_at TEXT NOT NULL,
    dedupe_hash TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    score_breakdown TEXT NOT NULL DEFAULT '{}',
    job_status TEXT NOT NULL DEFAULT 'new',
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS jobs_dedupe_hash_idx ON jobs (dedupe_hash);
  CREATE INDEX IF NOT EXISTS jobs_source_external_idx ON jobs (source, external_id);

  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT NOT NULL,
    source TEXT NOT NULL,
    company_name TEXT NOT NULL,
    postcode INTEGER NOT NULL,
    region TEXT NOT NULL,
    nace_code TEXT,
    url TEXT,
    signals TEXT NOT NULL DEFAULT '[]',
    vacature_aantal INTEGER,
    design_vacatures INTEGER,
    dev_vacatures INTEGER,
    lead_score INTEGER NOT NULL DEFAULT 0,
    score_breakdown TEXT NOT NULL DEFAULT '{}',
    rechtsgrond TEXT NOT NULL DEFAULT 'gerechtvaardigd belang',
    opt_out INTEGER NOT NULL DEFAULT 0,
    dedupe_hash TEXT NOT NULL,
    lead_status TEXT NOT NULL DEFAULT 'new',
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS companies_dedupe_hash_idx ON companies (dedupe_hash);
  CREATE INDEX IF NOT EXISTS companies_source_external_idx ON companies (source, external_id);

  -- Statussen van KBO-prospects. Bewust hier en niet in kbo.db: die spiegel is
  -- wegwerpbaar en wordt bij elke --full overschreven, dus alles wat jij erover beslist
  -- zou dan mee verdwijnen. De sleutel is het ondernemingsnummer zonder punten.
  CREATE TABLE IF NOT EXISTS prospect_status (
    enterprise_number TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'new',
    -- Dezelfde rem als op companies. Zonder deze kolom zou de opt-out-controle bij het
    -- vastleggen van een contactmoment stil alleen voor leads gelden, en dat is precies
    -- een guard die compleet lijkt en het niet is.
    opt_out INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  -- Prospects uit een aangeleverde CSV: de derde herkomst, naast de vacature-leads en
  -- de KBO-spiegel. Dezelfde sleutel als prospect_status, zodat een status zonder mapping
  -- op beide bronnen slaat. De negen kolommen zijn de CSV zoals ze is; afleiden gebeurt
  -- bij het renderen, net als bij de KBO-koppeling — wat niet opgeslagen wordt, kan niet
  -- verouderen. De bedragen staan als REAL en niet als INTEGER: employee_count draagt
  -- decimalen (35.8 in het geleverde bestand) omdat het een gemiddelde over een jaar is.
  CREATE TABLE IF NOT EXISTS csv_prospects (
    enterprise_number TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nace_label TEXT,
    city TEXT,
    employee_count REAL,
    ebitda REAL,
    valuation_multiple REAL,
    enterprise_value REAL,
    equity_value REAL,
    bestandsnaam TEXT NOT NULL,
    imported_at TEXT NOT NULL
  );

  -- Sorteren op omvang is de reden dat deze bron bestaat; zonder index betaalt elke
  -- pagina een volledige scan over de tabel.
  CREATE INDEX IF NOT EXISTS csv_prospects_employee_idx ON csv_prospects (employee_count);

  -- Contactmomenten. De sleutel is bewust samengesteld en niet het ondernemingsnummer:
  -- de companies-tabel draagt geen nummer-kolom, de KBO-koppeling gebeurt bij het renderen, en
  -- daarvan zijn 12 van de 27 leads gekoppeld en 15 niet gevonden — één van die twaalf
  -- naar een tandartspraktijk. Alles op het nummer sleutelen verliest dus stil 15 leads
  -- en hangt één historiek aan het verkeerde bedrijf.
  --
  -- rechtsgrond staat op het moment zelf en niet alleen op het bedrijf: die kan later
  -- wijzigen, en een register wil weten op welke grond je tóén contacteerde.
  CREATE TABLE IF NOT EXISTS contact_moments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_type TEXT NOT NULL,
    subject_key TEXT NOT NULL,
    datum TEXT NOT NULL,
    kanaal TEXT NOT NULL,
    notitie TEXT,
    rechtsgrond TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS contact_moments_subject_idx
    ON contact_moments (subject_type, subject_key, datum DESC);

  -- Eén volgende actie per bedrijf, niet meerdere: dit veld bestaat om de lijst te
  -- sorteren, en twee open acties maken die sleutel dubbelzinnig.
  CREATE TABLE IF NOT EXISTS next_actions (
    subject_type TEXT NOT NULL,
    subject_key TEXT NOT NULL,
    datum TEXT NOT NULL,
    omschrijving TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (subject_type, subject_key)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    jobs_added INTEGER NOT NULL DEFAULT 0,
    jobs_updated INTEGER NOT NULL DEFAULT 0,
    leads_added INTEGER NOT NULL DEFAULT 0,
    leads_updated INTEGER NOT NULL DEFAULT 0,
    source_statuses TEXT NOT NULL DEFAULT '{}'
  );
`

type ColInfo = { name: string }

/** Voegt kolommen bij die van ná de eerste versie van een tabel dateren. Idempotent. */
export function pasKolomMigratiesToe(sqlite: {
  prepare(sql: string): { all(): unknown[] }
  exec(sql: string): unknown
}): void {
  const kolommen = (tabel: string) =>
    (sqlite.prepare(`PRAGMA table_info(${tabel})`).all() as ColInfo[]).map((c) => c.name)

  const jobCols = kolommen('jobs')
  if (!jobCols.includes('job_status')) {
    sqlite.exec("ALTER TABLE jobs ADD COLUMN job_status TEXT NOT NULL DEFAULT 'new'")
  }
  if (!jobCols.includes('city')) {
    sqlite.exec('ALTER TABLE jobs ADD COLUMN city TEXT')
  }

  const companyCols = kolommen('companies')
  if (!companyCols.includes('lead_status')) {
    sqlite.exec("ALTER TABLE companies ADD COLUMN lead_status TEXT NOT NULL DEFAULT 'new'")
  }
  for (const kolom of ['vacature_aantal', 'design_vacatures', 'dev_vacatures']) {
    if (!companyCols.includes(kolom)) sqlite.exec(`ALTER TABLE companies ADD COLUMN ${kolom} INTEGER`)
  }

  // `prospect_status` bestond vóór deze kolom, dus een bestaande database krijgt hem hier.
  const prospectCols = kolommen('prospect_status')
  if (prospectCols.length && !prospectCols.includes('opt_out')) {
    sqlite.exec('ALTER TABLE prospect_status ADD COLUMN opt_out INTEGER NOT NULL DEFAULT 0')
  }
}
