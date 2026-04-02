use anyhow::{Context, Result, bail};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

// ── YAML schema structs ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractFile {
    pub contract_meta: ContractMeta,
    #[serde(default)]
    pub llm_policy: Option<LlmPolicy>,
    #[serde(default)]
    pub rules: Option<Rules>,
    #[serde(default)]
    pub compliance_checklist: Option<serde_yaml::Value>,
    #[serde(default)]
    pub test_hooks: Option<serde_yaml::Value>,
    #[serde(default)]
    pub defaults: Option<serde_yaml::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractMeta {
    pub id: String,
    #[serde(default)]
    pub version: Option<serde_yaml::Value>,
    #[serde(default)]
    pub created_from_spec: Option<String>,
    #[serde(default)]
    pub covers_reqs: Vec<String>,
    #[serde(default)]
    pub owner: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmPolicy {
    #[serde(default)]
    pub enforce: Option<bool>,
    #[serde(default)]
    pub llm_may_modify_non_negotiables: Option<bool>,
    #[serde(default)]
    pub override_phrase: Option<String>,
    #[serde(default)]
    pub severity: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rules {
    #[serde(default)]
    pub non_negotiable: Vec<Rule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub scope: Vec<String>,
    #[serde(default)]
    pub behavior: Option<RuleBehavior>,
    #[serde(default)]
    pub example_violation: Option<String>,
    #[serde(default)]
    pub example_compliant: Option<String>,
    #[serde(default)]
    pub enabled_by_default: Option<bool>,
    #[serde(default)]
    pub configurable: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleBehavior {
    #[serde(default)]
    pub forbidden_patterns: Vec<PatternEntry>,
    #[serde(default)]
    pub required_patterns: Vec<PatternEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternEntry {
    pub pattern: serde_yaml::Value,
    pub message: String,
}

// ── Compiled contract structs ───────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct CompiledContract {
    pub meta: ContractMeta,
    pub source_file: PathBuf,
    pub rules: Vec<CompiledRule>,
}

#[derive(Debug, Clone)]
pub struct CompiledRule {
    pub id: String,
    pub title: String,
    pub scope: Vec<String>,
    pub forbidden: Vec<CompiledPattern>,
    pub required: Vec<CompiledPattern>,
}

#[derive(Debug, Clone)]
pub struct CompiledPattern {
    pub regex: Regex,
    pub message: String,
    pub raw: String,
}

// ── Pattern parsing ─────────────────────────────────────────────────────────

/// Parse a YAML pattern string like `/regex/flags` into a compiled Regex.
/// Handles the `i` flag (case-insensitive). Other JS flags are ignored
/// since the Rust regex crate doesn't support them directly.
pub fn parse_yaml_pattern(pattern_val: &serde_yaml::Value) -> Result<(Regex, String)> {
    let pattern_str = match pattern_val {
        serde_yaml::Value::String(s) => s.clone(),
        other => format!("{}", serde_yaml::to_string(other).unwrap_or_default().trim()),
    };

    let trimmed = pattern_str.trim();

    // Expected format: /pattern/flags
    let re = Regex::new(r"^/(.+)/([gimsuy]*)$").unwrap();
    if let Some(caps) = re.captures(trimmed) {
        let body = &caps[1];
        let flags = &caps[2];

        let mut rust_pattern = String::new();
        if flags.contains('i') {
            rust_pattern.push_str("(?i)");
        }
        if flags.contains('s') {
            rust_pattern.push_str("(?s)");
        }
        if flags.contains('m') {
            rust_pattern.push_str("(?m)");
        }
        rust_pattern.push_str(body);

        let compiled = Regex::new(&rust_pattern)
            .with_context(|| format!("Failed to compile regex pattern: {}", trimmed))?;
        return Ok((compiled, trimmed.to_string()));
    }

    // Try as a raw regex string (no delimiters)
    let compiled = Regex::new(trimmed)
        .with_context(|| format!("Failed to compile regex pattern: {}", trimmed))?;
    Ok((compiled, trimmed.to_string()))
}

// ── Contract loading ────────────────────────────────────────────────────────

/// Load and compile a single contract YAML file.
pub fn load_contract(path: &Path) -> Result<CompiledContract> {
    let content = fs::read_to_string(path)
        .with_context(|| format!("Failed to read contract file: {}", path.display()))?;

    let contract_file: ContractFile = serde_yaml::from_str(&content)
        .with_context(|| format!("Failed to parse YAML in: {}", path.display()))?;

    let rules = if let Some(rules) = &contract_file.rules {
        rules
            .non_negotiable
            .iter()
            .map(|rule| compile_rule(rule, path))
            .collect::<Result<Vec<_>>>()?
    } else {
        vec![]
    };

    Ok(CompiledContract {
        meta: contract_file.contract_meta,
        source_file: path.to_path_buf(),
        rules,
    })
}

fn compile_rule(rule: &Rule, contract_path: &Path) -> Result<CompiledRule> {
    let behavior = rule.behavior.as_ref();

    let forbidden = behavior
        .map(|b| {
            b.forbidden_patterns
                .iter()
                .map(|p| compile_pattern(p, &rule.id, contract_path))
                .collect::<Result<Vec<_>>>()
        })
        .transpose()?
        .unwrap_or_default();

    let required = behavior
        .map(|b| {
            b.required_patterns
                .iter()
                .map(|p| compile_pattern(p, &rule.id, contract_path))
                .collect::<Result<Vec<_>>>()
        })
        .transpose()?
        .unwrap_or_default();

    Ok(CompiledRule {
        id: rule.id.clone(),
        title: rule.title.clone().unwrap_or_default(),
        scope: rule.scope.clone(),
        forbidden,
        required,
    })
}

fn compile_pattern(entry: &PatternEntry, rule_id: &str, contract_path: &Path) -> Result<CompiledPattern> {
    let (regex, raw) = parse_yaml_pattern(&entry.pattern).with_context(|| {
        format!(
            "In rule {} of {}: invalid pattern",
            rule_id,
            contract_path.display()
        )
    })?;
    Ok(CompiledPattern {
        regex,
        message: entry.message.clone(),
        raw,
    })
}

/// Load all contract YAML files from a directory.
pub fn load_contracts_from_dir(dir: &Path) -> Result<Vec<CompiledContract>> {
    if !dir.exists() {
        bail!("Contract directory does not exist: {}", dir.display());
    }

    let mut contracts = Vec::new();
    let pattern = dir.join("*.yml");
    let pattern_str = pattern.to_string_lossy();

    for entry in glob::glob(&pattern_str)
        .with_context(|| format!("Invalid glob pattern: {}", pattern_str))?
    {
        let path = entry.with_context(|| "Failed to read glob entry")?;
        match load_contract(&path) {
            Ok(c) => contracts.push(c),
            Err(e) => {
                eprintln!("Warning: failed to load {}: {}", path.display(), e);
            }
        }
    }

    // Also check .yaml extension
    let pattern_yaml = dir.join("*.yaml");
    let pattern_yaml_str = pattern_yaml.to_string_lossy();
    for entry in glob::glob(&pattern_yaml_str)
        .with_context(|| format!("Invalid glob pattern: {}", pattern_yaml_str))?
    {
        let path = entry.with_context(|| "Failed to read glob entry")?;
        match load_contract(&path) {
            Ok(c) => contracts.push(c),
            Err(e) => {
                eprintln!("Warning: failed to load {}: {}", path.display(), e);
            }
        }
    }

    Ok(contracts)
}
