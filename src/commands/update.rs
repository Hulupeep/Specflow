use anyhow::{Context, Result};
use colored::Colorize;
use serde_json::json;
use std::path::PathBuf;

pub fn run(dir: Option<&str>, ci: bool) -> Result<()> {
    let target = PathBuf::from(dir.unwrap_or("."));
    let target = std::fs::canonicalize(&target).unwrap_or(target);

    println!();
    println!("{}", "Specflow Update".bold());
    println!("Target: {}", target.display().to_string().cyan());
    println!();

    // 1. Ensure .claude directory exists
    let claude_dir = target.join(".claude");
    std::fs::create_dir_all(&claude_dir)?;

    // 2. Read or create .claude/settings.json
    let settings_path = claude_dir.join("settings.json");
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path)
            .context("Failed to read settings.json")?;
        serde_json::from_str(&content).unwrap_or(json!({}))
    } else {
        json!({})
    };

    // 3. Merge Specflow hook entries
    let specflow_hooks = json!({
        "PostToolUse": [
            {
                "matcher": "Bash",
                "hooks": [
                    {
                        "type": "command",
                        "command": "specflow hook post-build"
                    }
                ]
            },
            {
                "matcher": "Write|Edit",
                "hooks": [
                    {
                        "type": "command",
                        "command": "specflow hook compliance"
                    }
                ]
            }
        ]
    });

    settings["hooks"] = specflow_hooks;

    std::fs::write(
        &settings_path,
        serde_json::to_string_pretty(&settings)?,
    )
    .context("Failed to write settings.json")?;

    println!("  {} Updated .claude/settings.json with hooks", "+".green());

    // 4. Install git commit-msg hook
    let git_hooks_dir = target.join(".git/hooks");
    if git_hooks_dir.exists() {
        let commit_msg_hook = git_hooks_dir.join("commit-msg");
        let hook_content = r#"#!/bin/sh
# Specflow commit-msg hook: require issue number in commit message
MSG=$(cat "$1")
if ! echo "$MSG" | grep -qE '#[0-9]+'; then
    echo ""
    echo "ERROR: Commit message must reference a GitHub issue (e.g. #42)"
    echo "  Your message: $MSG"
    echo ""
    echo "Usage: git commit -m \"feat: description (#42)\""
    exit 1
fi
"#;
        std::fs::write(&commit_msg_hook, hook_content)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&commit_msg_hook, std::fs::Permissions::from_mode(0o755))?;
        }
        println!("  {} Installed git commit-msg hook", "+".green());
    }

    // 5. Optionally install CI workflows
    if ci {
        let workflows_dir = target.join(".github/workflows");
        std::fs::create_dir_all(&workflows_dir)?;

        let ci_workflow = r#"name: Specflow Contract Enforcement
on: [pull_request]
jobs:
  enforce:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install specflow
        run: cargo install --path .
      - name: Enforce contracts
        run: specflow enforce --json
"#;
        let workflow_path = workflows_dir.join("specflow-enforce.yml");
        if !workflow_path.exists() {
            std::fs::write(&workflow_path, ci_workflow)?;
            println!("  {} Created .github/workflows/specflow-enforce.yml", "+".green());
        }
    }

    println!();
    println!("{}", "Update complete!".green().bold());
    println!();

    Ok(())
}
