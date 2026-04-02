use serde_json::{json, Value};
use std::path::Path;

use crate::agents::registry::AgentRegistry;
use crate::contracts::loader::{load_contract, load_contracts_from_dir};
use crate::contracts::scanner;

use super::protocol::{ToolCallResult, ToolDefinition};

// ── Tool definitions (tools/list) ─────────────────────────────────────────

pub fn tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "specflow_list_contracts".into(),
            description: "List all contracts in a directory with their rules".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "dir": {
                        "type": "string",
                        "description": "Contracts directory (defaults to docs/contracts)"
                    }
                }
            }),
        },
        ToolDefinition {
            name: "specflow_check_code".into(),
            description: "Check a code snippet against all loaded contracts".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "The code to check"
                    },
                    "file_path": {
                        "type": "string",
                        "description": "Optional virtual file path for scope matching"
                    }
                },
                "required": ["code"]
            }),
        },
        ToolDefinition {
            name: "specflow_get_violations".into(),
            description: "Scan a file or directory for contract violations".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "File or directory path to scan"
                    }
                },
                "required": ["path"]
            }),
        },
        ToolDefinition {
            name: "specflow_validate_contract".into(),
            description: "Validate a contract YAML file for correctness".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "file": {
                        "type": "string",
                        "description": "Path to the contract YAML file"
                    }
                },
                "required": ["file"]
            }),
        },
        ToolDefinition {
            name: "specflow_audit_issue".into(),
            description: "Audit a GitHub issue for specflow compliance markers".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "issue_number": {
                        "type": "integer",
                        "description": "GitHub issue number to audit"
                    }
                },
                "required": ["issue_number"]
            }),
        },
        ToolDefinition {
            name: "specflow_compile_journeys".into(),
            description: "Compile journey contracts from a CSV file".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "csv_file": {
                        "type": "string",
                        "description": "Path to the journey CSV file"
                    }
                },
                "required": ["csv_file"]
            }),
        },
        ToolDefinition {
            name: "specflow_verify_graph".into(),
            description: "Verify contract graph integrity".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "dir": {
                        "type": "string",
                        "description": "Contracts directory (defaults to docs/contracts)"
                    }
                }
            }),
        },
        ToolDefinition {
            name: "specflow_list_agents".into(),
            description: "List all available agents with their metadata".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Filter by category (orchestration, compliance, testing, generation, lifecycle, remediation, documentation)"
                    }
                }
            }),
        },
        ToolDefinition {
            name: "specflow_get_agent".into(),
            description: "Get full agent prompt and metadata by name".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Agent name (e.g. waves-controller, board-auditor)"
                    }
                },
                "required": ["name"]
            }),
        },
        ToolDefinition {
            name: "specflow_defer_journey".into(),
            description: "Defer or undefer a journey contract".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "journey_id": {
                        "type": "string",
                        "description": "Journey identifier (e.g. J-SIGNUP-FLOW)"
                    },
                    "reason": {
                        "type": "string",
                        "description": "Reason for deferral"
                    },
                    "issue": {
                        "type": "string",
                        "description": "Related issue reference"
                    },
                    "action": {
                        "type": "string",
                        "enum": ["defer", "undefer"],
                        "description": "Whether to defer or undefer"
                    }
                },
                "required": ["journey_id", "reason", "action"]
            }),
        },
    ]
}

// ── Tool dispatch ─────────────────────────────────────────────────────────

pub fn call_tool(name: &str, args: &Value) -> ToolCallResult {
    match name {
        "specflow_list_contracts" => handle_list_contracts(args),
        "specflow_check_code" => handle_check_code(args),
        "specflow_get_violations" => handle_get_violations(args),
        "specflow_validate_contract" => handle_validate_contract(args),
        "specflow_audit_issue" => handle_audit_issue(args),
        "specflow_compile_journeys" => handle_compile_journeys(args),
        "specflow_verify_graph" => handle_verify_graph(args),
        "specflow_list_agents" => handle_list_agents(args),
        "specflow_get_agent" => handle_get_agent(args),
        "specflow_defer_journey" => handle_defer_journey(args),
        _ => ToolCallResult::error(format!("Unknown tool: {}", name)),
    }
}

// ── Tool handlers ─────────────────────────────────────────────────────────

fn handle_list_contracts(args: &Value) -> ToolCallResult {
    let dir = args["dir"]
        .as_str()
        .unwrap_or("docs/contracts");
    let dir_path = Path::new(dir);

    match load_contracts_from_dir(dir_path) {
        Ok(contracts) => {
            let mut total_rules = 0;
            let contract_list: Vec<Value> = contracts
                .iter()
                .map(|c| {
                    let rule_ids: Vec<String> = c.rules.iter().map(|r| r.id.clone()).collect();
                    total_rules += rule_ids.len();
                    json!({
                        "id": c.meta.id,
                        "file": c.source_file.to_string_lossy(),
                        "rules": rule_ids.len(),
                        "rule_ids": rule_ids
                    })
                })
                .collect();

            let result = json!({
                "contracts": contract_list,
                "total_contracts": contracts.len(),
                "total_rules": total_rules
            });
            ToolCallResult::text(serde_json::to_string_pretty(&result).unwrap())
        }
        Err(e) => ToolCallResult::error(format!("Failed to load contracts: {}", e)),
    }
}

fn handle_check_code(args: &Value) -> ToolCallResult {
    let code = match args["code"].as_str() {
        Some(c) => c,
        None => return ToolCallResult::error("Missing required parameter: code".into()),
    };
    let file_path = args["file_path"].as_str().unwrap_or("inline.ts");

    // Load contracts from default location
    let contracts = match load_contracts_from_dir(Path::new("docs/contracts")) {
        Ok(c) => c,
        Err(e) => return ToolCallResult::error(format!("Failed to load contracts: {}", e)),
    };

    let mut violations = Vec::new();
    let mut rules_checked = 0;

    for contract in &contracts {
        for rule in &contract.rules {
            // Check if file_path matches any scope pattern
            let in_scope = rule.scope.is_empty()
                || rule.scope.iter().any(|s| {
                    !s.starts_with('!')
                        && glob::Pattern::new(s)
                            .map(|p| p.matches(file_path))
                            .unwrap_or(false)
                });

            if !in_scope {
                continue;
            }
            rules_checked += 1;

            // Check forbidden patterns
            for pattern in &rule.forbidden {
                for (line_idx, line) in code.lines().enumerate() {
                    if let Some(m) = pattern.regex.find(line) {
                        violations.push(json!({
                            "contract": contract.meta.id,
                            "rule": rule.id,
                            "pattern": pattern.raw,
                            "match": m.as_str(),
                            "line": line_idx + 1,
                            "message": pattern.message
                        }));
                    }
                }
            }

            // Check required patterns
            for pattern in &rule.required {
                if !pattern.regex.is_match(code) {
                    violations.push(json!({
                        "contract": contract.meta.id,
                        "rule": rule.id,
                        "pattern": pattern.raw,
                        "match": "",
                        "line": 0,
                        "message": pattern.message
                    }));
                }
            }
        }
    }

    let rules_passed = rules_checked - violations.len();
    let result = json!({
        "clean": violations.is_empty(),
        "violations": violations,
        "rules_checked": rules_checked,
        "rules_passed": rules_passed
    });
    ToolCallResult::text(serde_json::to_string_pretty(&result).unwrap())
}

fn handle_get_violations(args: &Value) -> ToolCallResult {
    let path = match args["path"].as_str() {
        Some(p) => p,
        None => return ToolCallResult::error("Missing required parameter: path".into()),
    };
    let scan_path = Path::new(path);

    // Load contracts
    let contracts = match load_contracts_from_dir(Path::new("docs/contracts")) {
        Ok(c) => c,
        Err(e) => return ToolCallResult::error(format!("Failed to load contracts: {}", e)),
    };

    // Determine project root (parent of the path, or the path itself if dir)
    let project_root = if scan_path.is_dir() {
        scan_path
    } else {
        scan_path.parent().unwrap_or(Path::new("."))
    };

    match scanner::scan_project(project_root, &contracts) {
        Ok(result) => {
            let violation_list: Vec<Value> = result
                .violations
                .iter()
                .map(|v| {
                    json!({
                        "contract": v.contract_id,
                        "rule": v.rule_id,
                        "file": v.file.to_string_lossy(),
                        "line": v.line,
                        "pattern": v.pattern,
                        "match": v.matched_text,
                        "message": v.message,
                        "kind": format!("{:?}", v.kind)
                    })
                })
                .collect();

            let files_violated = result
                .violations
                .iter()
                .map(|v| v.file.clone())
                .collect::<std::collections::HashSet<_>>()
                .len();

            let output = json!({
                "scanned_files": result.files_scanned,
                "violations": violation_list,
                "summary": {
                    "files_clean": result.files_scanned.saturating_sub(files_violated),
                    "files_violated": files_violated,
                    "total_violations": result.violations.len()
                }
            });
            ToolCallResult::text(serde_json::to_string_pretty(&output).unwrap())
        }
        Err(e) => ToolCallResult::error(format!("Scan failed: {}", e)),
    }
}

fn handle_validate_contract(args: &Value) -> ToolCallResult {
    let file = match args["file"].as_str() {
        Some(f) => f,
        None => return ToolCallResult::error("Missing required parameter: file".into()),
    };
    let path = Path::new(file);

    if !path.exists() {
        return ToolCallResult::error(format!("File not found: {}", file));
    }

    let mut errors: Vec<String> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();

    // Try to load and compile the contract
    match load_contract(path) {
        Ok(contract) => {
            let rules_found = contract.rules.len();
            let mut patterns_compiled = 0;

            for rule in &contract.rules {
                patterns_compiled += rule.forbidden.len() + rule.required.len();

                if rule.scope.is_empty() {
                    warnings.push(format!("Rule {} has no scope patterns", rule.id));
                }
                if rule.title.is_empty() {
                    warnings.push(format!("Rule {} has no title", rule.id));
                }
            }

            if contract.meta.id.is_empty() {
                errors.push("contract_meta.id is empty".into());
            }

            let result = json!({
                "valid": errors.is_empty(),
                "errors": errors,
                "warnings": warnings,
                "rules_found": rules_found,
                "patterns_compiled": patterns_compiled
            });
            ToolCallResult::text(serde_json::to_string_pretty(&result).unwrap())
        }
        Err(e) => {
            errors.push(format!("Parse error: {}", e));
            let result = json!({
                "valid": false,
                "errors": errors,
                "warnings": warnings,
                "rules_found": 0,
                "patterns_compiled": 0
            });
            ToolCallResult::text(serde_json::to_string_pretty(&result).unwrap())
        }
    }
}

fn handle_audit_issue(args: &Value) -> ToolCallResult {
    let issue_number = match args["issue_number"].as_u64() {
        Some(n) => n,
        None => return ToolCallResult::error("Missing required parameter: issue_number".into()),
    };

    // Fetch issue via gh CLI
    let output = std::process::Command::new("gh")
        .args([
            "issue",
            "view",
            &issue_number.to_string(),
            "--json",
            "title,body,comments",
        ])
        .output();

    let output = match output {
        Ok(o) if o.status.success() => o,
        _ => {
            return ToolCallResult::error(format!(
                "Could not fetch issue #{}. Is gh authenticated?",
                issue_number
            ))
        }
    };

    let json_str = String::from_utf8_lossy(&output.stdout);
    let parsed: Value = match serde_json::from_str(&json_str) {
        Ok(v) => v,
        Err(e) => return ToolCallResult::error(format!("Failed to parse gh output: {}", e)),
    };

    let title = parsed["title"].as_str().unwrap_or("");
    let body = parsed["body"].as_str().unwrap_or("");
    let comments: Vec<&str> = parsed["comments"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|c| c["body"].as_str()).collect())
        .unwrap_or_default();

    let full_text = format!("{}\n{}", body, comments.join("\n"));

    let checks_spec: Vec<(&str, &str)> = vec![
        ("gherkin", r"Scenario:"),
        ("acceptance_criteria", r"- \[[ x]\]"),
        ("journey_id", r"J-[A-Z0-9]+(-[A-Z0-9]+)*"),
        ("data_testid", r"data-testid"),
        ("sql_schema", r"CREATE\s+(TABLE|FUNCTION|OR REPLACE FUNCTION)"),
        ("rls_policy", r"CREATE\s+POLICY|ENABLE\s+ROW\s+LEVEL\s+SECURITY"),
        ("invariants", r"I-[A-Z]{2,}-\d+"),
        ("typescript_types", r"(?:interface|type)\s+\w+"),
        ("scope_section", r"(?i)In Scope|Not In Scope"),
        ("definition_of_done", r"(?i)Definition of Done|DoD"),
        ("preflight", r"simulation_status:\s*\w+"),
    ];

    let mut checks = serde_json::Map::new();
    let mut missing = Vec::new();

    for (name, pattern) in &checks_spec {
        let re = regex::Regex::new(pattern).unwrap();
        let found = re.is_match(&full_text);
        checks.insert(
            name.to_string(),
            json!({ "found": found }),
        );
        if !found {
            missing.push(name.to_string());
        }
    }

    let compliant = missing.is_empty();
    let result = json!({
        "issue": issue_number,
        "title": title,
        "compliant": compliant,
        "checks": checks,
        "missing": missing
    });
    ToolCallResult::text(serde_json::to_string_pretty(&result).unwrap())
}

fn handle_compile_journeys(args: &Value) -> ToolCallResult {
    let csv_file = match args["csv_file"].as_str() {
        Some(f) => f,
        None => return ToolCallResult::error("Missing required parameter: csv_file".into()),
    };

    // Delegate to the Node.js compiler
    let script = "scripts/specflow-compile.cjs";
    if !Path::new(script).exists() {
        return ToolCallResult::error(format!(
            "Compiler script not found: {}. Are you in the specflow root?",
            script
        ));
    }

    let output = std::process::Command::new("node")
        .args([script, csv_file])
        .output();

    match output {
        Ok(o) if o.status.success() => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            // Try to parse as JSON; otherwise wrap the output
            if let Ok(parsed) = serde_json::from_str::<Value>(&stdout) {
                ToolCallResult::text(serde_json::to_string_pretty(&parsed).unwrap())
            } else {
                let result = json!({
                    "contracts_generated": 0,
                    "test_stubs_generated": 0,
                    "files": [],
                    "raw_output": stdout.trim()
                });
                ToolCallResult::text(serde_json::to_string_pretty(&result).unwrap())
            }
        }
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr);
            ToolCallResult::error(format!("Compiler failed: {}", stderr.trim()))
        }
        Err(e) => ToolCallResult::error(format!("Failed to run compiler: {}", e)),
    }
}

fn handle_verify_graph(args: &Value) -> ToolCallResult {
    let dir = args["dir"].as_str().unwrap_or("docs/contracts");

    let script = "scripts/verify-graph.cjs";
    if !Path::new(script).exists() {
        return ToolCallResult::error(format!(
            "Graph verification script not found: {}",
            script
        ));
    }

    let output = std::process::Command::new("node")
        .args([script, dir])
        .output();

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            let stderr = String::from_utf8_lossy(&o.stderr);
            let passed = o.status.success();

            if let Ok(parsed) = serde_json::from_str::<Value>(&stdout) {
                ToolCallResult::text(serde_json::to_string_pretty(&parsed).unwrap())
            } else {
                let result = json!({
                    "passed": passed,
                    "failed": !passed,
                    "checks": [],
                    "raw_output": stdout.trim(),
                    "errors": if stderr.is_empty() { Value::Null } else { Value::String(stderr.trim().into()) }
                });
                ToolCallResult::text(serde_json::to_string_pretty(&result).unwrap())
            }
        }
        Err(e) => ToolCallResult::error(format!("Failed to run graph verification: {}", e)),
    }
}

fn handle_list_agents(args: &Value) -> ToolCallResult {
    let category = args["category"].as_str();
    let agents_dir = Path::new("agents");

    let registry = match AgentRegistry::load(agents_dir) {
        Ok(r) => r,
        Err(e) => return ToolCallResult::error(format!("Failed to load agents: {}", e)),
    };

    let agents = registry.list(category);
    let agent_list: Vec<Value> = agents
        .iter()
        .map(|a| {
            json!({
                "name": a.name,
                "description": a.description,
                "category": a.category,
                "trigger": a.trigger
            })
        })
        .collect();

    let result = json!({
        "agents": agent_list,
        "total": agent_list.len()
    });
    ToolCallResult::text(serde_json::to_string_pretty(&result).unwrap())
}

fn handle_get_agent(args: &Value) -> ToolCallResult {
    let name = match args["name"].as_str() {
        Some(n) => n,
        None => return ToolCallResult::error("Missing required parameter: name".into()),
    };

    let agents_dir = Path::new("agents");
    let registry = match AgentRegistry::load(agents_dir) {
        Ok(r) => r,
        Err(e) => return ToolCallResult::error(format!("Failed to load agents: {}", e)),
    };

    match registry.get(name) {
        Some(agent) => {
            let result = json!({
                "name": agent.meta.name,
                "description": agent.meta.description,
                "category": agent.meta.category,
                "trigger": agent.meta.trigger,
                "inputs": agent.meta.inputs,
                "outputs": agent.meta.outputs,
                "contracts": agent.meta.contracts,
                "content": agent.content
            });
            ToolCallResult::text(serde_json::to_string_pretty(&result).unwrap())
        }
        None => ToolCallResult::error(format!("Agent not found: {}", name)),
    }
}

fn handle_defer_journey(args: &Value) -> ToolCallResult {
    let journey_id = match args["journey_id"].as_str() {
        Some(j) => j,
        None => return ToolCallResult::error("Missing required parameter: journey_id".into()),
    };
    let reason = match args["reason"].as_str() {
        Some(r) => r,
        None => return ToolCallResult::error("Missing required parameter: reason".into()),
    };
    let action = match args["action"].as_str() {
        Some(a) => a,
        None => return ToolCallResult::error("Missing required parameter: action".into()),
    };
    let issue = args["issue"].as_str().unwrap_or("");

    if action != "defer" && action != "undefer" {
        return ToolCallResult::error("action must be 'defer' or 'undefer'".into());
    }

    // Write/remove a deferral marker file
    let defer_dir = Path::new("docs/contracts/.deferred");
    let defer_file = defer_dir.join(format!("{}.json", journey_id));

    if action == "defer" {
        if let Err(e) = std::fs::create_dir_all(defer_dir) {
            return ToolCallResult::error(format!("Failed to create deferral dir: {}", e));
        }

        let deferral = json!({
            "journey_id": journey_id,
            "reason": reason,
            "issue": issue,
            "deferred_at": chrono_now_fallback()
        });

        match std::fs::write(&defer_file, serde_json::to_string_pretty(&deferral).unwrap()) {
            Ok(_) => {
                let result = json!({ "deferred": true, "journey_id": journey_id });
                ToolCallResult::text(serde_json::to_string_pretty(&result).unwrap())
            }
            Err(e) => ToolCallResult::error(format!("Failed to write deferral: {}", e)),
        }
    } else {
        // undefer
        if defer_file.exists() {
            match std::fs::remove_file(&defer_file) {
                Ok(_) => {
                    let result = json!({ "deferred": false, "journey_id": journey_id });
                    ToolCallResult::text(serde_json::to_string_pretty(&result).unwrap())
                }
                Err(e) => ToolCallResult::error(format!("Failed to remove deferral: {}", e)),
            }
        } else {
            let result = json!({ "deferred": false, "journey_id": journey_id, "note": "was not deferred" });
            ToolCallResult::text(serde_json::to_string_pretty(&result).unwrap())
        }
    }
}

/// Simple timestamp without requiring the chrono crate.
fn chrono_now_fallback() -> String {
    let output = std::process::Command::new("date")
        .args(["-u", "+%Y-%m-%dT%H:%M:%SZ"])
        .output();
    match output {
        Ok(o) if o.status.success() => {
            String::from_utf8_lossy(&o.stdout).trim().to_string()
        }
        _ => "unknown".into(),
    }
}
