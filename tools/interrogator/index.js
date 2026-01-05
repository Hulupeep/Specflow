#!/usr/bin/env node
/**
 * Specflow Interrogator
 *
 * Reverse-engineers implicit requirements from existing codebases.
 * Outputs a triage report for human review, NOT authoritative requirements.
 *
 * Usage: node index.js <directory> [options]
 */

const fs = require('fs')
const path = require('path')
const { PatternDetector } = require('./lib/patternDetector')
const { TestInferrer } = require('./lib/testInferrer')
const { CommentMiner } = require('./lib/commentMiner')
const { ConfidenceScorer } = require('./lib/confidenceScorer')
const { ReportGenerator } = require('./lib/reportGenerator')

class Interrogator {
  constructor(options = {}) {
    this.options = {
      extensions: ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java'],
      ignorePatterns: ['node_modules', 'dist', 'build', '.git', 'vendor', '__pycache__'],
      ...options
    }

    this.patternDetector = new PatternDetector()
    this.testInferrer = new TestInferrer()
    this.commentMiner = new CommentMiner()
    this.confidenceScorer = new ConfidenceScorer()
    this.reportGenerator = new ReportGenerator()
  }

  async interrogate(directory) {
    console.log(`\n🔍 Interrogating: ${directory}\n`)

    // 1. Collect all source files
    const files = this.collectFiles(directory)
    console.log(`   Found ${files.source.length} source files, ${files.tests.length} test files\n`)

    // 2. Run all extractors
    const findings = {
      patterns: [],
      testInferences: [],
      comments: [],
      magicValues: []
    }

    // Extract from source files
    for (const file of files.source) {
      const content = fs.readFileSync(file, 'utf-8')
      const relPath = path.relative(directory, file)

      findings.patterns.push(...this.patternDetector.detect(content, relPath))
      findings.comments.push(...this.commentMiner.mine(content, relPath))
    }

    // Extract from test files
    for (const file of files.tests) {
      const content = fs.readFileSync(file, 'utf-8')
      const relPath = path.relative(directory, file)

      findings.testInferences.push(...this.testInferrer.infer(content, relPath))
    }

    // 3. Score and categorize findings
    const categorized = this.confidenceScorer.categorize(findings)

    // 4. Generate report
    return this.reportGenerator.generate(categorized, directory, this.options.format || 'text')
  }

  collectFiles(directory) {
    const source = []
    const tests = []

    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        // Skip ignored patterns
        if (this.options.ignorePatterns.some(p => entry.name.includes(p))) {
          continue
        }

        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name)
          if (this.options.extensions.includes(ext)) {
            // Categorize as test or source
            if (this.isTestFile(entry.name, fullPath)) {
              tests.push(fullPath)
            } else {
              source.push(fullPath)
            }
          }
        }
      }
    }

    walk(directory)
    return { source, tests }
  }

  isTestFile(filename, fullPath) {
    const testPatterns = [
      /\.test\./,
      /\.spec\./,
      /_test\./,
      /test_/,
      /__tests__/,
      /tests?\//
    ]
    return testPatterns.some(p => p.test(filename) || p.test(fullPath))
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Specflow Interrogator - Extract implicit requirements from code

Usage: node index.js <directory> [options]

Options:
  --output, -o <file>   Write report to file (default: stdout)
  --format, -f <fmt>    Output format: text, json, yaml, specflow (default: text)
  --verbose, -v         Show detailed findings
  --help, -h            Show this help

Examples:
  node index.js ./src
  node index.js ./src -f specflow -o draft-spec.md
  node index.js ./my-app --verbose
`)
    process.exit(0)
  }

  const directory = args[0]
  const outputIndex = args.findIndex(a => a === '-o' || a === '--output')
  const formatIndex = args.findIndex(a => a === '-f' || a === '--format')

  const options = {
    output: outputIndex !== -1 ? args[outputIndex + 1] : null,
    format: formatIndex !== -1 ? args[formatIndex + 1] : 'text',
    verbose: args.includes('-v') || args.includes('--verbose')
  }

  if (!fs.existsSync(directory)) {
    console.error(`Error: Directory not found: ${directory}`)
    process.exit(1)
  }

  const interrogator = new Interrogator(options)
  interrogator.interrogate(directory)
    .then(report => {
      if (options.output) {
        fs.writeFileSync(options.output, report)
        console.log(`\n✅ Report written to: ${options.output}`)
      } else {
        console.log(report)
      }
    })
    .catch(err => {
      console.error('Error:', err.message)
      process.exit(1)
    })
}

module.exports = { Interrogator }
