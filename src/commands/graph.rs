use anyhow::{Context, Result, bail};
use std::process::Command;

/// Validate contract graph integrity by calling the Node.js script.
pub fn run(contracts_dir: Option<&str>) -> Result<()> {
    let dir = contracts_dir.unwrap_or("docs/contracts");
    let script = "scripts/verify-graph.cjs";

    if !std::path::Path::new(script).exists() {
        bail!(
            "Graph verification script not found: {}. Are you in the specflow root?",
            script
        );
    }

    let status = Command::new("node")
        .args([script, dir])
        .status()
        .context("Failed to run graph verification")?;

    if !status.success() {
        std::process::exit(status.code().unwrap_or(1));
    }

    Ok(())
}
