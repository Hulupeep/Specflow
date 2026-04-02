use anyhow::{Context, Result};
use std::fs;
use std::path::Path;

/// Create a directory and all parent directories if they don't exist.
/// Returns true if the directory was created, false if it already existed.
pub fn ensure_dir(path: &Path) -> Result<bool> {
    if path.exists() {
        Ok(false)
    } else {
        fs::create_dir_all(path)
            .with_context(|| format!("Failed to create directory: {}", path.display()))?;
        Ok(true)
    }
}

/// Copy a file, creating parent directories as needed.
pub fn copy_file(src: &Path, dst: &Path) -> Result<()> {
    if let Some(parent) = dst.parent() {
        ensure_dir(parent)?;
    }
    fs::copy(src, dst)
        .with_context(|| format!("Failed to copy {} -> {}", src.display(), dst.display()))?;
    Ok(())
}

/// Check if a directory contains files matching a glob pattern.
pub fn dir_has_files(dir: &Path, extension: &str) -> bool {
    if !dir.exists() {
        return false;
    }
    let pattern = dir.join(format!("*.{}", extension));
    glob::glob(&pattern.to_string_lossy())
        .map(|entries| entries.flatten().next().is_some())
        .unwrap_or(false)
}

/// Count files matching a glob pattern in a directory.
pub fn count_files(dir: &Path, extension: &str) -> usize {
    if !dir.exists() {
        return 0;
    }
    let pattern = dir.join(format!("*.{}", extension));
    glob::glob(&pattern.to_string_lossy())
        .map(|entries| entries.flatten().count())
        .unwrap_or(0)
}
