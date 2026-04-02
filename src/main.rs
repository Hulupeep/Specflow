mod commands;
mod contracts;
mod hooks;
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
