#!/bin/bash
#
# Voert de opvolging-routes uit tegen een VERSE database — nooit tegen .data/jobradar.db.
#
# Waarom een script en geen scenario-suite: deze routes hebben een draaiende server nodig,
# en de scenario-suites draaien per constructie zonder netwerk. Waarom gecommitteerd en niet
# ad hoc: het Verify-pad van deze app had geen request/response-instrument, en een meting
# die alleen in een sessie bestond is geen instrument maar een herinnering.
#
# Hij bouwt in .next-apiprobe (via NEXT_DIST_DIR) en ruimt die map op, dus hij raakt .next
# van de dev-server niet. Poort 3117, database in de meegegeven map.
#
# Gebruik: pnpm --filter jobradar opvolging:probe <werkmap>
#
set -uo pipefail

# Het app-anker uit de scriptlocatie, niet uit cwd en niet hardcoded: een absoluut pad naar
# één worktree overleeft die worktree niet.
APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SP="${1:-}"
if [ -z "$SP" ]; then
  echo "Geef een werkmap mee: pnpm --filter jobradar opvolging:probe /tmp/werkmap" >&2
  exit 2
fi
mkdir -p "$SP"
PORT=3117
DB="$SP/api.db"
rm -f "$DB" "$DB-wal" "$DB-shm"

# Twee leads: één normaal, één afgemeld. Plus één op dismissed.
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import "$APP/scripts/ts-resolve.mjs" --input-type=module -e "
import Database from 'better-sqlite3'
import { SCHEMA_DDL, pasKolomMigratiesToe } from '$APP/lib/db/ddl.ts'
const db = new Database('$DB'); db.exec(SCHEMA_DDL); pasKolomMigratiesToe(db)
const ins = db.prepare(\`INSERT INTO companies
 (id, external_id, source, company_name, postcode, region, dedupe_hash, lead_status, opt_out, rechtsgrond, first_seen_at, last_seen_at)
 VALUES (?,?,'test',?,8000,'WVL',?,?,?,'gerechtvaardigd belang','x','x')\`)
ins.run(1,'a','Normaal NV','h1','new',0)
ins.run(2,'b','Afgemeld NV','h2','new',1)
ins.run(3,'c','Afgewezen NV','h3','dismissed',0)
db.prepare(\"INSERT INTO prospect_status (enterprise_number,status,opt_out,updated_at) VALUES ('0747501103','saved',0,'x')\").run()
db.close(); console.log('fixture klaar')
" 2>&1 | grep -v Warning

# Weiger te starten wanneer er al iets luistert. Zonder deze rem sprak run 2 van dit script
# met de achtergebleven server van run 1 — en dus met de database van run 1. De uitkomsten
# waren gevuld en geloofwaardig en gingen over het verkeerde bestand (gemeten 2026-09-09).
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✗ Poort $PORT is bezet. Dit script mag geen draaiend proces overnemen — dan meet het" >&2
  echo "  een andere server en een andere database. Stop dat proces eerst." >&2
  exit 2
fi

export NEXT_DIST_DIR=.next-apiprobe JOBRADAR_DB_PATH="$DB"
(cd "$APP" && npx next build >/dev/null 2>&1) || { echo "BUILD FAALT"; exit 1; }

# `setsid` geeft de server zijn eigen procesgroep, zodat de opruiming ook het echte
# Next-proces raakt en niet alleen de npx-wrapper erboven — dát liet de wees achter.
(cd "$APP" && exec npx next start --port $PORT >/dev/null 2>&1) &
SRV=$!
opruimen() {
  kill "$SRV" 2>/dev/null
  # Alles wat nog op de poort luistert hoort bij ons; laat geen wees achter.
  for pid in $(lsof -t -nP -iTCP:$PORT -sTCP:LISTEN 2>/dev/null); do kill "$pid" 2>/dev/null; done
  wait "$SRV" 2>/dev/null
  rm -rf "$APP/.next-apiprobe"
}
trap opruimen EXIT

for i in $(seq 1 40); do curl -sf "http://127.0.0.1:$PORT/api/opvolging?type=lead&key=1" >/dev/null 2>&1 && break; sleep 1; done

# POSITIEVE CONTROLE vóór de eerste meting: spreken we met ónze server en ónze database?
# Een verse database heeft nul momenten. Staat er iets, dan praat dit script met iets anders
# en is elke uitkomst hieronder een uitspraak over het verkeerde bestand.
start=$(curl -s "http://127.0.0.1:$PORT/api/opvolging?type=lead&key=1" | node -e "
  try { console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).momenten.length) } catch { console.log('?') }")
if [ "$start" != "0" ]; then
  echo "✗ De server op $PORT meldt $start momenten op een verse database — dit is niet onze server." >&2
  exit 2
fi
echo "0. positieve controle: verse database, 0 momenten                 ok"

B="http://127.0.0.1:$PORT"
p() { printf '%-52s %s\n' "$1" "$2"; }
post() { curl -s -o /tmp/body -w '%{http_code}' -X POST "$B/api/opvolging" -H 'content-type: application/json' -d "$1"; }
q() { node -e "const d=require('fs').readFileSync('/tmp/body','utf8');try{const j=JSON.parse(d);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],j))}catch{console.log(d.slice(0,60))}" "$1"; }
tel() { sqlite3 "$DB" "$1"; }

p "1. contactmoment op een normale lead"      "$(post '{"type":"lead","key":"1","datum":"2026-09-08","kanaal":"mail","notitie":"gebeld"}')  status=$(q status)"
p "   rijen in contact_moments"               "$(tel 'SELECT count(*) FROM contact_moments;')"
p "   rechtsgrond op de rij"                  "$(tel 'SELECT rechtsgrond FROM contact_moments LIMIT 1;')"
p "   lead_status van lead 1"                 "$(tel 'SELECT lead_status FROM companies WHERE id=1;')"
p "2. tweede moment zelfde dag"               "$(post '{"type":"lead","key":"1","datum":"2026-09-08","kanaal":"telefoon"}')  rijen=$(tel 'SELECT count(*) FROM contact_moments;')"
p "3. afgemeld bedrijf (verwacht 409)"        "$(post '{"type":"lead","key":"2","datum":"2026-09-08","kanaal":"mail"}')  reden=$(q error)"
p "   rijen ongewijzigd"                      "$(tel 'SELECT count(*) FROM contact_moments;')"
p "4. dismissed lead behoudt zijn status"     "$(post '{"type":"lead","key":"3","datum":"2026-09-08","kanaal":"mail"}')  status=$(q status)  db=$(tel 'SELECT lead_status FROM companies WHERE id=3;')"
p "5. datum in de toekomst (verwacht 400)"    "$(post '{"type":"lead","key":"1","datum":"2027-01-01","kanaal":"mail"}')  reden=$(q error)"
p "6. onbekend kanaal (verwacht 400)"         "$(post '{"type":"lead","key":"1","datum":"2026-09-08","kanaal":"post"}')  reden=$(q error)"
p "7. onbekende lead (verwacht 404)"          "$(post '{"type":"lead","key":"999","datum":"2026-09-08","kanaal":"mail"}')"
p "8. prospect op ondernemingsnummer"         "$(post '{"type":"prospect","key":"0747501103","datum":"2026-09-08","kanaal":"linkedin"}')  status=$(q status)"
p "   prospect_status bijgewerkt"             "$(tel "SELECT status FROM prospect_status WHERE enterprise_number='0747501103';")"
p "9. lead 1 en prospect delen geen historiek" "$(tel 'SELECT group_concat(subject_type||":"||subject_key) FROM contact_moments;')"
curl -s -X PUT "$B/api/opvolging/actie" -H 'content-type: application/json' -d '{"type":"lead","key":"1","datum":"2026-10-01","omschrijving":"bellen"}' >/dev/null
curl -s -X PUT "$B/api/opvolging/actie" -H 'content-type: application/json' -d '{"type":"lead","key":"1","datum":"2026-11-01","omschrijving":"mailen"}' >/dev/null
p "10. één volgende actie, nieuwste wint"     "$(tel "SELECT count(*)||' × '||group_concat(omschrijving) FROM next_actions;")"
ID=$(tel 'SELECT min(id) FROM contact_moments;')
p "11. moment verwijderen"                    "$(curl -s -o /tmp/body -w '%{http_code}' -X DELETE "$B/api/opvolging/moment/$ID")  rijen=$(tel 'SELECT count(*) FROM contact_moments;')  status=$(tel 'SELECT lead_status FROM companies WHERE id=1;')"
p "12. GET historiek van lead 1"              "$(curl -s "$B/api/opvolging?type=lead&key=1" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log('momenten='+j.momenten.length,'actie='+j.actie?.omschrijving,'optOut='+j.optOut)")"
echo "PROBE KLAAR"
