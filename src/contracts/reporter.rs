use colored::Colorize;
use std::path::Path;

use super::scanner::{ScanResult, Violation, ViolationKind};

/// Print violations as colored terminal output.
pub fn print_human(result: &ScanResult, project_root: &Path) {
    if result.violations.is_empty() {
        println!(
            "\n{}  No violations found ({} files scanned, {} rules checked)\n",
            "PASS".green().bold(),
            result.files_scanned,
            result.rules_checked
        );
        return;
    }

    println!(
        "\n{}  {} violation(s) found\n",
        "FAIL".red().bold(),
        result.violations.len()
    );

    // Group by contract
    let mut by_contract: std::collections::BTreeMap<&str, Vec<&Violation>> =
        std::collections::BTreeMap::new();
    for v in &result.violations {
        by_contract
            .entry(&v.contract_id)
            .or_default()
            .push(v);
    }

    for (contract_id, violations) in &by_contract {
        println!("  {} ({})", contract_id.bold(), format!("{} violations", violations.len()).red());
        for v in violations {
            let rel_path = v
                .file
                .strip_prefix(project_root)
                .unwrap_or(&v.file);

            match v.kind {
                ViolationKind::Forbidden => {
                    println!(
                        "    {} {}:{}:{} {}",
                        "x".red(),
                        rel_path.display().to_string().cyan(),
                        v.line,
                        v.column,
                        v.rule_id.yellow()
                    );
                    println!("      {}", v.message);
                    if !v.matched_text.is_empty() {
                        let display_text = if v.matched_text.len() > 80 {
                            format!("{}...", &v.matched_text[..77])
                        } else {
                            v.matched_text.clone()
                        };
                        println!("      matched: {}", display_text.dimmed());
                    }
                }
                ViolationKind::MissingRequired => {
                    println!(
                        "    {} {} {}",
                        "x".red(),
                        rel_path.display().to_string().cyan(),
                        v.rule_id.yellow()
                    );
                    println!("      {}", v.message);
                }
            }
        }
        println!();
    }

    println!(
        "  {} contracts, {} rules, {} files scanned",
        result.contracts_loaded, result.rules_checked, result.files_scanned
    );
    println!();
}

/// Print violations as JSON.
pub fn print_json(result: &ScanResult) {
    let output = serde_json::json!({
        "status": if result.violations.is_empty() { "pass" } else { "fail" },
        "violations": result.violations,
        "summary": {
            "violation_count": result.violations.len(),
            "files_scanned": result.files_scanned,
            "contracts_loaded": result.contracts_loaded,
            "rules_checked": result.rules_checked,
        }
    });
    println!("{}", serde_json::to_string_pretty(&output).unwrap());
}
