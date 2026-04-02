#!/bin/bash
# Pipeline compliance checker — runs after Write/Edit tool use
# Catches when the LLM skips steps in the specflow pipeline:
#   - Playwright tests written without journey contract YAMLs
#   - Journey contracts without corresponding test files
#   - Components modified without contract tests passing
#   - CSV journeys defined but never compiled
#
# Exit codes:
#   0 — compliant
#   2 — violation (shown to model as error)

set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
VIOLATIONS=()

# ─── Check 1: Playwright tests without journey contracts ───────────────────
# If tests/e2e/journey_*.spec.ts exists, the matching docs/contracts/journey_*.yml MUST exist

for test_file in "$PROJECT_DIR"/tests/e2e/journey_*.spec.ts; do
    [ -f "$test_file" ] || continue
    base=$(basename "$test_file" .spec.ts)
    contract="$PROJECT_DIR/docs/contracts/${base}.yml"
    if [ ! -f "$contract" ]; then
        VIOLATIONS+=("PIPELINE SKIP: $test_file exists but $contract is missing. Run: npm run compile:journeys")
    fi
done

# ─── Check 2: Journey contracts without test files ─────────────────────────
# If docs/contracts/journey_*.yml exists, the matching tests/e2e/journey_*.spec.ts MUST exist

for contract in "$PROJECT_DIR"/docs/contracts/journey_*.yml; do
    [ -f "$contract" ] || continue
    base=$(basename "$contract" .yml)
    test_file="$PROJECT_DIR/tests/e2e/${base}.spec.ts"
    if [ ! -f "$test_file" ]; then
        VIOLATIONS+=("ORPHAN CONTRACT: $contract exists but $test_file is missing. Generate stubs: npm run compile:journeys")
    fi
done

# ─── Check 3: CSV journeys defined but not compiled ────────────────────────
# If docs/journeys/*.csv exists, at least one docs/contracts/journey_*.yml must exist

csv_count=0
contract_count=0
for csv in "$PROJECT_DIR"/docs/journeys/*.csv; do
    [ -f "$csv" ] || continue
    # Skip index/metadata files — only count journey definition CSVs
    case "$(basename "$csv")" in
        *INDEX* | *index* | *README* | *readme*) continue ;;
    esac
    csv_count=$((csv_count + 1))
done
for yml in "$PROJECT_DIR"/docs/contracts/journey_*.yml; do
    [ -f "$yml" ] || continue
    contract_count=$((contract_count + 1))
done

if [ "$csv_count" -gt 0 ] && [ "$contract_count" -eq 0 ]; then
    VIOLATIONS+=("CSV NOT COMPILED: Found $csv_count journey CSV(s) but no journey contracts. Run: npm run compile:journeys")
fi

# ─── Check 4: Feature contract exists for components ───────────────────────
# If app/src/components/ has .tsx files, docs/contracts/feature_*.yml must exist

component_count=0
feature_contract_count=0
for comp in "$PROJECT_DIR"/app/src/components/*.tsx; do
    [ -f "$comp" ] || continue
    component_count=$((component_count + 1))
done
for fc in "$PROJECT_DIR"/docs/contracts/feature_*.yml; do
    [ -f "$fc" ] || continue
    feature_contract_count=$((feature_contract_count + 1))
done

if [ "$component_count" -gt 0 ] && [ "$feature_contract_count" -eq 0 ]; then
    VIOLATIONS+=("MISSING CONTRACTS: $component_count component(s) in app/src/components/ but no feature contracts in docs/contracts/")
fi

# ─── Check 5: Playwright test stubs (TODO markers) ────────────────────────
# If a journey test file still has // TODO: Implement, it's a stub not a real test

for test_file in "$PROJECT_DIR"/tests/e2e/journey_*.spec.ts; do
    [ -f "$test_file" ] || continue
    if grep -q "// TODO: Implement" "$test_file" 2>/dev/null; then
        VIOLATIONS+=("STUB TEST: $test_file still has TODO stubs. Fill in real Playwright assertions.")
    fi
done

# ─── Report ────────────────────────────────────────────────────────────────

if [ ${#VIOLATIONS[@]} -eq 0 ]; then
    exit 0
fi

echo "" >&2
echo "╔═══════════════════════════════════════════════════════════╗" >&2
echo "║  SPECFLOW PIPELINE VIOLATION                             ║" >&2
echo "╚═══════════════════════════════════════════════════════════╝" >&2
echo "" >&2

for v in "${VIOLATIONS[@]}"; do
    echo "  ✗ $v" >&2
done

echo "" >&2
echo "  The correct pipeline is:" >&2
echo "    CSV → compile:journeys → YAML contracts + stubs → fill in stubs" >&2
echo "" >&2
echo "  Do not write Playwright tests without journey contracts." >&2
echo "  Do not write components without feature contracts." >&2
echo "" >&2

exit 2
