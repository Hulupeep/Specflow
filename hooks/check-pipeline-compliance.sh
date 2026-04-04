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

# ─── Load legacy test allowlist ────────────────────────────────────────────
# Tests listed in .specflow/legacy-tests.txt are exempt from contract checks.
# One filename per line (e.g. journey_old_feature.spec.ts)
LEGACY_FILE="$PROJECT_DIR/.specflow/legacy-tests.txt"
is_legacy_test() {
    local base="$1"
    [ -f "$LEGACY_FILE" ] && grep -qxF "$base" "$LEGACY_FILE" 2>/dev/null
}

# ─── Build list of test directories to search ──────────────────────────────
# Default: tests/e2e/ in project root
# Monorepo: also search subdirectories and .specflow/config.json paths
TEST_DIRS=("$PROJECT_DIR/tests/e2e")

# Add subdirectory test dirs (monorepo support)
for subdir in "$PROJECT_DIR"/*/tests/e2e; do
    [ -d "$subdir" ] && TEST_DIRS+=("$subdir")
done
for subdir in "$PROJECT_DIR"/packages/*/tests/e2e "$PROJECT_DIR"/apps/*/tests/e2e; do
    [ -d "$subdir" ] && TEST_DIRS+=("$subdir")
done

# Add paths from .specflow/config.json if it exists
if [ -f "$PROJECT_DIR/.specflow/config.json" ] && command -v jq &> /dev/null; then
    extra_dirs=$(jq -r '.e2e_test_dirs[]? // empty' "$PROJECT_DIR/.specflow/config.json" 2>/dev/null)
    while IFS= read -r dir; do
        [ -n "$dir" ] && [ -d "$PROJECT_DIR/$dir" ] && TEST_DIRS+=("$PROJECT_DIR/$dir")
    done <<< "$extra_dirs"
fi

# Helper: find a test file across all test directories
find_test_file() {
    local base="$1"
    for dir in "${TEST_DIRS[@]}"; do
        local candidate="$dir/${base}.spec.ts"
        if [ -f "$candidate" ]; then
            echo "$candidate"
            return 0
        fi
    done
    return 1
}

# ─── Check 1: Playwright tests without journey contracts ───────────────────
# If journey_*.spec.ts exists in any test dir, the matching docs/contracts/journey_*.yml MUST exist

for dir in "${TEST_DIRS[@]}"; do
    for test_file in "$dir"/journey_*.spec.ts; do
        [ -f "$test_file" ] || continue
        base=$(basename "$test_file")
        base_no_ext=$(basename "$test_file" .spec.ts)
        # Skip legacy/pre-specflow tests
        if is_legacy_test "$base"; then
            continue
        fi
        contract="$PROJECT_DIR/docs/contracts/${base_no_ext}.yml"
        if [ ! -f "$contract" ]; then
            VIOLATIONS+=("PIPELINE SKIP: $test_file exists but $contract is missing. Run: npm run compile:journeys (or add $base to .specflow/legacy-tests.txt)")
        fi
    done
done

# ─── Check 2: Journey contracts without test files ─────────────────────────
# If docs/contracts/journey_*.yml exists, check test_hooks.e2e_test_file first, then search all test dirs

for contract in "$PROJECT_DIR"/docs/contracts/journey_*.yml; do
    [ -f "$contract" ] || continue
    base=$(basename "$contract" .yml)

    # First: check if contract declares a specific test file path
    declared_test=$(grep -A1 'test_hooks' "$contract" 2>/dev/null | grep 'e2e_test_file' | sed 's/.*e2e_test_file:[[:space:]]*//' | tr -d '"' | tr -d "'" | xargs)
    if [ -n "$declared_test" ] && [ -f "$PROJECT_DIR/$declared_test" ]; then
        continue  # Contract points to a real file — compliant
    fi

    # Second: search all test directories
    if find_test_file "$base" > /dev/null 2>&1; then
        continue  # Found in one of the test dirs — compliant
    fi

    VIOLATIONS+=("ORPHAN CONTRACT: $contract exists but no matching test file found in: ${TEST_DIRS[*]}")
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
# Search for .tsx component files across common locations

component_count=0
feature_contract_count=0
for comp_dir in "$PROJECT_DIR"/app/src/components "$PROJECT_DIR"/src/components "$PROJECT_DIR"/*/src/components "$PROJECT_DIR"/packages/*/src/components; do
    for comp in "$comp_dir"/*.tsx; do
        [ -f "$comp" ] || continue
        component_count=$((component_count + 1))
    done
done
for fc in "$PROJECT_DIR"/docs/contracts/feature_*.yml; do
    [ -f "$fc" ] || continue
    feature_contract_count=$((feature_contract_count + 1))
done

if [ "$component_count" -gt 0 ] && [ "$feature_contract_count" -eq 0 ]; then
    VIOLATIONS+=("MISSING CONTRACTS: $component_count component(s) found but no feature contracts in docs/contracts/")
fi

# ─── Check 5: Playwright test stubs (TODO markers) ────────────────────────
# Search all test directories for stubs

for dir in "${TEST_DIRS[@]}"; do
    for test_file in "$dir"/journey_*.spec.ts; do
        [ -f "$test_file" ] || continue
        if grep -q "// TODO: Implement" "$test_file" 2>/dev/null; then
            VIOLATIONS+=("STUB TEST: $test_file still has TODO stubs. Fill in real Playwright assertions.")
        fi
    done
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
