use anyhow::{Context, Result};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::fs;

use super::loader::{CompiledContract, CompiledRule};

#[derive(Debug, Clone, Serialize)]
pub struct Violation {
    pub contract_id: String,
    pub rule_id: String,
    pub rule_title: String,
    pub file: PathBuf,
    pub line: usize,
    pub column: usize,
    pub matched_text: String,
    pub message: String,
    pub pattern: String,
    pub kind: ViolationKind,
}

#[derive(Debug, Clone, Serialize)]
pub enum ViolationKind {
    Forbidden,
    MissingRequired,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScanResult {
    pub violations: Vec<Violation>,
    pub files_scanned: usize,
    pub contracts_loaded: usize,
    pub rules_checked: usize,
}

/// Resolve scope glob patterns relative to a project root.
/// Handles negation patterns (prefixed with `!`).
fn resolve_scope_files(project_root: &Path, scope: &[String]) -> Result<Vec<PathBuf>> {
    let mut included = Vec::new();
    let mut excluded = Vec::new();

    for pattern in scope {
        if let Some(neg_pattern) = pattern.strip_prefix('!') {
            let full = project_root.join(neg_pattern);
            let full_str = full.to_string_lossy();
            if let Ok(paths) = glob::glob(&full_str) {
                for entry in paths.flatten() {
                    excluded.push(entry);
                }
            }
        } else {
            let full = project_root.join(pattern);
            let full_str = full.to_string_lossy();
            if let Ok(paths) = glob::glob(&full_str) {
                for entry in paths.flatten() {
                    if entry.is_file() {
                        included.push(entry);
                    }
                }
            }
        }
    }

    // Remove excluded files
    included.retain(|f| !excluded.contains(f));
    included.sort();
    included.dedup();
    Ok(included)
}

/// Scan a single file against a single rule.
fn scan_file_rule(
    file: &Path,
    rule: &CompiledRule,
    contract_id: &str,
) -> Result<Vec<Violation>> {
    let content = fs::read_to_string(file)
        .with_context(|| format!("Failed to read file: {}", file.display()))?;

    let mut violations = Vec::new();

    // Check forbidden patterns
    for pattern in &rule.forbidden {
        for (line_idx, line) in content.lines().enumerate() {
            if let Some(m) = pattern.regex.find(line) {
                violations.push(Violation {
                    contract_id: contract_id.to_string(),
                    rule_id: rule.id.clone(),
                    rule_title: rule.title.clone(),
                    file: file.to_path_buf(),
                    line: line_idx + 1,
                    column: m.start() + 1,
                    matched_text: m.as_str().to_string(),
                    message: pattern.message.clone(),
                    pattern: pattern.raw.clone(),
                    kind: ViolationKind::Forbidden,
                });
            }
        }
    }

    // Check required patterns (must appear at least once in the file)
    for pattern in &rule.required {
        if !pattern.regex.is_match(&content) {
            violations.push(Violation {
                contract_id: contract_id.to_string(),
                rule_id: rule.id.clone(),
                rule_title: rule.title.clone(),
                file: file.to_path_buf(),
                line: 0,
                column: 0,
                matched_text: String::new(),
                message: pattern.message.clone(),
                pattern: pattern.raw.clone(),
                kind: ViolationKind::MissingRequired,
            });
        }
    }

    Ok(violations)
}

/// Scan all contracts against a project directory.
pub fn scan_project(
    project_root: &Path,
    contracts: &[CompiledContract],
) -> Result<ScanResult> {
    let mut all_violations = Vec::new();
    let mut files_scanned = std::collections::HashSet::new();
    let mut rules_checked = 0;

    for contract in contracts {
        for rule in &contract.rules {
            rules_checked += 1;
            let files = resolve_scope_files(project_root, &rule.scope)?;

            for file in &files {
                files_scanned.insert(file.clone());
                let violations = scan_file_rule(file, rule, &contract.meta.id)?;
                all_violations.extend(violations);
            }
        }
    }

    Ok(ScanResult {
        violations: all_violations,
        files_scanned: files_scanned.len(),
        contracts_loaded: contracts.len(),
        rules_checked,
    })
}
