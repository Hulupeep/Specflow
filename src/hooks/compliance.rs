use anyhow::Result;
use serde::Deserialize;
use std::io::Read;
use std::path::{Path, PathBuf};

use crate::contracts::loader::load_contracts_from_dir;
use crate::contracts::scanner::scan_project;

#[derive(Debug, Deserialize)]
struct HookInput {
    #[serde(default)]
    inputs: Option<HookInputs>,
}

#[derive(Debug, Deserialize)]
struct HookInputs {
    #[serde(default)]
    file_path: Option<String>,
    #[serde(default)]
    command: Option<String>,
}

/// Pipeline compliance hook — runs after Write/Edit tool use.
/// Checks changed files against contracts.
pub fn run() -> Result<i32> {
    let mut input = String::new();
    std::io::stdin().read_to_string(&mut input)?;

    if input.trim().is_empty() {
        return Ok(0);
    }

    let hook: HookInput = serde_json::from_str(&input).unwrap_or(HookInput { inputs: None });

    let file_path = hook
        .inputs
        .as_ref()
        .and_then(|i| i.file_path.clone().or_else(|| i.command.clone()));

    if file_path.is_none() {
        return Ok(0);
    }

    let project_dir = std::env::var("CLAUDE_PROJECT_DIR")
        .unwrap_or_else(|_| ".".to_string());
    let project_root = PathBuf::from(&project_dir);
    let contracts_dir = project_root.join("docs/contracts");

    if !contracts_dir.exists() {
        return Ok(0);
    }

    // Load contracts
    let contracts = match load_contracts_from_dir(&contracts_dir) {
        Ok(c) => c,
        Err(_) => return Ok(0),
    };

    if contracts.is_empty() {
        return Ok(0);
    }

    // Scan the project
    let result = scan_project(&project_root, &contracts)?;

    if result.violations.is_empty() {
        return Ok(0);
    }

    // Check pipeline compliance: journey tests without contracts, etc.
    let mut violations = Vec::new();

    check_journey_test_contracts(&project_root, &mut violations);
    check_orphan_contracts(&project_root, &mut violations);
    check_csv_compiled(&project_root, &mut violations);

    if violations.is_empty() {
        return Ok(0);
    }

    eprintln!();
    eprintln!("{}", "+---------------------------------------------------------+");
    eprintln!("{}", "|  SPECFLOW PIPELINE VIOLATION                             |");
    eprintln!("{}", "+---------------------------------------------------------+");
    eprintln!();

    for v in &violations {
        eprintln!("  x {}", v);
    }

    eprintln!();
    eprintln!("  The correct pipeline is:");
    eprintln!("    CSV -> compile:journeys -> YAML contracts + stubs -> fill in stubs");
    eprintln!();

    Ok(2)
}

fn check_journey_test_contracts(root: &Path, violations: &mut Vec<String>) {
    let test_pattern = root.join("tests/e2e/journey_*.spec.ts");
    if let Ok(paths) = glob::glob(&test_pattern.to_string_lossy()) {
        for entry in paths.flatten() {
            let base = entry
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .strip_suffix(".spec")
                .unwrap_or(
                    entry.file_stem().and_then(|s| s.to_str()).unwrap_or("")
                );
            let contract = root.join(format!("docs/contracts/{}.yml", base));
            if !contract.exists() {
                violations.push(format!(
                    "PIPELINE SKIP: {} exists but {} is missing",
                    entry.display(),
                    contract.display()
                ));
            }
        }
    }
}

fn check_orphan_contracts(root: &Path, violations: &mut Vec<String>) {
    let contract_pattern = root.join("docs/contracts/journey_*.yml");
    if let Ok(paths) = glob::glob(&contract_pattern.to_string_lossy()) {
        for entry in paths.flatten() {
            let base = entry
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("");
            let test_file = root.join(format!("tests/e2e/{}.spec.ts", base));
            if !test_file.exists() {
                violations.push(format!(
                    "ORPHAN CONTRACT: {} exists but {} is missing",
                    entry.display(),
                    test_file.display()
                ));
            }
        }
    }
}

fn check_csv_compiled(root: &Path, violations: &mut Vec<String>) {
    let csv_pattern = root.join("docs/journeys/*.csv");
    let contract_pattern = root.join("docs/contracts/journey_*.yml");

    let csv_count = glob::glob(&csv_pattern.to_string_lossy())
        .map(|entries| entries.flatten().count())
        .unwrap_or(0);

    let contract_count = glob::glob(&contract_pattern.to_string_lossy())
        .map(|entries| entries.flatten().count())
        .unwrap_or(0);

    if csv_count > 0 && contract_count == 0 {
        violations.push(format!(
            "CSV NOT COMPILED: Found {} journey CSV(s) but no journey contracts",
            csv_count
        ));
    }
}
