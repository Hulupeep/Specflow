use anyhow::{Result, bail};
use colored::Colorize;
use regex::Regex;
use std::process::Command;

/// Audit a GitHub issue for specflow compliance markers.
pub fn run(issue: &str) -> Result<()> {
    if !issue.chars().all(|c| c.is_ascii_digit()) {
        bail!("Usage: specflow audit <issue-number>");
    }

    // Fetch issue via gh CLI
    let output = Command::new("gh")
        .args(["issue", "view", issue, "--json", "title,body,comments"])
        .output();

    let output = match output {
        Ok(o) if o.status.success() => o,
        _ => {
            bail!("Could not fetch issue #{}. Is gh authenticated?", issue);
        }
    };

    let json_str = String::from_utf8_lossy(&output.stdout);
    let parsed: serde_json::Value = serde_json::from_str(&json_str)?;

    let title = parsed["title"].as_str().unwrap_or("");
    let body = parsed["body"].as_str().unwrap_or("");
    let comments: Vec<&str> = parsed["comments"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|c| c["body"].as_str()).collect())
        .unwrap_or_default();

    let full_text = format!("{}\n{}", body, comments.join("\n"));

    println!("\n{}: #{} -- {}\n", "AUDIT".bold(), issue, title);

    let checks: Vec<(&str, &str)> = vec![
        ("Gherkin", r"Scenario:"),
        ("Acceptance", r"- \[[ x]\]"),
        ("Journey ID", r"J-[A-Z0-9]+(-[A-Z0-9]+)*"),
        ("data-testid", r"data-testid"),
        ("SQL", r"CREATE\s+(TABLE|FUNCTION|OR REPLACE FUNCTION)"),
        ("RLS", r"CREATE\s+POLICY|ENABLE\s+ROW\s+LEVEL\s+SECURITY"),
        ("Invariants", r"I-[A-Z]{2,}-\d+"),
        ("TypeScript", r"(?:interface|type)\s+\w+"),
        ("Scope", r"(?i)In Scope|Not In Scope"),
        ("DoD", r"(?i)Definition of Done|DoD"),
        ("Pre-flight", r"simulation_status:\s*\w+"),
    ];

    let max_name = checks.iter().map(|(n, _)| n.len()).max().unwrap_or(12);
    let mut pass_count = 0;

    for (name, pattern) in &checks {
        let re = Regex::new(pattern).unwrap();
        let matched = re.find(&full_text);
        let (icon, evidence) = if let Some(m) = matched {
            pass_count += 1;
            let text = if m.as_str().len() > 60 {
                format!("{}...", &m.as_str()[..57])
            } else {
                m.as_str().to_string()
            };
            ("PASS".green().to_string(), text)
        } else {
            ("FAIL".red().to_string(), "MISSING".to_string())
        };

        println!("  {} {:<width$}  {}", icon, name, evidence, width = max_name + 2);
    }

    println!("\n  {}/{} checks passed\n", pass_count, checks.len());

    if pass_count == checks.len() {
        println!("  {}\n", "VERDICT: Compliant".green().bold());
    } else if pass_count >= 4 {
        println!("  {}\n", "VERDICT: Needs uplift".yellow().bold());
    } else {
        println!(
            "  {}\n",
            "VERDICT: Non-compliant -- needs full specflow-writer pass"
                .red()
                .bold()
        );
    }

    Ok(())
}
