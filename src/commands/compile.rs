use anyhow::{Context, Result, bail};
use std::process::Command;

/// Wraps the Node.js compiler: node scripts/specflow-compile.cjs
pub fn run(args: &[String]) -> Result<()> {
    let script = "scripts/specflow-compile.cjs";

    if !std::path::Path::new(script).exists() {
        bail!(
            "Compiler script not found: {}. Are you in the specflow root?",
            script
        );
    }

    let mut cmd = Command::new("node");
    cmd.arg(script);
    cmd.args(args);

    let status = cmd.status().context("Failed to run node compiler")?;

    if !status.success() {
        std::process::exit(status.code().unwrap_or(1));
    }

    Ok(())
}
