#!/bin/bash

# sync-os.sh — synct umanex-os naar de huidige klant-repo
# Plaats dit script in <klant-repo>/scripts/sync-os.sh
# Aanpassen per klant: UMANEX_OS_PATH en CLIENT_PROFILE
#
# Wat dit script synct:
# - .umanex-os/CLAUDE.md         (globale werkprincipes)
# - .umanex-os/profiles/{X}.md    (klant-specifiek profile)
#
# Wat dit script NIET meer synct:
# - skills/                       — staan user-level in ~/.claude/skills/
#                                   (Claude Code's standaard discovery locatie)
#
# Skills installeren of updaten:
#   cp -R ~/Documents/umanex-os/skills/<naam> ~/.claude/skills/

set -e  # stop bij eerste fout

# === AANPASSEN PER KLANT ===
UMANEX_OS_PATH="$HOME/Documents/umanex-os"
CLIENT_PROFILE="umanex"   # opties: columba, luminus, umanex
# ============================

# Bepaal waar dit script staat en ga naar de klant-repo root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CLIENT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

echo "→ Sync umanex-os naar $(basename "$CLIENT_ROOT")"
echo "  Profile: $CLIENT_PROFILE"
echo ""

# Check of umanex-os lokaal staat
if [ ! -d "$UMANEX_OS_PATH" ]; then
  echo "✗ umanex-os niet gevonden op $UMANEX_OS_PATH"
  echo "  Pas UMANEX_OS_PATH aan bovenaan dit script."
  exit 1
fi

# Pull laatste versie van umanex-os
echo "→ Pull laatste versie uit GitHub..."
cd "$UMANEX_OS_PATH"
git pull --quiet
echo "  ✓ umanex-os up-to-date"
echo ""

# Maak doel-folders in klant-repo
cd "$CLIENT_ROOT"
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

# Verwijder oude skills folder als die er nog staat (legacy van vorige versie)
if [ -d ".umanex-os/skills" ]; then
  echo "→ Oude .umanex-os/skills/ folder gevonden — opruimen..."
  rm -rf ".umanex-os/skills"
  echo "  ✓ Verwijderd. Skills staan nu in ~/.claude/skills/"
fi

echo ""
echo "✓ Sync compleet."
echo ""
echo "Volgende stappen:"
echo "  1. Check 'git status' om te zien wat er gewijzigd is"
echo "  2. Commit de wijzigingen wanneer je wil"
echo ""
echo "Skills updaten? Dat doe je apart:"
echo "  cp -R $UMANEX_OS_PATH/skills/<naam> ~/.claude/skills/"
