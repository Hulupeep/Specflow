mod agents;
mod commands;
mod contracts;
mod hooks;
mod mcp;
mod utils;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(
    name = "specflow",
    version,
    about = "Specs that enforce themselves — contract-driven development CLI"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize Specflow in a project directory
    Init {
        /// Target directory (defaults to current directory)
        dir: Option<String>,
        /// Output results as JSON
        #[arg(long)]
        json: bool,
    },

    /// Run health checks on Specflow setup
    Doctor {
        /// Target directory (defaults to current directory)
        dir: Option<String>,
        /// Output results as JSON
        #[arg(long)]
        json: bool,
    },

    /// Enforce contracts against project files
    Enforce {
        /// Target directory (defaults to current directory)
        dir: Option<String>,
        /// Output results as JSON
        #[arg(long)]
        json: bool,
    },

    /// Update hooks and settings
    Update {
        /// Target directory (defaults to current directory)
        dir: Option<String>,
        /// Also install CI workflows
        #[arg(long)]
        ci: bool,
    },

    /// Show compliance status dashboard
    Status {
        /// Target directory (defaults to current directory)
        dir: Option<String>,
        /// Output results as JSON
        #[arg(long)]
        json: bool,
    },

    /// Compile journey contracts (wraps Node.js compiler)
    Compile {
        /// Arguments passed to the compiler
        #[arg(trailing_var_arg = true)]
        args: Vec<String>,
    },

    /// Audit a GitHub issue for specflow compliance
    Audit {
        /// Issue number
        issue: String,
    },

    /// Validate contract graph integrity
    Graph {
        /// Contracts directory (defaults to docs/contracts)
        dir: Option<String>,
    },

    /// Hook subcommands (called by Claude Code hooks)
    Hook {
        #[command(subcommand)]
        hook_command: HookCommands,
    },

    /// MCP server subcommands
    Mcp {
        #[command(subcommand)]
        mcp_command: McpCommands,
    },

    /// Agent registry subcommands
    Agent {
        #[command(subcommand)]
        agent_command: AgentCommands,
    },
}

#[derive(Subcommand)]
enum HookCommands {
    /// Post-build hook: detect builds, trigger journey tests
    PostBuild,
    /// Compliance hook: scan changed files against contracts
    Compliance,
    /// Journey test hook: map issues to journey tests
    Journey,
}

#[derive(Subcommand)]
enum AgentCommands {
    /// List all agents, optionally filtered by category
    List {
        /// Filter by category
        #[arg(long)]
        category: Option<String>,
        /// Output as JSON
        #[arg(long)]
        json: bool,
    },
    /// Show full details and prompt for an agent
    Show {
        /// Agent name
        name: String,
    },
    /// Search agents by keyword
    Search {
        /// Search query
        query: String,
        /// Output as JSON
        #[arg(long)]
        json: bool,
    },
}

#[derive(Subcommand)]
enum McpCommands {
    /// Start the MCP stdio server
    Start,
    /// Register with Claude Code (runs: claude mcp add specflow)
    Register,
    /// Unregister from Claude Code (runs: claude mcp remove specflow)
    Unregister,
}

fn main() {
    let cli = Cli::parse();

    let result = match cli.command {
        Commands::Init { dir, json } => {
            commands::init::run(dir.as_deref(), json)
        }
        Commands::Doctor { dir, json } => {
            commands::doctor::run(dir.as_deref(), json)
        }
        Commands::Enforce { dir, json } => {
            commands::enforce::run(dir.as_deref(), json)
        }
        Commands::Update { dir, ci } => {
            commands::update::run(dir.as_deref(), ci)
        }
        Commands::Status { dir, json } => {
            commands::status::run(dir.as_deref(), json)
        }
        Commands::Compile { args } => {
            commands::compile::run(&args)
        }
        Commands::Audit { issue } => {
            commands::audit::run(&issue)
        }
        Commands::Graph { dir } => {
            commands::graph::run(dir.as_deref())
        }
        Commands::Mcp { mcp_command } => match mcp_command {
            McpCommands::Start => {
                mcp::server::run(); // never returns
            }
            McpCommands::Register => {
                if let Err(e) = mcp::server::register() {
                    eprintln!("Error: {}", e);
                    std::process::exit(1);
                }
                return;
            }
            McpCommands::Unregister => {
                if let Err(e) = mcp::server::unregister() {
                    eprintln!("Error: {}", e);
                    std::process::exit(1);
                }
                return;
            }
        },
        Commands::Agent { agent_command } => {
            handle_agent_command(agent_command);
            return;
        }
        Commands::Hook { hook_command } => match hook_command {
            HookCommands::PostBuild => {
                match hooks::post_build::run() {
                    Ok(code) => std::process::exit(code),
                    Err(e) => {
                        eprintln!("Hook error: {}", e);
                        std::process::exit(2);
                    }
                }
            }
            HookCommands::Compliance => {
                match hooks::compliance::run() {
                    Ok(code) => std::process::exit(code),
                    Err(e) => {
                        eprintln!("Hook error: {}", e);
                        std::process::exit(2);
                    }
                }
            }
            HookCommands::Journey => {
                match hooks::journey_tests::run() {
                    Ok(code) => std::process::exit(code),
                    Err(e) => {
                        eprintln!("Hook error: {}", e);
                        std::process::exit(2);
                    }
                }
            }
        },
    };

    if let Err(e) = result {
        eprintln!("Error: {:?}", e);
        std::process::exit(1);
    }
}

fn handle_agent_command(cmd: AgentCommands) {
    let agents_dir = std::path::Path::new("agents");
    if !agents_dir.is_dir() {
        eprintln!("Error: agents/ directory not found. Are you in the specflow root?");
        std::process::exit(1);
    }

    let registry = match agents::registry::AgentRegistry::load(agents_dir) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Error loading agent registry: {}", e);
            std::process::exit(1);
        }
    };

    match cmd {
        AgentCommands::List { category, json } => {
            let agents = registry.list(category.as_deref());
            if json {
                println!("{}", serde_json::to_string_pretty(&agents).unwrap());
            } else {
                let categories = registry.categories();
                println!(
                    "{} agents across {} categories\n",
                    agents.len(),
                    categories.len()
                );
                let mut current_cat = String::new();
                for agent in &agents {
                    if agent.category != current_cat {
                        current_cat = agent.category.clone();
                        println!(
                            "{}{}{}",
                            "\x1b[1;36m",
                            current_cat.to_uppercase(),
                            "\x1b[0m"
                        );
                    }
                    println!(
                        "  {}{:<28}{} {}",
                        "\x1b[1m", agent.name, "\x1b[0m", agent.description
                    );
                }
            }
        }
        AgentCommands::Show { name } => match registry.get(&name) {
            Some(agent) => {
                if atty::is(atty::Stream::Stdout) {
                    println!(
                        "{}# {}{} ({})\n",
                        "\x1b[1m", agent.meta.name, "\x1b[0m", agent.meta.category
                    );
                    println!("{}", agent.meta.description);
                    if !agent.meta.inputs.is_empty() {
                        println!("\nInputs:  {}", agent.meta.inputs.join(", "));
                    }
                    if !agent.meta.outputs.is_empty() {
                        println!("Outputs: {}", agent.meta.outputs.join(", "));
                    }
                    if !agent.meta.contracts.is_empty() {
                        println!("Contracts: {}", agent.meta.contracts.join(", "));
                    }
                    println!("\n---\n");
                }
                println!("{}", agent.content);
            }
            None => {
                eprintln!("Agent not found: {}", name);
                let results = registry.search(&name);
                if !results.is_empty() {
                    eprintln!("\nDid you mean:");
                    for r in results.iter().take(3) {
                        eprintln!("  {}", r.name);
                    }
                }
                std::process::exit(1);
            }
        },
        AgentCommands::Search { query, json } => {
            let results = registry.search(&query);
            if json {
                println!("{}", serde_json::to_string_pretty(&results).unwrap());
            } else if results.is_empty() {
                println!("No agents found matching \"{}\"", query);
            } else {
                println!(
                    "{} agents matching \"{}\"\n",
                    results.len(),
                    query
                );
                for agent in &results {
                    println!(
                        "  {}{:<28}{} [{}] {}",
                        "\x1b[1m",
                        agent.name,
                        "\x1b[0m",
                        agent.category,
                        agent.description
                    );
                }
            }
        }
    }
}
