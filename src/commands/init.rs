use anyhow::{Context, Result};
use colored::Colorize;
use serde_json::json;
use std::path::PathBuf;

use crate::utils::fs as fsutil;

pub fn run(target_dir: Option<&str>, json_output: bool) -> Result<()> {
    let target = PathBuf::from(target_dir.unwrap_or("."));
    let target = std::fs::canonicalize(&target).unwrap_or(target);

    if !json_output {
        println!();
        println!("{}", "Specflow Project Setup".bold());
        println!("Target: {}", target.display().to_string().cyan());
        println!();
    }

    let specflow_root = find_specflow_root()?;
    let mut steps = Vec::new();

    // 1. Create directory structure
    let dirs = [
        "docs/contracts",
        "tests/contracts",
        "tests/e2e",
        ".specflow",
        ".claude",
    ];
    for dir in &dirs {
        let path = target.join(dir);
        let created = fsutil::ensure_dir(&path)?;
        if created && !json_output {
            println!("  {} Created {}", "+".green(), dir);
        }
    }
    steps.push("directories");

    // 2. Copy default contract templates
    let templates_dir = specflow_root.join("templates/contracts");
    if templates_dir.exists() {
        let contracts_dir = target.join("docs/contracts");
        let mut copied = 0;
        for entry in glob::glob(&templates_dir.join("*.yml").to_string_lossy())?.flatten() {
            let filename = entry.file_name().unwrap();
            let dest = contracts_dir.join(filename);
            if !dest.exists() {
                fsutil::copy_file(&entry, &dest)?;
                copied += 1;
            }
        }
        if !json_output && copied > 0 {
            println!("  {} Copied {} default contracts", "+".green(), copied);
        }
        steps.push("contracts");
    }

    // 3. Generate CLAUDE.md from template
    let claude_md = target.join("CLAUDE.md");
    if !claude_md.exists() {
        let template_path = specflow_root.join("CLAUDE-MD-TEMPLATE.md");
        if template_path.exists() {
            std::fs::copy(&template_path, &claude_md)
                .context("Failed to copy CLAUDE.md template")?;
            if !json_output {
                println!("  {} Generated CLAUDE.md from template", "+".green());
            }
        }
    }
    steps.push("claude_md");

    // 4. Create .claude/settings.json with hook config
    let settings_path = target.join(".claude/settings.json");
    if !settings_path.exists() {
        let settings = generate_hook_settings();
        std::fs::write(&settings_path, serde_json::to_string_pretty(&settings)?)
            .context("Failed to write .claude/settings.json")?;
        if !json_output {
            println!("  {} Created .claude/settings.json with hooks", "+".green());
        }
    }
    steps.push("settings");

    // 5. Create .specflow/baseline.json
    let baseline = target.join(".specflow/baseline.json");
    if !baseline.exists() {
        std::fs::write(&baseline, "{}\n")
            .context("Failed to write baseline.json")?;
    }

    // 6. Create .claude/.defer-journal
    let defer_journal = target.join(".claude/.defer-journal");
    if !defer_journal.exists() {
        std::fs::write(&defer_journal, "")
            .context("Failed to write .defer-journal")?;
    }

    // 7. Install git commit-msg hook
    let git_hooks_dir = target.join(".git/hooks");
    if git_hooks_dir.exists() {
        let commit_msg_hook = git_hooks_dir.join("commit-msg");
        if !commit_msg_hook.exists() {
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
            if !json_output {
                println!("  {} Installed git commit-msg hook", "+".green());
            }
        }
        steps.push("git_hook");
    }

    if json_output {
        let output = json!({
            "status": "success",
            "target": target.display().to_string(),
            "steps_completed": steps,
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!();
        println!("{}", "Setup complete!".green().bold());
        println!();
        println!("Next steps:");
        println!("  1. Run {} to verify", "specflow doctor".cyan());
        println!("  2. Run {} to check contracts", "specflow enforce".cyan());
        println!("  3. Commit with issue numbers: git commit -m \"feat: ... (#42)\"");
        println!();
    }

    Ok(())
}

fn find_specflow_root() -> Result<PathBuf> {
    // Check common locations for the specflow toolkit
    let candidates = [
        // Running from within the specflow repo itself
        PathBuf::from("."),
        // Installed via npm — look for the package
        PathBuf::from("node_modules/@colmbyrne/specflow"),
        PathBuf::from("node_modules/specflow"),
    ];

    for candidate in &candidates {
        if candidate.join("templates/contracts").exists() {
            return Ok(std::fs::canonicalize(candidate).unwrap_or(candidate.clone()));
        }
    }

    // Try the binary's own directory
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            // Binary might be in target/release/ — go up to repo root
            for ancestor in parent.ancestors().take(5) {
                if ancestor.join("templates/contracts").exists() {
                    return Ok(ancestor.to_path_buf());
                }
            }
        }
    }

    // Default to current directory
    Ok(PathBuf::from("."))
}

fn generate_hook_settings() -> serde_json::Value {
    json!({
        "hooks": {
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
        }
    })
}
