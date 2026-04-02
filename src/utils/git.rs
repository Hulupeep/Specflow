use anyhow::{Context, Result};
use std::path::Path;
use std::process::Command;

/// Check if a path is inside a git repository.
pub fn is_git_repo(dir: &Path) -> bool {
    Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .current_dir(dir)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Get the git root directory.
pub fn git_root(dir: &Path) -> Result<String> {
    let output = Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .current_dir(dir)
        .output()
        .context("Failed to run git rev-parse")?;

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Get issue numbers from recent git commits.
pub fn get_recent_issues(dir: &Path, count: usize) -> Result<Vec<String>> {
    let output = Command::new("git")
        .args([
            "log",
            &format!("-{}", count),
            "--pretty=format:%s %b",
        ])
        .current_dir(dir)
        .output()
        .context("Failed to run git log")?;

    let text = String::from_utf8_lossy(&output.stdout);
    let re = regex::Regex::new(r"#(\d+)").unwrap();

    let mut issues: Vec<String> = re
        .captures_iter(&text)
        .map(|c| c[1].to_string())
        .collect();
    issues.sort();
    issues.dedup();
    Ok(issues)
}

/// Get list of changed files (staged + unstaged).
pub fn get_changed_files(dir: &Path) -> Result<Vec<String>> {
    let output = Command::new("git")
        .args(["diff", "--name-only", "HEAD"])
        .current_dir(dir)
        .output()
        .context("Failed to run git diff")?;

    let text = String::from_utf8_lossy(&output.stdout);
    Ok(text.lines().filter(|l| !l.is_empty()).map(String::from).collect())
}

/// Check if the commit-msg hook is installed.
pub fn has_commit_msg_hook(dir: &Path) -> bool {
    let hook_path = Path::new(dir).join(".git/hooks/commit-msg");
    hook_path.exists() && is_executable(&hook_path)
}

fn is_executable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::metadata(path)
            .map(|m| m.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        path.exists()
    }
}
