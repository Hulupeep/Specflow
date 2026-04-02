#!/usr/bin/env bash
set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ─── Flags ────────────────────────────────────────────────────────────────────
NO_MCP=false
SKIP_DOCTOR=false

for arg in "$@"; do
  case "$arg" in
    --no-mcp)      NO_MCP=true ;;
    --skip-doctor) SKIP_DOCTOR=true ;;
    --help|-h)
      echo "Usage: install.sh [--no-mcp] [--skip-doctor]"
      echo "  --no-mcp       Skip MCP server registration prompt"
      echo "  --skip-doctor  Skip specflow doctor check"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown flag: $arg${RESET}"
      exit 1
      ;;
  esac
done

# ─── Helpers ──────────────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}[info]${RESET}  $*"; }
success() { echo -e "${GREEN}[ok]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET}  $*"; }
fail()    { echo -e "${RED}[fail]${RESET}  $*"; exit 1; }

# ─── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}"
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║                                               ║"
echo "  ║   ⚡ Specflow Installer                       ║"
echo "  ║   Specs that enforce themselves.              ║"
echo "  ║                                               ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo -e "${RESET}"

# ─── Check Node.js ────────────────────────────────────────────────────────────
info "Checking Node.js..."

if ! command -v node &>/dev/null; then
  fail "Node.js is not installed.
  Specflow's compile and graph commands require Node.js >= 20.
  Install it from: https://nodejs.org/ or via nvm:
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    nvm install 20"
fi

NODE_VERSION=$(node -v | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node.js $NODE_VERSION found, but >= 20 is required.
  Upgrade: nvm install 20 && nvm use 20"
fi

success "Node.js $NODE_VERSION"

# ─── Check Rust / Cargo ──────────────────────────────────────────────────────
info "Checking Rust toolchain..."

if ! command -v cargo &>/dev/null; then
  fail "Rust/Cargo is not installed.
  Install it from: https://rustup.rs
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
fi

CARGO_VERSION=$(cargo --version | awk '{print $2}')
success "Cargo $CARGO_VERSION"

# ─── Install Specflow ────────────────────────────────────────────────────────
info "Installing Specflow CLI via cargo..."
echo -e "${DIM}  cargo install --git https://github.com/fall-development-rob/Specflow.git specflow${RESET}"

cargo install --git https://github.com/fall-development-rob/Specflow.git specflow

# ─── Verify Installation ─────────────────────────────────────────────────────
info "Verifying installation..."

if ! command -v specflow &>/dev/null; then
  fail "specflow binary not found in PATH after install.
  Ensure ~/.cargo/bin is in your PATH:
    export PATH=\"\$HOME/.cargo/bin:\$PATH\""
fi

SPECFLOW_VERSION=$(specflow --version 2>/dev/null || echo "unknown")
success "specflow $SPECFLOW_VERSION"

# ─── Doctor ───────────────────────────────────────────────────────────────────
if [ "$SKIP_DOCTOR" = false ]; then
  info "Running specflow doctor..."
  specflow doctor || warn "Doctor reported issues (see above)"
else
  info "Skipping doctor (--skip-doctor)"
fi

# ─── MCP Registration ────────────────────────────────────────────────────────
if [ "$NO_MCP" = false ]; then
  echo ""
  echo -e "${BOLD}Register Specflow as an MCP server for Claude Code?${RESET}"
  echo -e "${DIM}  This lets Claude Code use specflow commands directly.${RESET}"
  printf "  Register now? [y/N] "
  read -r REPLY </dev/tty 2>/dev/null || REPLY="n"
  if [[ "$REPLY" =~ ^[Yy]$ ]]; then
    specflow mcp register && success "MCP server registered" || warn "MCP registration failed"
  else
    info "Skipped MCP registration. Run later with: specflow mcp register"
  fi
else
  info "Skipping MCP registration (--no-mcp)"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  ✓ Specflow installed successfully!${RESET}"
echo ""
echo -e "  ${BOLD}Next steps:${RESET}"
echo -e "  ${CYAN}1.${RESET} cd your-project"
echo -e "  ${CYAN}2.${RESET} specflow init .          ${DIM}# Set up contracts & hooks${RESET}"
echo -e "  ${CYAN}3.${RESET} specflow doctor           ${DIM}# Verify everything works${RESET}"
echo -e "  ${CYAN}4.${RESET} specflow verify            ${DIM}# Run contract verification${RESET}"
echo ""
echo -e "  ${DIM}Docs: https://github.com/fall-development-rob/Specflow${RESET}"
echo ""
