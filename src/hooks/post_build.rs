use anyhow::Result;
use regex::Regex;
use serde::Deserialize;
use std::io::Read;
use std::process::Command;

#[derive(Debug, Deserialize)]
struct HookInput {
    #[serde(default)]
    inputs: Option<HookInputs>,
    #[serde(default)]
    response: Option<HookResponse>,
}

#[derive(Debug, Deserialize)]
struct HookInputs {
    #[serde(default)]
    command: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HookResponse {
    #[serde(alias = "exitCode")]
    #[serde(default)]
    exit_code: Option<i32>,
}

/// Read JSON from stdin and detect build/commit commands.
/// If a successful build or commit is detected, run journey tests.
pub fn run() -> Result<i32> {
    let mut input = String::new();
    std::io::stdin().read_to_string(&mut input)?;

    if input.trim().is_empty() {
        return Ok(0);
    }

    let hook: HookInput = serde_json::from_str(&input).unwrap_or(HookInput {
        inputs: None,
        response: None,
    });

    let command = match &hook.inputs {
        Some(i) => i.command.clone().unwrap_or_default(),
        None => return Ok(0),
    };

    if command.is_empty() {
        return Ok(0);
    }

    let is_build = is_build_command(&command);
    let is_commit = command.contains("git commit");

    if !is_build && !is_commit {
        return Ok(0);
    }

    // Check if the command was successful
    let exit_code = hook
        .response
        .as_ref()
        .and_then(|r| r.exit_code);

    match exit_code {
        Some(0) => {}
        Some(_) => return Ok(0),
        None => {
            eprintln!("Warning: could not determine build exit code -- skipping tests");
            return Ok(0);
        }
    }

    eprintln!("Build/commit detected. Running journey tests...");

    let project_dir = std::env::var("CLAUDE_PROJECT_DIR")
        .unwrap_or_else(|_| ".".to_string());

    // Try to run the journey test hook
    let journey_script = format!("{}/.claude/hooks/run-journey-tests.sh", project_dir);
    if std::path::Path::new(&journey_script).exists() {
        let status = Command::new("bash")
            .arg(&journey_script)
            .status();

        match status {
            Ok(s) if s.success() => Ok(0),
            Ok(_) => Ok(2),
            Err(e) => {
                eprintln!("Failed to run journey tests: {}", e);
                Ok(2)
            }
        }
    } else {
        eprintln!("Warning: run-journey-tests.sh not found -- skipping journey tests");
        Ok(0)
    }
}

fn is_build_command(cmd: &str) -> bool {
    let patterns = Regex::new(
        r"(npm run build|pnpm( run)? build|yarn build|vite build|next build|turbo( run)? build|make build|cargo build|go build|gradle build|mvn (package|compile)|\btsc\b|\bwebpack\b)"
    ).unwrap();
    patterns.is_match(cmd)
}
