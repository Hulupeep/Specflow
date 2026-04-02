use anyhow::Result;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::utils::git;

/// Journey test runner hook.
/// Maps issues to journey IDs to test files, then runs relevant tests.
pub fn run() -> Result<i32> {
    let mut input = String::new();
    std::io::stdin().read_to_string(&mut input)?;
    // Input is consumed but not directly needed — we look at git history

    let project_dir = std::env::var("CLAUDE_PROJECT_DIR")
        .unwrap_or_else(|_| ".".to_string());
    let project_root = PathBuf::from(&project_dir);

    // Check for defer flag
    let defer_file = project_root.join(".claude/.defer-tests");
    if defer_file.exists() {
        eprintln!("Tests deferred globally. Run 'rm {}' to re-enable.", defer_file.display());
        return Ok(0);
    }

    // Check gh CLI
    if Command::new("gh").arg("--version").output().is_err() {
        eprintln!("Warning: gh CLI not installed. Cannot fetch journey contracts from issues.");
        return Ok(2);
    }

    eprintln!("Detecting issues worked on...");

    let issues = git::get_recent_issues(&project_root, 5)?;
    if issues.is_empty() {
        eprintln!("No issues found in recent commits. Skipping targeted tests.");
        return Ok(0);
    }

    eprintln!("Issues found: {}", issues.join(", "));

    let mut test_files = Vec::new();

    for issue in &issues {
        eprintln!("  Checking #{} for journey contracts...", issue);
        let journeys = get_journey_for_issue(issue);

        if journeys.is_empty() {
            eprintln!("  - #{}: No journey contract found", issue);
            continue;
        }

        for journey in &journeys {
            let test_file = journey_to_test_file(&project_root, journey);
            if project_root.join(&test_file).exists() {
                eprintln!("  + #{} -> {} -> {}", issue, journey, test_file);
                test_files.push(test_file);
            } else {
                eprintln!("  ? #{} -> {} but test file not found: {}", issue, journey, test_file);
            }
        }
    }

    test_files.sort();
    test_files.dedup();

    if test_files.is_empty() {
        eprintln!("No journey tests to run for these issues.");
        return Ok(0);
    }

    eprintln!("\nRunning journey tests: {}", test_files.join(" "));

    let test_cmd = detect_test_command(&project_root);
    let mut cmd_parts: Vec<&str> = test_cmd.split_whitespace().collect();
    let program = cmd_parts.remove(0);

    let status = Command::new(program)
        .args(&cmd_parts)
        .args(&test_files)
        .current_dir(&project_root)
        .status();

    match status {
        Ok(s) if s.success() => {
            eprintln!("\nJourney tests PASSED");
            Ok(0)
        }
        _ => {
            eprintln!("\nJourney tests FAILED");
            Ok(2)
        }
    }
}

fn get_journey_for_issue(issue: &str) -> Vec<String> {
    let output = Command::new("gh")
        .args(["issue", "view", issue, "--json", "body,comments"])
        .output();

    let text = match output {
        Ok(o) if o.status.success() => String::from_utf8_lossy(&o.stdout).to_string(),
        _ => return vec![],
    };

    let re = regex::Regex::new(r"J-[A-Z0-9]+(-[A-Z0-9]+)*").unwrap();
    let mut journeys: Vec<String> = re
        .find_iter(&text)
        .map(|m| m.as_str().to_string())
        .collect();
    journeys.sort();
    journeys.dedup();
    journeys.truncate(20);
    journeys
}

fn journey_to_test_file(project_root: &Path, journey: &str) -> String {
    // Check contract YAML for explicit test file path
    let contracts_dirs = ["docs/contracts", "contracts", "docs"];
    for dir in &contracts_dirs {
        let pattern = project_root.join(dir).join("journey_*.yml");
        if let Ok(paths) = glob::glob(&pattern.to_string_lossy()) {
            for entry in paths.flatten() {
                if let Ok(content) = std::fs::read_to_string(&entry) {
                    if content.contains(&format!("id: {}", journey))
                        || content.contains(&format!("id: \"{}\"", journey))
                    {
                        // Try to extract e2e_test_file
                        for line in content.lines() {
                            if line.contains("e2e_test_file") {
                                let parts: Vec<&str> = line.splitn(2, ':').collect();
                                if parts.len() == 2 {
                                    let path = parts[1].trim().trim_matches('"').trim_matches('\'');
                                    if !path.is_empty() {
                                        return path.to_string();
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Fallback: heuristic naming J-SIGNUP-FLOW -> journey_signup_flow.spec.ts
    let name = journey
        .strip_prefix("J-")
        .unwrap_or(journey)
        .to_lowercase()
        .replace('-', "_");
    format!("tests/e2e/journey_{}.spec.ts", name)
}

fn detect_test_command(root: &Path) -> String {
    if root.join("pnpm-lock.yaml").exists() {
        "pnpm test:e2e".to_string()
    } else if root.join("yarn.lock").exists() {
        "yarn test:e2e".to_string()
    } else if root.join("bun.lockb").exists() {
        "bun test:e2e".to_string()
    } else {
        "npm run test:e2e".to_string()
    }
}
