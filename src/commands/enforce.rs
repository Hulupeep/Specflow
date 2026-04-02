use anyhow::{Result, bail};
use std::path::PathBuf;

use crate::contracts::loader::load_contracts_from_dir;
use crate::contracts::reporter;
use crate::contracts::scanner::scan_project;

pub fn run(dir: Option<&str>, json_output: bool) -> Result<()> {
    let project_root = PathBuf::from(dir.unwrap_or("."));
    let project_root = std::fs::canonicalize(&project_root).unwrap_or(project_root);

    let contracts_dir = project_root.join("docs/contracts");
    if !contracts_dir.exists() {
        bail!(
            "No contract directory found at {}. Run `specflow init` first.",
            contracts_dir.display()
        );
    }

    let contracts = load_contracts_from_dir(&contracts_dir)?;
    if contracts.is_empty() {
        bail!("No contracts found in {}", contracts_dir.display());
    }

    let result = scan_project(&project_root, &contracts)?;

    if json_output {
        reporter::print_json(&result);
    } else {
        reporter::print_human(&result, &project_root);
    }

    if !result.violations.is_empty() {
        std::process::exit(1);
    }

    Ok(())
}
