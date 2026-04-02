use anyhow::Result;
use colored::Colorize;
use serde_json::json;
use std::path::{Path, PathBuf};

use crate::contracts::loader;
use crate::utils::{fs as fsutil, git};

#[derive(Debug, Clone)]
struct Check {
    name: String,
    severity: Severity,
    status: Status,
    detail: String,
}

#[derive(Debug, Clone, Copy)]
enum Severity {
    Critical,
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Copy)]
enum Status {
    Pass,
    Warn,
    Fail,
}

impl Severity {
    fn as_str(&self) -> &str {
        match self {
            Severity::Critical => "CRITICAL",
            Severity::High => "HIGH",
            Severity::Medium => "MEDIUM",
            Severity::Low => "LOW",
        }
    }
}

pub fn run(dir: Option<&str>, json_output: bool) -> Result<()> {
    let project_root = PathBuf::from(dir.unwrap_or("."));
    let project_root = std::fs::canonicalize(&project_root).unwrap_or(project_root);

    let mut checks = Vec::new();

    // 1. Contract directory exists with YAML files
    let contracts_dir = project_root.join("docs/contracts");
    checks.push(check_contracts_dir(&contracts_dir));

    // 2. All contract YAML files parse
    checks.push(check_yaml_parse(&contracts_dir));

    // 3. All regex patterns compile
    checks.push(check_patterns_compile(&contracts_dir));

    // 4. Test directory exists
    checks.push(check_test_dir(&project_root));

    // 5. CLAUDE.md exists
    checks.push(check_claude_md(&project_root));

    // 6. Git commit-msg hook installed
    checks.push(check_git_hook(&project_root));

    // 7. Claude Code hooks installed
    checks.push(check_claude_hooks(&project_root));

    // 8. gh CLI installed
    checks.push(check_gh_cli());

    if json_output {
        print_json(&checks);
    } else {
        print_human(&checks, &project_root);
    }

    // Exit 1 if any CRITICAL or HIGH checks failed
    let has_critical_fail = checks.iter().any(|c| {
        matches!(c.status, Status::Fail)
            && matches!(c.severity, Severity::Critical | Severity::High)
    });

    if has_critical_fail {
        std::process::exit(1);
    }

    Ok(())
}

fn check_contracts_dir(dir: &Path) -> Check {
    let name = "Contract directory".to_string();
    if !dir.exists() {
        return Check {
            name,
            severity: Severity::Critical,
            status: Status::Fail,
            detail: format!("{} does not exist", dir.display()),
        };
    }
    let yml_count = fsutil::count_files(dir, "yml") + fsutil::count_files(dir, "yaml");
    if yml_count == 0 {
        return Check {
            name,
            severity: Severity::Critical,
            status: Status::Fail,
            detail: "No YAML contract files found".to_string(),
        };
    }
    Check {
        name,
        severity: Severity::Critical,
        status: Status::Pass,
        detail: format!("{} contract file(s)", yml_count),
    }
}

fn check_yaml_parse(dir: &Path) -> Check {
    let name = "YAML parsing".to_string();
    if !dir.exists() {
        return Check {
            name,
            severity: Severity::Critical,
            status: Status::Fail,
            detail: "Contract directory missing".to_string(),
        };
    }

    let mut errors = Vec::new();
    let mut count = 0;

    for ext in &["yml", "yaml"] {
        let pattern = dir.join(format!("*.{}", ext));
        if let Ok(paths) = glob::glob(&pattern.to_string_lossy()) {
            for entry in paths.flatten() {
                count += 1;
                match std::fs::read_to_string(&entry) {
                    Ok(content) => {
                        if let Err(e) = serde_yaml::from_str::<serde_yaml::Value>(&content) {
                            errors.push(format!("{}: {}", entry.display(), e));
                        }
                    }
                    Err(e) => errors.push(format!("{}: {}", entry.display(), e)),
                }
            }
        }
    }

    if !errors.is_empty() {
        return Check {
            name,
            severity: Severity::Critical,
            status: Status::Fail,
            detail: format!("{} error(s): {}", errors.len(), errors[0]),
        };
    }

    Check {
        name,
        severity: Severity::Critical,
        status: Status::Pass,
        detail: format!("All {} files parse cleanly", count),
    }
}

fn check_patterns_compile(dir: &Path) -> Check {
    let name = "Pattern compilation".to_string();
    if !dir.exists() {
        return Check {
            name,
            severity: Severity::Critical,
            status: Status::Fail,
            detail: "Contract directory missing".to_string(),
        };
    }

    match loader::load_contracts_from_dir(dir) {
        Ok(contracts) => {
            let rule_count: usize = contracts.iter().map(|c| c.rules.len()).sum();
            Check {
                name,
                severity: Severity::Critical,
                status: Status::Pass,
                detail: format!("{} rules across {} contracts", rule_count, contracts.len()),
            }
        }
        Err(e) => Check {
            name,
            severity: Severity::Critical,
            status: Status::Fail,
            detail: format!("Failed: {}", e),
        },
    }
}

fn check_test_dir(root: &Path) -> Check {
    let name = "Test directory".to_string();
    let test_dir = root.join("tests/contracts");
    if test_dir.exists() {
        Check {
            name,
            severity: Severity::High,
            status: Status::Pass,
            detail: "tests/contracts/ exists".to_string(),
        }
    } else {
        Check {
            name,
            severity: Severity::High,
            status: Status::Warn,
            detail: "tests/contracts/ not found".to_string(),
        }
    }
}

fn check_claude_md(root: &Path) -> Check {
    let name = "CLAUDE.md".to_string();
    let path = root.join("CLAUDE.md");
    if path.exists() {
        Check {
            name,
            severity: Severity::High,
            status: Status::Pass,
            detail: "CLAUDE.md exists".to_string(),
        }
    } else {
        Check {
            name,
            severity: Severity::High,
            status: Status::Fail,
            detail: "CLAUDE.md not found".to_string(),
        }
    }
}

fn check_git_hook(root: &Path) -> Check {
    let name = "Git commit-msg hook".to_string();
    if git::has_commit_msg_hook(root) {
        Check {
            name,
            severity: Severity::Medium,
            status: Status::Pass,
            detail: "Installed and executable".to_string(),
        }
    } else {
        Check {
            name,
            severity: Severity::Medium,
            status: Status::Warn,
            detail: "Not installed — run specflow update".to_string(),
        }
    }
}

fn check_claude_hooks(root: &Path) -> Check {
    let name = "Claude Code hooks".to_string();
    let settings_path = root.join(".claude/settings.json");
    if settings_path.exists() {
        match std::fs::read_to_string(&settings_path) {
            Ok(content) => {
                if content.contains("PostToolUse") {
                    Check {
                        name,
                        severity: Severity::Medium,
                        status: Status::Pass,
                        detail: ".claude/settings.json has hook config".to_string(),
                    }
                } else {
                    Check {
                        name,
                        severity: Severity::Medium,
                        status: Status::Warn,
                        detail: "settings.json exists but no PostToolUse hooks".to_string(),
                    }
                }
            }
            Err(_) => Check {
                name,
                severity: Severity::Medium,
                status: Status::Warn,
                detail: "Cannot read .claude/settings.json".to_string(),
            },
        }
    } else {
        Check {
            name,
            severity: Severity::Medium,
            status: Status::Warn,
            detail: "Not installed — run specflow update".to_string(),
        }
    }
}

fn check_gh_cli() -> Check {
    let name = "gh CLI".to_string();
    match std::process::Command::new("gh").arg("--version").output() {
        Ok(output) if output.status.success() => Check {
            name,
            severity: Severity::Low,
            status: Status::Pass,
            detail: "Installed".to_string(),
        },
        _ => Check {
            name,
            severity: Severity::Low,
            status: Status::Warn,
            detail: "Not installed — needed for audit command".to_string(),
        },
    }
}

fn print_human(checks: &[Check], root: &Path) {
    println!();
    println!("{}", "Specflow Doctor".bold());
    println!("Project: {}", root.display().to_string().cyan());
    println!();

    let max_name = checks.iter().map(|c| c.name.len()).max().unwrap_or(20);

    for (i, check) in checks.iter().enumerate() {
        let icon = match check.status {
            Status::Pass => "PASS".green(),
            Status::Warn => "WARN".yellow(),
            Status::Fail => "FAIL".red(),
        };
        let severity = match check.severity {
            Severity::Critical => check.severity.as_str().red(),
            Severity::High => check.severity.as_str().yellow(),
            Severity::Medium => check.severity.as_str().normal(),
            Severity::Low => check.severity.as_str().dimmed(),
        };

        println!(
            "  {:>2}. [{}] {:<width$}  {:>8}  {}",
            i + 1,
            icon,
            check.name,
            severity,
            check.detail.dimmed(),
            width = max_name
        );
    }

    let pass_count = checks.iter().filter(|c| matches!(c.status, Status::Pass)).count();
    println!();
    println!(
        "  {}/{} checks passed",
        pass_count,
        checks.len()
    );
    println!();
}

fn print_json(checks: &[Check]) {
    let checks_json: Vec<serde_json::Value> = checks
        .iter()
        .map(|c| {
            json!({
                "name": c.name,
                "severity": c.severity.as_str(),
                "status": match c.status {
                    Status::Pass => "pass",
                    Status::Warn => "warn",
                    Status::Fail => "fail",
                },
                "detail": c.detail,
            })
        })
        .collect();

    let pass_count = checks.iter().filter(|c| matches!(c.status, Status::Pass)).count();
    let has_failures = checks.iter().any(|c| matches!(c.status, Status::Fail));

    let output = json!({
        "status": if has_failures { "fail" } else { "pass" },
        "checks": checks_json,
        "summary": {
            "total": checks.len(),
            "pass": pass_count,
            "warn": checks.iter().filter(|c| matches!(c.status, Status::Warn)).count(),
            "fail": checks.iter().filter(|c| matches!(c.status, Status::Fail)).count(),
        }
    });
    println!("{}", serde_json::to_string_pretty(&output).unwrap());
}
