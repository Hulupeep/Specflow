use anyhow::Result;
use colored::Colorize;
use serde_json::json;
use std::path::PathBuf;

use crate::contracts::loader::load_contracts_from_dir;
use crate::contracts::scanner::scan_project;
use crate::utils::git;

pub fn run(dir: Option<&str>, json_output: bool) -> Result<()> {
    let project_root = PathBuf::from(dir.unwrap_or("."));
    let project_root = std::fs::canonicalize(&project_root).unwrap_or(project_root);

    let contracts_dir = project_root.join("docs/contracts");

    // Count contracts and rules
    let (contract_count, rule_count, violation_count, files_scanned) =
        if contracts_dir.exists() {
            match load_contracts_from_dir(&contracts_dir) {
                Ok(contracts) => {
                    let rc: usize = contracts.iter().map(|c| c.rules.len()).sum();
                    let cc = contracts.len();
                    match scan_project(&project_root, &contracts) {
                        Ok(result) => (cc, rc, result.violations.len(), result.files_scanned),
                        Err(_) => (cc, rc, 0, 0),
                    }
                }
                Err(_) => (0, 0, 0, 0),
            }
        } else {
            (0, 0, 0, 0)
        };

    let compliance_pct = if rule_count > 0 && files_scanned > 0 {
        let total_checks = rule_count * files_scanned;
        if total_checks > 0 {
            let passing = total_checks.saturating_sub(violation_count);
            (passing as f64 / total_checks as f64 * 100.0).min(100.0)
        } else {
            100.0
        }
    } else if violation_count == 0 {
        100.0
    } else {
        0.0
    };

    let has_git_hook = git::has_commit_msg_hook(&project_root);
    let has_claude_hooks = project_root.join(".claude/settings.json").exists();
    let has_claude_md = project_root.join("CLAUDE.md").exists();

    if json_output {
        let output = json!({
            "contracts": contract_count,
            "rules": rule_count,
            "violations": violation_count,
            "files_scanned": files_scanned,
            "compliance_percentage": (compliance_pct * 10.0).round() / 10.0,
            "hooks": {
                "git_commit_msg": has_git_hook,
                "claude_code": has_claude_hooks,
            },
            "claude_md": has_claude_md,
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!();
        println!("{}", "Specflow Status".bold());
        println!("Project: {}", project_root.display().to_string().cyan());
        println!();

        println!("  Contracts:  {}", contract_count.to_string().bold());
        println!("  Rules:      {}", rule_count.to_string().bold());
        println!("  Files:      {}", files_scanned.to_string().bold());

        if violation_count == 0 {
            println!("  Violations: {}", "0".green().bold());
        } else {
            println!("  Violations: {}", violation_count.to_string().red().bold());
        }

        let pct_str = format!("{:.1}%", compliance_pct);
        if compliance_pct >= 100.0 {
            println!("  Compliance: {}", pct_str.green().bold());
        } else if compliance_pct >= 80.0 {
            println!("  Compliance: {}", pct_str.yellow().bold());
        } else {
            println!("  Compliance: {}", pct_str.red().bold());
        }

        println!();
        println!("  Hooks:");
        println!(
            "    Git commit-msg: {}",
            if has_git_hook {
                "installed".green()
            } else {
                "missing".red()
            }
        );
        println!(
            "    Claude Code:    {}",
            if has_claude_hooks {
                "installed".green()
            } else {
                "missing".red()
            }
        );
        println!(
            "    CLAUDE.md:      {}",
            if has_claude_md {
                "present".green()
            } else {
                "missing".red()
            }
        );

        println!();
    }

    Ok(())
}
