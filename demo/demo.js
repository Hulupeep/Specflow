#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
}

function color(text, c) {
  return `${colors[c]}${text}${colors.reset}`
}

function section(title, emoji = '📋') {
  console.log('\n' + '━'.repeat(80))
  console.log(color(`${emoji} ${title}`, 'bright'))
  console.log('━'.repeat(80) + '\n')
}

function log(msg, emoji = '') {
  console.log(`${emoji ? emoji + ' ' : ''}${msg}`)
}

function setState(stateName) {
  const statePath = path.join(__dirname, 'states', `${stateName}.js`)
  const authPath = path.join(__dirname, 'src', 'auth.js')
  fs.copyFileSync(statePath, authPath)
}

function runTests(type = 'all') {
  try {
    const cmd = type === 'unit'
      ? 'npm run test:unit -- --silent'
      : type === 'contracts'
      ? 'npm run test:contracts -- --silent'
      : 'npm test -- --silent'

    execSync(cmd, { cwd: __dirname, stdio: 'pipe' })
    return { passed: true }
  } catch (error) {
    return { passed: false, error: error.stdout.toString() }
  }
}

function step1Working() {
  section('STEP 1: Initial Working State', '📋')

  setState('safe')
  log('Code: Using store with TTL (AUTH-001 compliant)', '✅')
  log('This is our baseline - working code that meets requirements\n')

  const unitResult = runTests('unit')
  log(`Unit tests: ${unitResult.passed ? '✅ 4 passing' : '❌ failed'}`)

  const contractResult = runTests('contracts')
  log(`Contract tests: ${contractResult.passed ? '✅ 1 passing' : '❌ failed'}`)

  log('\n' + color('✅ Everything works and meets spec requirements', 'green'))
}

function step2Broken() {
  section('STEP 2: LLM "Optimization"', '⚠️')

  setState('trap')
  log('LLM suggested: "Use localStorage for 10x performance"', '🤖')
  log('Code changed: store.set/get → localStorage.setItem/getItem\n')

  log(color('Let\'s see what happens...', 'yellow'))
}

function step3Compare() {
  section('STEP 3: Run Tests', '🧪')

  setState('trap')

  log(color('Running unit tests...', 'cyan'))
  const unitResult = runTests('unit')

  if (unitResult.passed) {
    log('  ✅ creates session and returns session ID')
    log('  ✅ retrieves session by ID')
    log('  ✅ returns null for non-existent session')
    log('  ✅ deletes session')
    log('\n' + color('Result: ✅ 4 passing', 'green'))
    log('\n' + color('🤔 Tests pass but code violates AUTH-001!', 'yellow'))
  }

  console.log('\n' + '─'.repeat(80) + '\n')

  log(color('Running contract tests...', 'cyan'))
  const contractResult = runTests('contracts')

  if (!contractResult.passed) {
    log(contractResult.error)
  }
}

function step4Results() {
  section('COMPARISON: Without vs With Contracts', '📊')

  const table = `
${color('What Happened', 'bright')}              ${color('Without Contracts', 'bright')}   ${color('With Contracts', 'bright')}
${'─'.repeat(76)}
Unit tests                   ${color('✅ Pass', 'green')}               ${color('✅ Pass', 'green')}
Spec requirement met         ${color('❌ No', 'red')}                 ${color('✅ Yes (enforced)', 'green')}
Build status                 ${color('✅ Success', 'green')}           ${color('❌ Blocked', 'red')}
Deploy to production         ${color('🚀 Deployed', 'green')}          ${color('🛑 Stopped', 'red')}
Production result            ${color('💥 Crash', 'red')}              ${color('✅ Safe', 'green')}
`
  console.log(table)

  section('Key Insight', '💡')
  log('Unit tests validate implementation works.')
  log('Contracts validate it meets requirements.')
  log('\n' + color('Both are needed!', 'bright') + '\n')
}

function reset() {
  setState('safe')
  log('✅ Reset to safe state (using store with TTL)', '🔄')
  log('\nYou can run the demo again with: npm run demo\n')
}

function fullDemo() {
  console.clear()
  console.log(color('\n╔═══════════════════════════════════════════════════════════════╗', 'cyan'))
  console.log(color('║                                                               ║', 'cyan'))
  console.log(color('║           ', 'cyan') + color('SPECFLOW DEMO: What Tests Miss', 'bright') + color('                ║', 'cyan'))
  console.log(color('║                                                               ║', 'cyan'))
  console.log(color('╚═══════════════════════════════════════════════════════════════╝', 'cyan'))

  step1Working()

  setTimeout(() => {
    step2Broken()

    setTimeout(() => {
      step3Compare()

      setTimeout(() => {
        step4Results()

        setTimeout(() => {
          section('Demo Complete', '✅')
          reset()
        }, 1000)
      }, 1000)
    }, 1000)
  }, 2000)
}

// Parse command line args
const args = process.argv.slice(2)
const step = args.find(arg => arg.startsWith('--step='))?.split('=')[1]

// Run appropriate step
if (step === 'working') {
  step1Working()
} else if (step === 'broken') {
  step2Broken()
} else if (step === 'compare') {
  step3Compare()
} else if (step === 'reset') {
  reset()
} else {
  // Run full automated demo
  fullDemo()
}
