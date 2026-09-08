#!/bin/bash

# sync-os.sh — synct umanex-os naar de huidige klant-repo
# Plaats dit script in <klant-repo>/scripts/sync-os.sh — dit script is identiek in elke
# klant-repo; niets per klant aanpassen.
#
# Het klant-profiel wordt NIET in dit script gezet, maar gelezen uit de repo zelf:
#   .umanex-os/profile  → één woord, de klantnaam (bv. umanex, columba, luminus).
# Zo blijft het script overal byte-identiek en kan een verkeerde kopie nooit stil het
# verkeerde profiel pakken — ontbreekt de marker, dan stopt de sync met een melding.
#
# Wat dit script synct:
# - .umanex-os/CLAUDE.md          (globale werkprincipes)
# - .umanex-os/profiles/{X}.md     (klant-specifiek profile)
# - .claude/skills/<naam>          (globale skills uit umanex-os/.claude/skills/, project-level
#                                   discovery — reist mee met de repo, dus ook naar CI en cloud)
# - .claude/agents/<naam>.md       (subagent-definities met tool-beperking, zelfde regime)
# - ~/.claude/hooks/tcebc-reminder.sh + settings.json  (TC-EBC UserPromptSubmit hook, user-level)
# - ~/.claude/hooks/session-start-handoff.sh + settings.json  (SessionStart handoff-hook, user-level)
# - ~/.claude/hooks/askquestion-estimate-guard.sh + settings.json  (PreToolUse schatting-guard, user-level)
# - ~/.claude/hooks/bron-assertie-guard.sh + settings.json          (PreToolUse bron-guard, user-level)
# - ~/.claude/hooks/acceptatie-guard.sh + settings.json             (PreToolUse acceptatie-guard, user-level)
# - ~/.claude/hooks/meting-guard.sh + settings.json                 (PreToolUse meting-guard, user-level)
# - ~/.claude/hooks/nulmeting-guard.sh + settings.json              (PostToolUse nulmeting-guard, user-level)
# - ~/.claude/hooks/identifier-bron-guard.sh + settings.json        (PreToolUse identifier-guard, user-level)
# - ~/.claude/hooks/tegenspraak-guard.sh + settings.json            (PostToolUse tegenspraak-guard, user-level)
# - LEARNINGS.md                   (capture-staging in root + elke app, geseed als afwezig — nooit overschreven)
# - HANDOFF.md                     (sessie-handoff in root + elke app, geseed als afwezig — nooit overschreven)
# - BACKLOG.md                     (gemeld-niet-gebouwd in root + elke app, geseed als afwezig — nooit overschreven)
# - scripts/gen-snapshot.sh + .githooks/pre-commit   (context-snapshots, incl. core.hooksPath-activatie)
# - scripts/refs-check.mjs        (PR-verwijzingen: gekwalificeerd en bestaand — CI-check)
# - .githooks/commit-msg           (commit-scope guard: een app-scope mag geen andere app raken)
#
# SKILLS ZIJN REPO-BESTANDEN, GEEN USER-LEVEL KOPIEËN. Tot 2026-08-17 stonden de globale
# skills in ~/.claude/skills/ — het enige laag-onderdeel dat niet via git reisde. Gevolg:
# handmatige sync per machine, geen drift-signaal, en cloud-/CI-agents zagen niets. Nu
# staan ze in <repo>/.claude/skills/ en reizen ze met elke checkout mee. GEMETEN
# (2026-08-17, verse headless sessies): project-level discovery werkt, maar bij een
# naamconflict wint de USER-LEVEL kopie — precies andersom dan dit script eerder beweerde.
# Een achtergebleven user-level kopie MASKEERT dus de repo-versie; daarom ruimt dit script
# de beheerde namen uit ~/.claude/skills/ op, in beide modi.
#
# Welke namen "beheerd" zijn staat per klant-repo in .claude/skills/.umanex-managed —
# geschreven door deze sync en door de CI-receiver. Alles buiten die lijst is een
# klant-eigen skill en wordt nooit aangeraakt.
#
# ZELF-MODUS. Draait dit script in umanex-os zelf (scripts/sync-os.sh is daar een symlink
# naar templates/sync-os.sh), dan slaat het over wat alleen voor een klant zinvol is — de
# `.umanex-os/`-kopie van de laag, het profiel, de marker, het snapshot-systeem en de
# commit-scope guard, die allemaal een klant-repo of `apps/` veronderstellen — én de
# skill-kopie: de bron heeft zijn skills al live in zijn eigen .claude/skills/. Wat wél
# draait: de branch-guard (als symlink, geen kopie), de user-level hooks, de seeds en de
# user-level skill-opruiming.

set -uo pipefail

# Pad naar de lokale umanex-os checkout (per machine; standaard onder ~/Documents).
UMANEX_OS_PATH="$HOME/Documents/umanex-os"

# Bepaal waar dit script staat en ga naar de klant-repo root.
#
# Deze twee afleidingen worden hard geguard, want dit script is het gevaarlijkste van de
# set: het doet verderop `rm -rf .umanex-os/skills`, `mkdir -p`, en `git config
# core.hooksPath` — allemaal relatief aan CLIENT_ROOT. Faalt de afleiding, dan wordt
# SCRIPT_DIR leeg, lost `$SCRIPT_DIR/..` op naar `/`, en slaagt de `cd` daarnaartoe gewoon.
# Die stappen draaien dan op je filesystem-root in plaats van in een repo.
#
# `set -e` is bewust niet de fix: dit script blijft doorlopen na een ontbrekend optioneel
# bestand (een profiel dat er niet is, jq dat ontbreekt) en meldt dat als waarschuwing.
die() { echo "✗ $1" >&2; exit 1; }

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" 2>/dev/null && pwd )" \
  || die "kan de map van dit script niet bepalen vanaf ${BASH_SOURCE[0]}"
CLIENT_ROOT="$( cd "$SCRIPT_DIR/.." 2>/dev/null && pwd )" \
  || die "kan de repo-root niet bepalen vanaf $SCRIPT_DIR"
[ -n "$CLIENT_ROOT" ] && [ "$CLIENT_ROOT" != "/" ] \
  || die "repo-root loste op naar '$CLIENT_ROOT' — dat kan geen repo zijn"
[ -d "$CLIENT_ROOT/.git" ] || [ -f "$CLIENT_ROOT/.git" ] \
  || die "'$CLIENT_ROOT' is geen git-repo — sync-os.sh hoort in <repo>/scripts/ te staan"

# ── --refresh-headers ─────────────────────────────────────────────────────────
# Vervangt in élke HANDOFF.md van deze repo het blok BÓVEN de eerste laag-header
# door de canonieke kop uit de template, en laat de entries ongemoeid. Bestaat om
# één reden: seeding overschrijft nooit, dus een HANDOFF.md die vóór 2026-08-10 is
# aangemaakt legt nog het oude entry-formaat uit — zonder `Check`-veld en zonder de
# sectie *Schrijf de check, niet de staat*. De regel bereikt die repo's wél via de
# skill en de globale laag, maar de kop spreekt hem tegen, en dat is de vorm waarin
# een verouderde uitleg schade doet: hij oogt gezaghebbend.
#
# Aparte modus, geen stap in de gewone sync: dit herschrijft bestanden die de sync
# juist met rust hoort te laten, en dat hoort een expliciete keuze te zijn.
refresh_handoff_headers() {
  TPL="$UMANEX_OS_PATH/templates/HANDOFF.template.md"
  [ -f "$TPL" ] || die "template ontbreekt: $TPL"
  KOP="$(awk '/^# Globaal|^# Klant|^# Project/{exit} {print}' "$TPL")"
  [ -n "$KOP" ] || die "kon geen kop uit de template lezen"
  n=0; ongemoeid=0
  echo "→ HANDOFF-koppen verversen in $CLIENT_ROOT"
  while IFS= read -r f; do
    # De kop eindigt bij de eerste laag-header OF bij de eerste entry. Die tweede
    # grens is niet theoretisch: `columba/HANDOFF.md` draagt twee entries zonder ooit
    # een laag-header gekregen te hebben (gemeten 2026-08-27), en een eerste versie van
    # deze functie sloeg hem daardoor over — precies het bestand dat het item bedoelde.
    # Zonder beide grenzen valt zo'n bestand tussen wal en schip.
    if grep -qE '^# (Globaal|Klant|Project)' "$f"; then
      REST="$(awk '/^# Globaal|^# Klant|^# Project/{f=1} f' "$f")"
    elif grep -qE '^## [0-9]{4}-[0-9]{2}-[0-9]{2}' "$f"; then
      REST="$(awk '/^## [0-9]{4}-[0-9]{2}-[0-9]{2}/{f=1} f' "$f")"
    else
      # Echt niets te scheiden: een vers geseed of leeg bestand. Afblijven in plaats
      # van gokken — er is geen entry die verloren kan gaan, maar ook niets te winnen.
      echo "  • ${f#$CLIENT_ROOT/} — geen entries, ongemoeid"
      ongemoeid=$((ongemoeid + 1)); continue
    fi
    OUD="$(cat "$f")"
    printf '%s\n%s\n' "$KOP" "$REST" > "$f.tmp" && mv "$f.tmp" "$f"
    if [ "$OUD" = "$(cat "$f")" ]; then
      echo "  • ${f#$CLIENT_ROOT/} — al canoniek"
    else
      echo "  ✓ ${f#$CLIENT_ROOT/}"; n=$((n + 1))
    fi
  done <<EOF
$(find "$CLIENT_ROOT" -name HANDOFF.md -not -path '*/node_modules/*' -not -path '*/.claude/worktrees/*' | sort)
EOF
  echo "  → $n bijgewerkt, $ongemoeid ongemoeid gelaten"
}

if [ "${1:-}" = "--refresh-headers" ]; then
  refresh_handoff_headers
  exit 0
fi

# Zelf-modus: draait dit script in umanex-os zelf?
#
# Tot 2026-08-08 kon dat niet. Alles wat umanex-os uitrolt bereikte een klant-repo via
# dit script of de CI-receiver, en géén van beide had de bronrepo als doelwit: het script
# stopte hier op de ontbrekende profiel-marker, de dispatcher stuurt naar de drie klanten.
# Gevolg: élk universeel toepasbaar onderdeel moest in umanex-os met de hand, en pas nadat
# iemand het gat toevallig opmerkte — de branch-guard ontbrak er maanden, HANDOFF.md ook.
#
# In zelf-modus slaat het script over wat alleen voor een klant zinvol is (de `.umanex-os/`
# kopie van de laag, het profiel, de marker, het snapshot-systeem dat `apps/` veronderstelt,
# en de skill-kopie — de bron heeft zijn skills al live in .claude/skills/) en installeert
# het wél alles wat universeel geldt: de branch-guard, de user-level hooks en de
# staging-bestanden. De bron krijgt zo nooit een kopie van zichzelf.
# `-ef` vergelijkt device+inode, geen tekst. Dat is hier nodig: op een hoofdletter-
# ongevoelig macOS-bestandssysteem leveren `~/Documents/...` en `~/documents/...` dezelfde
# map maar verschillende strings op, en dan zou zelf-modus stil niet aanslaan. Het dekt
# meteen ook symlinks en een afsluitende slash af.
SELF_MODE=0
if [ -d "$UMANEX_OS_PATH" ] && [ "$CLIENT_ROOT" -ef "$UMANEX_OS_PATH" ]; then
  SELF_MODE=1
fi

if [ "$SELF_MODE" -eq 1 ]; then
  CLIENT_PROFILE=""
  echo "→ Sync umanex-os naar zichzelf (zelf-modus)"
  echo "  Geen profiel, geen .umanex-os/-laag — alleen wat universeel geldt."
  echo ""
else
  # Lees het klant-profiel uit de marker in de repo zelf — geen hardcoded default.
  PROFILE_MARKER="$CLIENT_ROOT/.umanex-os/profile"
  if [ ! -f "$PROFILE_MARKER" ]; then
    echo "✗ Geen profiel-marker gevonden op .umanex-os/profile"
    echo "  Maak hem aan met de klantnaam, bv.:  mkdir -p .umanex-os && echo umanex > .umanex-os/profile"
    exit 1
  fi
  CLIENT_PROFILE="$(tr -d '[:space:]' < "$PROFILE_MARKER")"
  if [ -z "$CLIENT_PROFILE" ]; then
    echo "✗ Profiel-marker .umanex-os/profile is leeg — vul de klantnaam in."
    exit 1
  fi

  echo "→ Sync umanex-os naar $(basename "$CLIENT_ROOT")"
  echo "  Profile: $CLIENT_PROFILE (uit .umanex-os/profile)"
  echo ""
fi

# Check of umanex-os lokaal staat
if [ ! -d "$UMANEX_OS_PATH" ]; then
  echo "✗ umanex-os niet gevonden op $UMANEX_OS_PATH"
  echo "  Pas UMANEX_OS_PATH aan bovenaan dit script."
  exit 1
fi

# Vereis dat umanex-os op main staat. Sync leest de working tree van umanex-os; staat die
# op een feature-branch, dan zou stale of half-afgewerkte content stilletjes propageren.
# Alleen gemergede main-content is bron-van-waarheid — dus weigeren als het niet main is.
OS_BRANCH="$(git -C "$UMANEX_OS_PATH" rev-parse --abbrev-ref HEAD 2>/dev/null)"
if [ "$OS_BRANCH" != "main" ]; then
  echo "✗ umanex-os staat op '$OS_BRANCH', niet op main."
  echo "  Sync propageert alleen gemergede main-content. Checkout main in umanex-os:"
  echo "    git -C \"$UMANEX_OS_PATH\" checkout main"
  echo "  en draai daarna opnieuw."
  exit 1
fi

# Pull laatste versie van umanex-os main — non-fataal: zonder netwerk synct het script
# gewoon de lokale (mogelijk al actuele) versie i.p.v. volledig af te breken.
echo "→ Pull laatste versie van main uit GitHub..."
if git -C "$UMANEX_OS_PATH" pull --quiet origin main 2>/dev/null; then
  echo "  ✓ umanex-os up-to-date"
else
  echo "  ⚠ git pull mislukt (offline of geen toegang) — verder met lokale versie"
fi
echo ""

cd "$CLIENT_ROOT"

if [ "$SELF_MODE" -eq 1 ]; then
  # De bron is de laag; een kopie ervan in .umanex-os/ zou een tweede waarheid zijn.
  echo "→ Globale laag overgeslagen (dit ís de bron)"
  echo ""
else
  # Maak doel-folders in klant-repo
  mkdir -p .umanex-os/profiles

  # Kopieer globale CLAUDE.md
  echo "→ Kopieer globale CLAUDE.md..."
  cp "$UMANEX_OS_PATH/CLAUDE.md" ".umanex-os/CLAUDE.md"
  echo "  ✓ .umanex-os/CLAUDE.md"

  # Kopieer enkel het juiste profile
  echo "→ Kopieer profile: $CLIENT_PROFILE..."
  if [ -f "$UMANEX_OS_PATH/profiles/$CLIENT_PROFILE.md" ]; then
    cp "$UMANEX_OS_PATH/profiles/$CLIENT_PROFILE.md" ".umanex-os/profiles/$CLIENT_PROFILE.md"
    echo "  ✓ .umanex-os/profiles/$CLIENT_PROFILE.md"
  else
    echo "  ⚠ Profile $CLIENT_PROFILE.md niet gevonden in umanex-os/profiles/"
  fi
fi

# Seed een leeg LEARNINGS.md in de klant-repo root én in elke app (apps/*) als die er
# nog niet is. LEARNINGS.md is een staging-bestand met repo-eigen entries — dus NOOIT
# overschrijven: bestaat het al, dan blijft het ongemoeid. De vastleggen skill voegt de
# laag-header (# Klant — <profile> resp. # Project — <app>) en entries toe bij de eerste capture.
LEARNINGS_TEMPLATE="$UMANEX_OS_PATH/templates/LEARNINGS.template.md"

seed_learnings() {
  # $1 = doelmap; seedt $1/LEARNINGS.md alleen als die nog niet bestaat
  local target="$1/LEARNINGS.md"
  if [ -f "$target" ]; then
    echo "  • $target bestaat al — ongemoeid gelaten"
  else
    cp "$LEARNINGS_TEMPLATE" "$target"
    echo "  ✓ $target aangemaakt uit template"
  fi
}

echo ""
echo "→ Seed LEARNINGS.md (root + elke app, alleen als afwezig)..."
if [ ! -f "$LEARNINGS_TEMPLATE" ]; then
  echo "  ⚠ templates/LEARNINGS.template.md niet gevonden — seed overgeslagen"
else
  seed_learnings "."
  if [ -d "apps" ]; then
    for app_dir in apps/*/; do
      [ -d "$app_dir" ] || continue          # geen match → overslaan
      seed_learnings "${app_dir%/}"
    done
  fi
fi

# Seed HANDOFF.md (root + elke app) — vooruitkijkende tegenhanger van LEARNINGS.md,
# gevuld door de sessie-reflectie skill en getoond bij sessiestart via de handoff-hook.
# Zelfde regel: repo-eigen staging, dus NOOIT overschrijven.
HANDOFF_TEMPLATE="$UMANEX_OS_PATH/templates/HANDOFF.template.md"

seed_handoff() {
  # $1 = doelmap; seedt $1/HANDOFF.md alleen als die nog niet bestaat
  local target="$1/HANDOFF.md"
  if [ -f "$target" ]; then
    echo "  • $target bestaat al — ongemoeid gelaten"
  else
    cp "$HANDOFF_TEMPLATE" "$target"
    echo "  ✓ $target aangemaakt uit template"
  fi
}

echo ""
echo "→ Seed HANDOFF.md (root + elke app, alleen als afwezig)..."
if [ ! -f "$HANDOFF_TEMPLATE" ]; then
  echo "  ⚠ templates/HANDOFF.template.md niet gevonden — seed overgeslagen"
else
  seed_handoff "."
  if [ -d "apps" ]; then
    for app_dir in apps/*/; do
      [ -d "$app_dir" ] || continue          # geen match → overslaan
      seed_handoff "${app_dir%/}"
    done
  fi
fi

# Seed BACKLOG.md (root + elke app) — het derde staging-bestand. LEARNINGS is terugkijkend
# (waargenomen fouten), HANDOFF sessie-gebonden (context voor de volgende sessie), BACKLOG
# duurzaam: werk dat benoemd is maar niet gebouwd, plus de P3's uit de audit-skills. Zelfde
# regel als de andere twee: repo-eigen staging, dus NOOIT overschrijven.
BACKLOG_TEMPLATE="$UMANEX_OS_PATH/templates/BACKLOG.template.md"

seed_backlog() {
  # $1 = doelmap; seedt $1/BACKLOG.md alleen als die nog niet bestaat
  local target="$1/BACKLOG.md"
  if [ -f "$target" ]; then
    echo "  • $target bestaat al — ongemoeid gelaten"
  else
    cp "$BACKLOG_TEMPLATE" "$target"
    echo "  ✓ $target aangemaakt uit template"
  fi
}

echo ""
echo "→ Seed BACKLOG.md (root + elke app, alleen als afwezig)..."
if [ ! -f "$BACKLOG_TEMPLATE" ]; then
  echo "  ⚠ templates/BACKLOG.template.md niet gevonden — seed overgeslagen"
else
  seed_backlog "."
  if [ -d "apps" ]; then
    for app_dir in apps/*/; do
      [ -d "$app_dir" ] || continue          # geen match → overslaan
      seed_backlog "${app_dir%/}"
    done
  fi
fi

# Verwijder oude in-repo skills folder als die er nog staat (legacy van vorige versie)
if [ -d ".umanex-os/skills" ]; then
  echo "→ Oude .umanex-os/skills/ folder gevonden — opruimen..."
  rm -rf ".umanex-os/skills"
  echo "  ✓ Verwijderd. Globale skills staan nu in <repo>/.claude/skills/"
fi

# ── Skills: repo-bestanden met project-level discovery ──
#
# Bron: umanex-os/.claude/skills/. Doel in klant-modus: <klant-repo>/.claude/skills/ —
# dezelfde bestanden die de CI-sync levert; dit is enkel de lokale versneller. In
# zelf-modus is er niets te kopiëren: de bron ís zijn eigen .claude/skills/.
#
# Het manifest .claude/skills/.umanex-managed somt de beheerde namen op. Alleen die
# namen worden vervangen of (als wees) opgeruimd; elke andere map is een klant-eigen
# skill en blijft ongemoeid. Zonder manifest (eerste sync) wordt alleen geplaatst,
# nooit verwijderd.
OS_SKILLS="$UMANEX_OS_PATH/.claude/skills"

if [ "$SELF_MODE" -eq 0 ]; then
  echo ""
  echo "→ Sync globale skills naar .claude/skills/ (project-level)..."
  if [ -d "$OS_SKILLS" ]; then
    mkdir -p ".claude/skills"
    MANIFEST=".claude/skills/.umanex-managed"
    old_managed=""
    [ -f "$MANIFEST" ] && old_managed="$(cat "$MANIFEST")"

    synced=0
    new_managed=""
    for skill_dir in "$OS_SKILLS"/*/; do
      [ -d "$skill_dir" ] || continue          # geen match → overslaan
      name="$(basename "$skill_dir")"
      [ -n "$name" ] || continue               # defensief: nooit een lege naam verwijderen
      rm -rf "./.claude/skills/${name:?}"      # schoon vervangen; :? voorkomt rm op lege var
      cp -R "$skill_dir" ".claude/skills/$name"
      find ".claude/skills/$name" -name .DS_Store -delete 2>/dev/null
      new_managed="$new_managed$name
"
      echo "  ✓ $name"
      synced=$((synced + 1))
    done
    printf '%s' "$new_managed" > "$MANIFEST"
    [ "$synced" -eq 0 ] && echo "  (geen globale skills gevonden in umanex-os/.claude/skills/)"

    # Wezen: namen uit het vórige manifest die niet meer in de bron staan. Alleen die —
    # een hernoemde skill zou anders eeuwig blijven vuren met bevroren instructies,
    # maar een klant-eigen skill (nooit in een manifest) mag hier niet sneuvelen.
    if [ -n "$old_managed" ]; then
      for tname in $old_managed; do
        [ -n "$tname" ] || continue
        [ -d "$OS_SKILLS/$tname" ] && continue           # bestaat nog in de bron
        [ -d ".claude/skills/$tname" ] || continue        # al weg
        rm -rf "./.claude/skills/${tname:?}"
        echo "  ✓ wees '$tname' verwijderd (stond in het manifest, niet meer in de bron)"
      done
    fi
  else
    echo "  ⚠ Geen umanex-os/.claude/skills/ folder gevonden — skill-sync overgeslagen"
  fi

  # Agents: platte .md-definities, zelfde manifest-regime als skills. Klant-eigen
  # agents (namen buiten het manifest) blijven onaantastbaar.
  OS_AGENTS="$UMANEX_OS_PATH/.claude/agents"
  if [ -d "$OS_AGENTS" ]; then
    echo ""
    echo "→ Sync globale agents naar .claude/agents/ (project-level)..."
    mkdir -p ".claude/agents"
    A_MANIFEST=".claude/agents/.umanex-managed"
    a_old=""
    [ -f "$A_MANIFEST" ] && a_old="$(cat "$A_MANIFEST")"
    : > "$A_MANIFEST.new"
    for f in "$OS_AGENTS"/*.md; do
      [ -f "$f" ] || continue
      aname="$(basename "$f")"
      [ -n "$aname" ] || continue
      cp "$f" ".claude/agents/$aname"
      printf '%s\n' "$aname" >> "$A_MANIFEST.new"
      echo "  ✓ $aname"
    done
    mv "$A_MANIFEST.new" "$A_MANIFEST"
    if [ -n "$a_old" ]; then
      for tname in $a_old; do
        [ -n "$tname" ] || continue
        [ -f "$OS_AGENTS/$tname" ] && continue
        [ -f ".claude/agents/$tname" ] || continue
        rm -f "./.claude/agents/${tname:?}"
        echo "  ✓ agent-wees '$tname' verwijderd"
      done
    fi
  fi
fi

# User-level agents-opruiming — zelfde maskering-voorzorg als bij skills: een beheerde
# naam onder ~/.claude/agents/ hoort daar nooit; de repo-versie is de waarheid.
OS_AGENTS="$UMANEX_OS_PATH/.claude/agents"
if [ -d "$OS_AGENTS" ] && [ -d "$HOME/.claude/agents" ]; then
  for f in "$OS_AGENTS"/*.md; do
    [ -f "$f" ] || continue
    aname="$(basename "$f")"
    if [ -f "$HOME/.claude/agents/$aname" ]; then
      rm -f "$HOME/.claude/agents/${aname:?}"
      echo "  ✓ user-level agent $aname verwijderd (repo-versie geldt)"
    fi
  done
fi

# User-level opruiming — in béide modi. GEMETEN 2026-08-17: bij een naamconflict wint de
# user-level kopie van de project-level versie. Een beheerde naam die nog in
# ~/.claude/skills/ staat maskeert dus de repo-versie op deze machine — inclusief elke
# toekomstige update die via git binnenkomt. Alleen de namen uit de bron worden
# verwijderd; eigen user-level skills blijven staan.
echo ""
echo "→ Ruim beheerde skills op uit ~/.claude/skills/ (user-level maskeert project-level)..."
USER_SKILLS="$HOME/.claude/skills"
removed=0
if [ -d "$OS_SKILLS" ] && [ -d "$USER_SKILLS" ]; then
  for skill_dir in "$OS_SKILLS"/*/; do
    [ -d "$skill_dir" ] || continue
    name="$(basename "$skill_dir")"
    [ -n "$name" ] || continue
    if [ -d "$USER_SKILLS/$name" ]; then
      rm -rf "${USER_SKILLS:?}/$name"
      echo "  ✓ $name verwijderd (repo-versie in .claude/skills/ geldt nu)"
      removed=$((removed + 1))
    fi
  done
fi
[ "$removed" -eq 0 ] && echo "  • niets op te ruimen"

# Context-snapshot systeem: generieke generator + dependency-vrije git hook.
# Snapshots zijn commit-time tooling (lokaal), dus dit rijdt mee met de lokale sync,
# niet met de CI-laag. De hook wordt geactiveerd via core.hooksPath=.githooks.
echo ""
echo "→ Installeer context-snapshot systeem..."
GEN_SNAPSHOT="$UMANEX_OS_PATH/templates/gen-snapshot.sh"
GITHOOK="$UMANEX_OS_PATH/templates/githooks-pre-commit"
CONTEXT_TEMPLATE="$UMANEX_OS_PATH/templates/context.json.template"
TOKEN_COVERAGE="$UMANEX_OS_PATH/templates/figma-token-coverage.mjs"
REFS_CHECK="$UMANEX_OS_PATH/templates/refs-check.mjs"

if [ "$SELF_MODE" -eq 1 ]; then
  # In de bron is een kópie van de hook een tweede waarheid die wegdrijft van het
  # origineel; een symlink kan dat per definitie niet. Git voert een gesymlinkte hook
  # gewoon uit. Alleen pre-commit: commit-msg scheidt app-scopes en umanex-os heeft
  # geen apps/, dus die zou hier dood gewicht zijn. Idem voor het snapshot-systeem
  # en context.json — die veronderstellen allebei apps/.
  mkdir -p .githooks
  if [ -L .githooks/pre-commit ] || [ ! -e .githooks/pre-commit ]; then
    ln -sfn ../templates/githooks-pre-commit .githooks/pre-commit
    echo "  ✓ .githooks/pre-commit → templates/githooks-pre-commit (symlink)"
  else
    echo "  ⚠ .githooks/pre-commit is een echt bestand, geen symlink — ongemoeid gelaten"
  fi
  git config core.hooksPath .githooks
  echo "  ✓ core.hooksPath = .githooks"
  echo "  • snapshot-systeem en context.json overgeslagen (geen apps/ in de bron)"
else
  if [ -f "$GEN_SNAPSHOT" ]; then
    mkdir -p scripts
    cp "$GEN_SNAPSHOT" scripts/gen-snapshot.sh
    chmod +x scripts/gen-snapshot.sh
    echo "  ✓ scripts/gen-snapshot.sh"
  else
    echo "  ⚠ templates/gen-snapshot.sh niet gevonden — overgeslagen"
  fi

  # Token-dekkingscheck: toetst of elke Figma-variabele een tegenhanger heeft in
  # tokens.json. Config-vrij over de klant-tokenvormen heen, dus één kopie volstaat.
  if [ -f "$TOKEN_COVERAGE" ]; then
    mkdir -p scripts
    cp "$TOKEN_COVERAGE" scripts/figma-token-coverage.mjs
    chmod +x scripts/figma-token-coverage.mjs
    echo "  ✓ scripts/figma-token-coverage.mjs"
  else
    echo "  ⚠ templates/figma-token-coverage.mjs niet gevonden — overgeslagen"
  fi

  # Referentie-checker: toetst of elke PR-verwijzing in de markdown bestaat én zegt uit
  # welke repo ze komt. Draait in CI (netwerk nodig), naast de vorm-waarschuwing die de
  # pre-commit hook geeft. Config-vrij, dus één kopie volstaat over de klanten heen.
  if [ -f "$REFS_CHECK" ]; then
    mkdir -p scripts
    cp "$REFS_CHECK" scripts/refs-check.mjs
    chmod +x scripts/refs-check.mjs
    echo "  ✓ scripts/refs-check.mjs"
  else
    echo "  ⚠ templates/refs-check.mjs niet gevonden — overgeslagen"
  fi

  if [ -f "$GITHOOK" ]; then
    mkdir -p .githooks
    cp "$GITHOOK" .githooks/pre-commit
    chmod +x .githooks/pre-commit
    git config core.hooksPath .githooks
    echo "  ✓ .githooks/pre-commit (core.hooksPath gezet)"
  else
    echo "  ⚠ templates/githooks-pre-commit niet gevonden — hook overgeslagen"
  fi

  # context.json is repo-eigen input — alleen scaffolden als afwezig, nooit overschrijven.
  if [ -f "context.json" ]; then
    echo "  • context.json bestaat al — ongemoeid gelaten"
  elif [ -f "$CONTEXT_TEMPLATE" ]; then
    cp "$CONTEXT_TEMPLATE" context.json
    echo "  ✓ context.json aangemaakt uit template — vul de Figma-gegevens per app in"
  fi
fi

# Commit-scope guard: blokkeert een commit met een app-scope die een ándere app raakt.
# Zero-config (leest apps/* van schijf) en rijdt mee op dezelfde core.hooksPath als de
# pre-commit hook hierboven, dus hier alleen het bestand plaatsen.
# Het sync-script werkt ook zichzelf bij.
#
# Dit installeerde elf canonieke bestanden en nooit zichzelf. `check-client-drift.yml`
# bewaakt `scripts/sync-os.sh` wél, en het remediatie-advies daar luidt "lokaal
# scripts/sync-os.sh draaien" — een commando dat het bestand dat als drift gemeld wordt
# per definitie niet kon bijwerken. Een klant met een achtergebleven sync-script bleef
# dus achter en het wekelijkse issue bleef rood.
#
# In zelf-modus overslaan: daar ís scripts/sync-os.sh de symlink naar de template, en
# dat zou het origineel over zichzelf heen kopiëren.
#
# Let op: de nieuwe versie geldt pas vanaf de vólgende run. Bash leest het script tijdens
# uitvoering, dus jezelf halverwege vervangen is nooit veilig — daarom kopiëren we hier
# alleen en zeggen we het erbij.
if [ "$SELF_MODE" -eq 0 ]; then
  echo ""
  echo "→ Werk het sync-script zelf bij..."
  if [ ! -f "$UMANEX_OS_PATH/templates/sync-os.sh" ]; then
    echo "  ⚠ templates/sync-os.sh niet gevonden — overgeslagen"
  elif cmp -s "$UMANEX_OS_PATH/templates/sync-os.sh" "$CLIENT_ROOT/scripts/sync-os.sh"; then
    echo "  • scripts/sync-os.sh is al canoniek"
  else
    cp "$UMANEX_OS_PATH/templates/sync-os.sh" "$CLIENT_ROOT/scripts/sync-os.sh"
    chmod +x "$CLIENT_ROOT/scripts/sync-os.sh"
    echo "  ✓ scripts/sync-os.sh bijgewerkt — de nieuwe versie geldt vanaf de volgende run"
  fi
fi

echo ""
echo "→ Installeer commit-scope guard..."
COMMIT_MSG_HOOK="$UMANEX_OS_PATH/templates/githooks-commit-msg"
if [ "$SELF_MODE" -eq 1 ]; then
  echo "  • overgeslagen — de guard scheidt app-scopes en de bron heeft geen apps/"
elif [ -f "$COMMIT_MSG_HOOK" ]; then
  mkdir -p .githooks
  cp "$COMMIT_MSG_HOOK" .githooks/commit-msg
  chmod +x .githooks/commit-msg
  git config core.hooksPath .githooks
  echo "  ✓ .githooks/commit-msg (core.hooksPath gezet)"
else
  echo "  ⚠ templates/githooks-commit-msg niet gevonden — guard overgeslagen"
fi

# TC-EBC UserPromptSubmit hook: user-level (~/.claude), net als de skills — niet repo-lokaal.
# Bron: umanex-os/templates/tcebc-reminder.sh. Activatie = het script kopiëren én een hook-entry
# in ~/.claude/settings.json. settings.json is je eigen config, dus MERGEN met jq (idempotent:
# alleen toevoegen als de entry nog ontbreekt), nooit overschrijven.
echo ""
echo "→ Installeer TC-EBC UserPromptSubmit hook (user-level)..."
TCEBC_SRC="$UMANEX_OS_PATH/templates/tcebc-reminder.sh"
USER_HOOKS="$HOME/.claude/hooks"
USER_SETTINGS="$HOME/.claude/settings.json"
HOOK_CMD="$USER_HOOKS/tcebc-reminder.sh"
if [ ! -f "$TCEBC_SRC" ]; then
  echo "  ⚠ templates/tcebc-reminder.sh niet gevonden — hook overgeslagen"
else
  mkdir -p "$USER_HOOKS"
  cp "$TCEBC_SRC" "$HOOK_CMD"
  chmod +x "$HOOK_CMD"
  echo "  ✓ ~/.claude/hooks/tcebc-reminder.sh"
  if ! command -v jq >/dev/null 2>&1; then
    echo "  ⚠ jq niet gevonden — settings.json niet aangepast. Voeg de UserPromptSubmit-hook handmatig toe (zie docs/architecture.md)."
  else
    [ -f "$USER_SETTINGS" ] || echo '{}' > "$USER_SETTINGS"
    if jq -e --arg cmd "$HOOK_CMD" '.hooks.UserPromptSubmit[]?.hooks[]? | select(.command == $cmd)' "$USER_SETTINGS" >/dev/null 2>&1; then
      echo "  • settings.json bevat de hook al — ongemoeid gelaten"
    else
      _tmp="$(mktemp)"
      if jq --arg cmd "$HOOK_CMD" '.hooks.UserPromptSubmit += [{"hooks":[{"type":"command","command":$cmd,"timeout":10,"statusMessage":"TC-EBC check"}]}]' "$USER_SETTINGS" > "$_tmp" 2>/dev/null; then
        # `cat >` in plaats van `mv`: settings.json is bij veel dotfiles-opzetten een
        # symlink naar een repo, en `mv` vervángt die door een gewoon bestand — je edits
        # landen dan buiten je dotfiles zonder dat iets het meldt. `cat >` schrijft dóór
        # de symlink heen en laat de rechten van het bestaande bestand intact.
        cat "$_tmp" > "$USER_SETTINGS" && rm -f "$_tmp"
        echo "  ✓ UserPromptSubmit-hook toegevoegd aan settings.json (open /hooks of herstart om te activeren)"
      else
        rm -f "$_tmp"
        echo "  ⚠ kon settings.json niet bewerken — controleer of het geldige JSON is"
      fi
    fi
  fi
fi

# SessionStart handoff-hook: user-level, zelfde patroon als de TC-EBC-hook hierboven.
# Toont bij sessiestart de open HANDOFF-items. Script kopiëren + een SessionStart-entry
# mergen in ~/.claude/settings.json met jq (idempotent — alleen toevoegen als hij ontbreekt).
echo ""
echo "→ Installeer SessionStart handoff-hook (user-level)..."
HANDOFF_HOOK_SRC="$UMANEX_OS_PATH/templates/session-start-handoff.sh"
HANDOFF_HOOK_CMD="$USER_HOOKS/session-start-handoff.sh"
if [ ! -f "$HANDOFF_HOOK_SRC" ]; then
  echo "  ⚠ templates/session-start-handoff.sh niet gevonden — hook overgeslagen"
else
  mkdir -p "$USER_HOOKS"
  cp "$HANDOFF_HOOK_SRC" "$HANDOFF_HOOK_CMD"
  chmod +x "$HANDOFF_HOOK_CMD"
  echo "  ✓ ~/.claude/hooks/session-start-handoff.sh"
  if ! command -v jq >/dev/null 2>&1; then
    echo "  ⚠ jq niet gevonden — settings.json niet aangepast. Voeg de SessionStart-hook handmatig toe (zie docs/architecture.md)."
  else
    [ -f "$USER_SETTINGS" ] || echo '{}' > "$USER_SETTINGS"
    if jq -e --arg cmd "$HANDOFF_HOOK_CMD" '.hooks.SessionStart[]?.hooks[]? | select(.command == $cmd)' "$USER_SETTINGS" >/dev/null 2>&1; then
      echo "  • settings.json bevat de hook al — ongemoeid gelaten"
    else
      _tmp="$(mktemp)"
      if jq --arg cmd "$HANDOFF_HOOK_CMD" '.hooks.SessionStart += [{"hooks":[{"type":"command","command":$cmd,"timeout":10,"statusMessage":"Handoff surface"}]}]' "$USER_SETTINGS" > "$_tmp" 2>/dev/null; then
        # Zie de toelichting bij de UserPromptSubmit-hook hierboven: schrijf dóór een
        # eventuele symlink heen in plaats van hem te vervangen.
        cat "$_tmp" > "$USER_SETTINGS" && rm -f "$_tmp"
        echo "  ✓ SessionStart-hook toegevoegd aan settings.json (open /hooks of herstart om te activeren)"
      else
        rm -f "$_tmp"
        echo "  ⚠ kon settings.json niet bewerken — controleer of het geldige JSON is"
      fi
    fi
  fi
fi

# AskUserQuestion-guard: PreToolUse, user-level, zelfde patroon als de twee hooks hierboven.
# Waarschuwt bij een ongemarkeerd getal in een optie-tekst — de faalklasse uit LEARNINGS
# 2026-08-26. Anders dan die twee draagt deze entry een `matcher`, want PreToolUse vuurt op
# élke tool en we willen alleen AskUserQuestion.
echo ""
echo "→ Installeer AskUserQuestion-guard (PreToolUse, user-level)..."
ASKQ_SRC="$UMANEX_OS_PATH/templates/askquestion-estimate-guard.sh"
ASKQ_CMD="$USER_HOOKS/askquestion-estimate-guard.sh"
if [ ! -f "$ASKQ_SRC" ]; then
  echo "  ⚠ templates/askquestion-estimate-guard.sh niet gevonden — hook overgeslagen"
else
  mkdir -p "$USER_HOOKS"
  cp "$ASKQ_SRC" "$ASKQ_CMD"
  chmod +x "$ASKQ_CMD"
  echo "  ✓ ~/.claude/hooks/askquestion-estimate-guard.sh"
  if ! command -v jq >/dev/null 2>&1; then
    echo "  ⚠ jq niet gevonden — settings.json niet aangepast. Voeg de PreToolUse-hook handmatig toe (zie docs/architecture.md)."
  else
    [ -f "$USER_SETTINGS" ] || echo '{}' > "$USER_SETTINGS"
    if jq -e --arg cmd "$ASKQ_CMD" '.hooks.PreToolUse[]?.hooks[]? | select(.command == $cmd)' "$USER_SETTINGS" >/dev/null 2>&1; then
      echo "  • settings.json bevat de hook al — ongemoeid gelaten"
    else
      _tmp="$(mktemp)"
      if jq --arg cmd "$ASKQ_CMD" '.hooks.PreToolUse += [{"matcher":"AskUserQuestion","hooks":[{"type":"command","command":$cmd,"timeout":10,"statusMessage":"Schatting-check"}]}]' "$USER_SETTINGS" > "$_tmp" 2>/dev/null; then
        # Zie de toelichting bij de UserPromptSubmit-hook hierboven: schrijf dóór een
        # eventuele symlink heen in plaats van hem te vervangen.
        cat "$_tmp" > "$USER_SETTINGS" && rm -f "$_tmp"
        echo "  ✓ PreToolUse-hook toegevoegd aan settings.json (open /hooks of herstart om te activeren)"
      else
        rm -f "$_tmp"
        echo "  ⚠ kon settings.json niet bewerken — controleer of het geldige JSON is"
      fi
    fi
  fi
fi

# Bron-assertie-guard: PreToolUse op Write|Edit|NotebookEdit, user-level, zelfde patroon als de
# AskUserQuestion-guard hierboven. Waarschuwt wanneer een feitenbron (audits/, LEARNINGS, HANDOFF,
# BACKLOG, strategie/, *.tcebc.md) een ongemarkeerde "ik heb het nooit gezien"-zin krijgt — de
# faalklasse uit LEARNINGS 2026-09-02. Instructie alleen bleek daar niet genoeg: de replay ná de
# CLAUDE.md-harding reproduceerde de fout identiek.
echo ""
echo "→ Installeer bron-assertie-guard (PreToolUse, user-level)..."
BRON_SRC="$UMANEX_OS_PATH/templates/bron-assertie-guard.sh"
BRON_CMD="$USER_HOOKS/bron-assertie-guard.sh"
if [ ! -f "$BRON_SRC" ]; then
  echo "  ⚠ templates/bron-assertie-guard.sh niet gevonden — hook overgeslagen"
else
  mkdir -p "$USER_HOOKS"
  cp "$BRON_SRC" "$BRON_CMD"
  chmod +x "$BRON_CMD"
  echo "  ✓ ~/.claude/hooks/bron-assertie-guard.sh"
  if ! command -v jq >/dev/null 2>&1; then
    echo "  ⚠ jq niet gevonden — settings.json niet aangepast. Voeg de PreToolUse-hook handmatig toe (zie docs/architecture.md)."
  else
    [ -f "$USER_SETTINGS" ] || echo '{}' > "$USER_SETTINGS"
    if jq -e --arg cmd "$BRON_CMD" '.hooks.PreToolUse[]?.hooks[]? | select(.command == $cmd)' "$USER_SETTINGS" >/dev/null 2>&1; then
      echo "  • settings.json bevat de hook al — ongemoeid gelaten"
    else
      _tmp="$(mktemp)"
      if jq --arg cmd "$BRON_CMD" '.hooks.PreToolUse += [{"matcher":"Write|Edit|NotebookEdit","hooks":[{"type":"command","command":$cmd,"timeout":10,"statusMessage":"Bron-check"}]}]' "$USER_SETTINGS" > "$_tmp" 2>/dev/null; then
        cat "$_tmp" > "$USER_SETTINGS" && rm -f "$_tmp"
        echo "  ✓ PreToolUse-hook toegevoegd aan settings.json (open /hooks of herstart om te activeren)"
      else
        rm -f "$_tmp"
        echo "  ⚠ kon settings.json niet bewerken — controleer of het geldige JSON is"
      fi
    fi
  fi
fi

# Acceptatie-guard: de trigger van de Beoordeel-stap. Vuurt op de HANDELING (een vinkje,
# een statusovergang in een *.tcebc.md) en niet op de prompt, want het gemeten gat zit niet
# in wat de gebruiker vraagt maar in wat er tijdens de taak gebeurt: 22 van 78 briefings
# blijven op `gebouwd` staan, 49% van de acceptatie-items draagt meer dan één meting, en
# 14% kan per constructie niet rood worden (2026-09-07, umanex-apps).
echo ""
echo "→ Installeer acceptatie-guard (PreToolUse, user-level)..."
ACC_SRC="$UMANEX_OS_PATH/templates/acceptatie-guard.sh"
ACC_CMD="$USER_HOOKS/acceptatie-guard.sh"
if [ ! -f "$ACC_SRC" ]; then
  echo "  ⚠ templates/acceptatie-guard.sh niet gevonden — hook overgeslagen"
else
  mkdir -p "$USER_HOOKS"
  cp "$ACC_SRC" "$ACC_CMD"
  chmod +x "$ACC_CMD"
  echo "  ✓ ~/.claude/hooks/acceptatie-guard.sh"
  if ! command -v jq >/dev/null 2>&1; then
    echo "  ⚠ jq niet gevonden — settings.json niet aangepast. Voeg de PreToolUse-hook handmatig toe."
  else
    [ -f "$USER_SETTINGS" ] || echo '{}' > "$USER_SETTINGS"
    if jq -e --arg cmd "$ACC_CMD" '.hooks.PreToolUse[]?.hooks[]? | select(.command == $cmd)' "$USER_SETTINGS" >/dev/null 2>&1; then
      echo "  • settings.json bevat de hook al — ongemoeid gelaten"
    else
      _tmp="$(mktemp)"
      if jq --arg cmd "$ACC_CMD" '.hooks.PreToolUse += [{"matcher":"Write|Edit|NotebookEdit","hooks":[{"type":"command","command":$cmd,"timeout":10,"statusMessage":"Acceptatie-check"}]}]' "$USER_SETTINGS" > "$_tmp" 2>/dev/null; then
        cat "$_tmp" > "$USER_SETTINGS" && rm -f "$_tmp"
        echo "  ✓ PreToolUse-hook toegevoegd aan settings.json (open /hooks of herstart om te activeren)"
      else
        rm -f "$_tmp"
        echo "  ⚠ kon settings.json niet bewerken — controleer of het geldige JSON is"
      fi
    fi
  fi
fi

# Meting-guard: de verify-discipline in een taak zónder briefing. Vuurt wanneer je een
# instrument schrijft — een guard, een check, een test — want daar is "hij draait" niet
# hetzelfde als "hij meet". Gemeten op 243 schrijfacties: 6% vuurrate, nul vals.
echo ""
echo "→ Installeer meting-guard (PreToolUse, user-level)..."
MET_SRC="$UMANEX_OS_PATH/templates/meting-guard.sh"
MET_CMD="$USER_HOOKS/meting-guard.sh"
if [ ! -f "$MET_SRC" ]; then
  echo "  ⚠ templates/meting-guard.sh niet gevonden — hook overgeslagen"
else
  mkdir -p "$USER_HOOKS"
  cp "$MET_SRC" "$MET_CMD"
  chmod +x "$MET_CMD"
  echo "  ✓ ~/.claude/hooks/meting-guard.sh"
  if ! command -v jq >/dev/null 2>&1; then
    echo "  ⚠ jq niet gevonden — settings.json niet aangepast."
  else
    [ -f "$USER_SETTINGS" ] || echo '{}' > "$USER_SETTINGS"
    if jq -e --arg cmd "$MET_CMD" '.hooks.PreToolUse[]?.hooks[]? | select(.command == $cmd)' "$USER_SETTINGS" >/dev/null 2>&1; then
      echo "  • settings.json bevat de hook al — ongemoeid gelaten"
    else
      _tmp="$(mktemp)"
      if jq --arg cmd "$MET_CMD" '.hooks.PreToolUse += [{"matcher":"Write|Edit|NotebookEdit","hooks":[{"type":"command","command":$cmd,"timeout":10,"statusMessage":"Meting-check"}]}]' "$USER_SETTINGS" > "$_tmp" 2>/dev/null; then
        cat "$_tmp" > "$USER_SETTINGS" && rm -f "$_tmp"
        echo "  ✓ PreToolUse-hook toegevoegd aan settings.json"
      else
        rm -f "$_tmp"; echo "  ⚠ kon settings.json niet bewerken"
      fi
    fi
  fi
fi

# Nulmeting-guard: PostToolUse op Bash. Vuurt wanneer een telcommando een nul teruggeeft —
# het moment waarop "er is niets" en "mijn instrument staat stuk" er identiek uitzien.
# Gemeten op 592 Bash-calls: 2% vuurrate met de eis dat het commando óók een telling is.
echo ""
echo "→ Installeer nulmeting-guard (PostToolUse, user-level)..."
NUL_SRC="$UMANEX_OS_PATH/templates/nulmeting-guard.sh"
NUL_CMD="$USER_HOOKS/nulmeting-guard.sh"
if [ ! -f "$NUL_SRC" ]; then
  echo "  ⚠ templates/nulmeting-guard.sh niet gevonden — hook overgeslagen"
else
  mkdir -p "$USER_HOOKS"
  cp "$NUL_SRC" "$NUL_CMD"
  chmod +x "$NUL_CMD"
  echo "  ✓ ~/.claude/hooks/nulmeting-guard.sh"
  if ! command -v jq >/dev/null 2>&1; then
    echo "  ⚠ jq niet gevonden — settings.json niet aangepast."
  else
    [ -f "$USER_SETTINGS" ] || echo '{}' > "$USER_SETTINGS"
    if jq -e --arg cmd "$NUL_CMD" '.hooks.PostToolUse[]?.hooks[]? | select(.command == $cmd)' "$USER_SETTINGS" >/dev/null 2>&1; then
      echo "  • settings.json bevat de hook al — ongemoeid gelaten"
    else
      _tmp="$(mktemp)"
      if jq --arg cmd "$NUL_CMD" '.hooks.PostToolUse += [{"matcher":"Bash","hooks":[{"type":"command","command":$cmd,"timeout":10,"statusMessage":"Nulmeting-check"}]}]' "$USER_SETTINGS" > "$_tmp" 2>/dev/null; then
        cat "$_tmp" > "$USER_SETTINGS" && rm -f "$_tmp"
        echo "  ✓ PostToolUse-hook toegevoegd aan settings.json"
      else
        rm -f "$_tmp"; echo "  ⚠ kon settings.json niet bewerken"
      fi
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Identifier-bron-guard: PreToolUse op Write|Edit|NotebookEdit|Bash. Vuurt op een
# ondoorzichtige sleutel in een URL die nergens in de repo staat. Bash zit er bewust bij:
# de fout van 2026-09-07 landde via `cat > lib/appsConfig.ts <<EOF`, niet via Write.
# ---------------------------------------------------------------------------
echo "→ Installeer identifier-bron-guard (PreToolUse, user-level)..."
IDB_SRC="$UMANEX_OS_PATH/templates/identifier-bron-guard.sh"
IDB_CMD="$USER_HOOKS/identifier-bron-guard.sh"
if [ ! -f "$IDB_SRC" ]; then
  echo "  ⚠ templates/identifier-bron-guard.sh niet gevonden — hook overgeslagen"
else
  mkdir -p "$USER_HOOKS"
  cp "$IDB_SRC" "$IDB_CMD"
  chmod +x "$IDB_CMD"
  echo "  ✓ ~/.claude/hooks/identifier-bron-guard.sh"
  if ! command -v jq >/dev/null 2>&1; then
    echo "  ⚠ jq niet gevonden — settings.json niet aangepast."
  else
    [ -f "$USER_SETTINGS" ] || echo '{}' > "$USER_SETTINGS"
    if jq -e --arg cmd "$IDB_CMD" '.hooks.PreToolUse[]?.hooks[]? | select(.command == $cmd)' "$USER_SETTINGS" >/dev/null 2>&1; then
      echo "  • settings.json bevat de hook al — ongemoeid gelaten"
    else
      _tmp="$(mktemp)"
      if jq --arg cmd "$IDB_CMD" '.hooks.PreToolUse += [{"matcher":"Write|Edit|NotebookEdit|Bash","hooks":[{"type":"command","command":$cmd,"timeout":25,"statusMessage":"Identifier-check"}]}]' "$USER_SETTINGS" > "$_tmp" 2>/dev/null; then
        cat "$_tmp" > "$USER_SETTINGS" && rm -f "$_tmp"
        echo "  ✓ PreToolUse-hook toegevoegd aan settings.json"
      else
        rm -f "$_tmp"; echo "  ⚠ kon settings.json niet bewerken"
      fi
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Tegenspraak-guard: PostToolUse op Bash. Vuurt wanneer een commando zijn tweede meting
# als controle labelt en die controle een ander getal geeft dan de hoofdmeting.
# ---------------------------------------------------------------------------
echo "→ Installeer tegenspraak-guard (PostToolUse, user-level)..."
TGS_SRC="$UMANEX_OS_PATH/templates/tegenspraak-guard.sh"
TGS_CMD="$USER_HOOKS/tegenspraak-guard.sh"
if [ ! -f "$TGS_SRC" ]; then
  echo "  ⚠ templates/tegenspraak-guard.sh niet gevonden — hook overgeslagen"
else
  mkdir -p "$USER_HOOKS"
  cp "$TGS_SRC" "$TGS_CMD"
  chmod +x "$TGS_CMD"
  echo "  ✓ ~/.claude/hooks/tegenspraak-guard.sh"
  if ! command -v jq >/dev/null 2>&1; then
    echo "  ⚠ jq niet gevonden — settings.json niet aangepast."
  else
    [ -f "$USER_SETTINGS" ] || echo '{}' > "$USER_SETTINGS"
    if jq -e --arg cmd "$TGS_CMD" '.hooks.PostToolUse[]?.hooks[]? | select(.command == $cmd)' "$USER_SETTINGS" >/dev/null 2>&1; then
      echo "  • settings.json bevat de hook al — ongemoeid gelaten"
    else
      _tmp="$(mktemp)"
      if jq --arg cmd "$TGS_CMD" '.hooks.PostToolUse += [{"matcher":"Bash","hooks":[{"type":"command","command":$cmd,"timeout":10,"statusMessage":"Tegenspraak-check"}]}]' "$USER_SETTINGS" > "$_tmp" 2>/dev/null; then
        cat "$_tmp" > "$USER_SETTINGS" && rm -f "$_tmp"
        echo "  ✓ PostToolUse-hook toegevoegd aan settings.json"
      else
        rm -f "$_tmp"; echo "  ⚠ kon settings.json niet bewerken"
      fi
    fi
  fi
fi

echo ""
echo "✓ Sync compleet."
echo ""
echo "Volgende stappen:"
echo "  1. Check 'git status' om te zien wat er gewijzigd is in de klant-repo"
echo "  2. Commit de wijzigingen wanneer je wil"
echo ""
echo "Let op: een gelijknamige skill in deze klant-repo's .claude/skills/ heeft voorrang"
echo "op de zojuist gesyncte globale versie in ~/.claude/skills/."
