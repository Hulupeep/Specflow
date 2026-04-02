use std::collections::HashMap;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

/// Metadata parsed from a YAML frontmatter block in an agent .md file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMeta {
    pub name: String,
    pub description: String,
    pub category: String,
    #[serde(default)]
    pub trigger: String,
    #[serde(default)]
    pub inputs: Vec<String>,
    #[serde(default)]
    pub outputs: Vec<String>,
    #[serde(default)]
    pub contracts: Vec<String>,
}

/// Summary view used for list/search results.
#[derive(Debug, Clone, Serialize)]
pub struct AgentSummary {
    pub name: String,
    pub description: String,
    pub category: String,
    pub trigger: String,
}

/// Full agent with metadata and markdown content.
#[derive(Debug, Clone, Serialize)]
pub struct Agent {
    pub meta: AgentMeta,
    pub file_path: PathBuf,
    pub content: String,
}

/// Category with agent count.
#[derive(Debug, Clone, Serialize)]
pub struct CategorySummary {
    pub category: String,
    pub count: usize,
}

/// In-memory index of all discovered agents.
pub struct AgentRegistry {
    agents: HashMap<String, Agent>,
}

/// Files to exclude from agent discovery.
const EXCLUDED_FILES: &[&str] = &[
    "README.md",
    "PROTOCOL.md",
    "WORKFLOW.md",
];

impl AgentRegistry {
    /// Scan an agents directory and build the registry.
    pub fn load(agents_dir: &Path) -> Result<Self> {
        let mut agents = HashMap::new();

        let pattern = agents_dir
            .join("*.md")
            .to_string_lossy()
            .to_string();

        for entry in glob::glob(&pattern).context("Invalid glob pattern")? {
            let path = entry.context("Failed to read glob entry")?;
            let file_name = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };

            if EXCLUDED_FILES.contains(&file_name.as_str()) {
                continue;
            }

            match parse_agent_file(&path) {
                Ok(agent) => {
                    agents.insert(agent.meta.name.clone(), agent);
                }
                Err(e) => {
                    eprintln!("Warning: skipping {}: {}", file_name, e);
                }
            }
        }

        Ok(AgentRegistry { agents })
    }

    /// List all agents, optionally filtered by category.
    pub fn list(&self, category: Option<&str>) -> Vec<AgentSummary> {
        let mut results: Vec<AgentSummary> = self
            .agents
            .values()
            .filter(|a| {
                category
                    .map(|c| a.meta.category.eq_ignore_ascii_case(c))
                    .unwrap_or(true)
            })
            .map(|a| AgentSummary {
                name: a.meta.name.clone(),
                description: a.meta.description.clone(),
                category: a.meta.category.clone(),
                trigger: a.meta.trigger.clone(),
            })
            .collect();
        results.sort_by(|a, b| a.category.cmp(&b.category).then(a.name.cmp(&b.name)));
        results
    }

    /// Get a single agent by exact name.
    pub fn get(&self, name: &str) -> Option<&Agent> {
        self.agents.get(name)
    }

    /// Search agents by query string. Scores across name, trigger, category, description.
    pub fn search(&self, query: &str) -> Vec<AgentSummary> {
        let tokens: Vec<String> = query.split_whitespace().map(|t| t.to_lowercase()).collect();
        if tokens.is_empty() {
            return self.list(None);
        }

        let mut scored: Vec<(i32, &Agent)> = self
            .agents
            .values()
            .filter_map(|agent| {
                let mut score: i32 = 0;
                let name_lower = agent.meta.name.to_lowercase();
                let trigger_lower = agent.meta.trigger.to_lowercase();
                let cat_lower = agent.meta.category.to_lowercase();
                let desc_lower = agent.meta.description.to_lowercase();

                for token in &tokens {
                    if name_lower.contains(token.as_str()) {
                        score += 3;
                    }
                    if trigger_lower.contains(token.as_str()) {
                        score += 2;
                    }
                    if cat_lower == *token {
                        score += 2;
                    }
                    if desc_lower.contains(token.as_str()) {
                        score += 1;
                    }
                }

                if score > 0 {
                    Some((score, agent))
                } else {
                    None
                }
            })
            .collect();

        scored.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.meta.name.cmp(&b.1.meta.name)));

        scored
            .into_iter()
            .map(|(_, a)| AgentSummary {
                name: a.meta.name.clone(),
                description: a.meta.description.clone(),
                category: a.meta.category.clone(),
                trigger: a.meta.trigger.clone(),
            })
            .collect()
    }

    /// List all distinct categories with counts.
    pub fn categories(&self) -> Vec<CategorySummary> {
        let mut counts: HashMap<String, usize> = HashMap::new();
        for agent in self.agents.values() {
            *counts.entry(agent.meta.category.clone()).or_insert(0) += 1;
        }
        let mut result: Vec<CategorySummary> = counts
            .into_iter()
            .map(|(category, count)| CategorySummary { category, count })
            .collect();
        result.sort_by(|a, b| a.category.cmp(&b.category));
        result
    }
}

/// Parse a single agent .md file: extract YAML frontmatter and markdown body.
fn parse_agent_file(path: &Path) -> Result<Agent> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("Failed to read {}", path.display()))?;

    let (meta, body) = parse_frontmatter(&content)
        .with_context(|| format!("Failed to parse frontmatter in {}", path.display()))?;

    Ok(Agent {
        meta,
        file_path: path.to_path_buf(),
        content: body,
    })
}

/// Split content into YAML frontmatter and markdown body.
fn parse_frontmatter(content: &str) -> Result<(AgentMeta, String)> {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        anyhow::bail!("No frontmatter found (file must start with ---)");
    }

    // Find the closing ---
    let after_first = &trimmed[3..];
    let end_pos = after_first
        .find("\n---")
        .ok_or_else(|| anyhow::anyhow!("No closing --- found for frontmatter"))?;

    let yaml_block = &after_first[..end_pos].trim();
    let body_start = end_pos + 4; // skip \n---
    let body = if body_start < after_first.len() {
        after_first[body_start..].trim_start_matches('\n').to_string()
    } else {
        String::new()
    };

    let meta: AgentMeta =
        serde_yaml::from_str(yaml_block).context("Invalid YAML in frontmatter")?;

    if meta.name.is_empty() {
        anyhow::bail!("Agent name is required");
    }
    if meta.description.is_empty() {
        anyhow::bail!("Agent description is required");
    }
    if meta.category.is_empty() {
        anyhow::bail!("Agent category is required");
    }

    Ok((meta, body))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_frontmatter() {
        let content = r#"---
name: test-agent
description: A test agent
category: testing
trigger: Run test
inputs:
  - input1
outputs:
  - output1
contracts: []
---

# Test Agent

Body content here.
"#;
        let (meta, body) = parse_frontmatter(content).unwrap();
        assert_eq!(meta.name, "test-agent");
        assert_eq!(meta.category, "testing");
        assert!(body.contains("# Test Agent"));
    }

    #[test]
    fn test_parse_frontmatter_no_frontmatter() {
        let content = "# No frontmatter here";
        assert!(parse_frontmatter(content).is_err());
    }
}
