/**
 * Report Generator
 *
 * Outputs findings in various formats:
 * - text: Human-readable console output
 * - json: Machine-readable JSON
 * - yaml: YAML format
 * - specflow: Draft Specflow spec format
 */

class ReportGenerator {
  constructor() {
    this.reqCounter = {}  // Track REQ IDs per category
  }

  generate(categorized, directory, format = 'text') {
    switch (format) {
      case 'json':
        return this.generateJSON(categorized, directory)
      case 'yaml':
        return this.generateYAML(categorized, directory)
      case 'specflow':
        return this.generateSpecflow(categorized, directory)
      default:
        return this.generateText(categorized, directory)
    }
  }

  generateText(categorized, directory) {
    const lines = []

    lines.push('═'.repeat(70))
    lines.push('  SPECFLOW INTERROGATOR REPORT')
    lines.push('  Extracted requirements triage from: ' + directory)
    lines.push('═'.repeat(70))
    lines.push('')

    // Summary counts
    const counts = {
      confident: categorized.confident.length,
      probable: categorized.probable.length,
      suspicious: categorized.suspicious.length,
      smells: categorized.smells.length
    }

    lines.push('SUMMARY')
    lines.push('─'.repeat(40))
    lines.push(`  ✓ CONFIDENT (likely real requirements):  ${counts.confident}`)
    lines.push(`  ? PROBABLE (needs confirmation):         ${counts.probable}`)
    lines.push(`  ~ SUSPICIOUS (might be accidents):       ${counts.suspicious}`)
    lines.push(`  ✗ SMELLS (probably tech debt):           ${counts.smells}`)
    lines.push('')

    // CONFIDENT section
    if (categorized.confident.length > 0) {
      lines.push('')
      lines.push('═'.repeat(70))
      lines.push('  ✓ CONFIDENT - These are likely real requirements')
      lines.push('═'.repeat(70))

      for (const item of categorized.confident) {
        lines.push(...this.formatItem(item, 'confident'))
      }
    }

    // PROBABLE section
    if (categorized.probable.length > 0) {
      lines.push('')
      lines.push('═'.repeat(70))
      lines.push('  ? PROBABLE - Needs human confirmation')
      lines.push('═'.repeat(70))

      for (const item of categorized.probable) {
        lines.push(...this.formatItem(item, 'probable'))
      }
    }

    // SUSPICIOUS section
    if (categorized.suspicious.length > 0) {
      lines.push('')
      lines.push('═'.repeat(70))
      lines.push('  ~ SUSPICIOUS - Might be requirements, might be accidents')
      lines.push('═'.repeat(70))

      for (const item of categorized.suspicious) {
        lines.push(...this.formatItem(item, 'suspicious'))
      }
    }

    // SMELLS section
    if (categorized.smells.length > 0) {
      lines.push('')
      lines.push('═'.repeat(70))
      lines.push('  ✗ SMELLS - Probably not requirements (tech debt?)')
      lines.push('═'.repeat(70))

      for (const item of categorized.smells) {
        lines.push(...this.formatItem(item, 'smells'))
      }
    }

    // Footer
    lines.push('')
    lines.push('═'.repeat(70))
    lines.push('  NEXT STEPS')
    lines.push('═'.repeat(70))
    lines.push('')
    lines.push('  1. Review CONFIDENT items - these should become contracts')
    lines.push('  2. Ask stakeholders about PROBABLE items')
    lines.push('  3. Investigate SUSPICIOUS items for intent')
    lines.push('  4. Create tech debt tickets for SMELLS')
    lines.push('')
    lines.push('  Generate draft spec: node index.js <dir> -f specflow -o draft-spec.md')
    lines.push('')

    return lines.join('\n')
  }

  formatItem(item, category) {
    const lines = []
    const { summary, score } = item

    lines.push('')
    lines.push('─'.repeat(50))

    // Header with severity indicator
    const severityIcon = {
      'MUST': '🔴',
      'SHOULD': '🟡',
      'MAYBE': '⚪',
      'DEBT': '🟤',
      'INFO': '🔵'
    }[summary.severity] || '⚪'

    lines.push(`${severityIcon} [${summary.category}] ${summary.implication}`)
    lines.push('')

    // Evidence
    lines.push(`   Evidence (${summary.occurrences} occurrences in ${summary.files.length} files):`)
    for (const ev of summary.evidence.slice(0, 3)) {
      const code = ev.code ? `: ${ev.code.substring(0, 60)}...` : ''
      lines.push(`     • ${ev.file}:${ev.line}${code}`)
    }

    // Confidence factors
    lines.push('')
    lines.push(`   Confidence: ${score.final.toFixed(1)}/10 [${score.factors.join(', ')}]`)

    // Question for human
    if (category !== 'confident') {
      lines.push('')
      lines.push(`   ❓ ${summary.question}`)
    }

    return lines
  }

  generateJSON(categorized, directory) {
    return JSON.stringify({
      source: directory,
      generated: new Date().toISOString(),
      findings: categorized
    }, null, 2)
  }

  generateYAML(categorized, directory) {
    // Simple YAML generation (could use js-yaml for complex cases)
    const lines = []

    lines.push(`# Specflow Interrogator Report`)
    lines.push(`# Generated: ${new Date().toISOString()}`)
    lines.push(`source: "${directory}"`)
    lines.push('')

    for (const [category, items] of Object.entries(categorized)) {
      lines.push(`${category}:`)
      for (const item of items) {
        lines.push(`  - id: "${item.id}"`)
        lines.push(`    category: "${item.summary.category}"`)
        lines.push(`    implication: "${item.summary.implication}"`)
        lines.push(`    severity: "${item.summary.severity}"`)
        lines.push(`    confidence: ${item.score.final.toFixed(1)}`)
        lines.push(`    occurrences: ${item.summary.occurrences}`)
        lines.push(`    files:`)
        for (const f of item.summary.files.slice(0, 5)) {
          lines.push(`      - "${f}"`)
        }
        lines.push(`    question: "${item.summary.question}"`)
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  generateSpecflow(categorized, directory) {
    const lines = []
    this.reqCounter = {}  // Reset counter

    lines.push(`# Feature: [EXTRACTED FROM ${directory}]`)
    lines.push('')
    lines.push(`> ⚠️ DRAFT SPECIFICATION - REQUIRES HUMAN REVIEW`)
    lines.push(`>`)
    lines.push(`> This spec was auto-generated by Specflow Interrogator.`)
    lines.push(`> Items marked [REVIEW] need stakeholder confirmation.`)
    lines.push(`> Items marked [DEBT] should become tech debt tickets, not requirements.`)
    lines.push('')
    lines.push('---')
    lines.push('')
    lines.push('## REQS')
    lines.push('')

    // Group by category
    const byCategory = new Map()

    for (const item of [...categorized.confident, ...categorized.probable]) {
      const cat = item.summary.category
      if (!byCategory.has(cat)) {
        byCategory.set(cat, [])
      }
      byCategory.get(cat).push(item)
    }

    // Generate MUST requirements from confident findings
    for (const [category, items] of byCategory) {
      for (const item of items) {
        const reqId = this.nextReqId(category)
        const severity = item.summary.severity === 'MUST' ? 'MUST' : 'SHOULD'
        const reviewTag = categorized.probable.includes(item) ? ' [REVIEW]' : ''

        lines.push(`### ${reqId} (${severity})${reviewTag}`)
        lines.push(this.formatImplication(item.summary.implication))
        lines.push('')

        // Add evidence as rationale
        if (item.summary.evidence.length > 0) {
          lines.push('Evidence:')
          for (const ev of item.summary.evidence.slice(0, 2)) {
            lines.push(`- Found in \`${ev.file}:${ev.line}\``)
          }
          lines.push('')
        }

        // Add question if it's a probable
        if (categorized.probable.includes(item)) {
          lines.push(`> ❓ ${item.summary.question}`)
          lines.push('')
        }
      }
    }

    // Add suspicious items as comments
    if (categorized.suspicious.length > 0) {
      lines.push('---')
      lines.push('')
      lines.push('## NEEDS INVESTIGATION')
      lines.push('')
      lines.push('> The following patterns were found but might be accidental:')
      lines.push('')

      for (const item of categorized.suspicious.slice(0, 10)) {
        const reqId = this.nextReqId(item.summary.category)
        lines.push(`### ${reqId} (???)`)
        lines.push(`<!-- ${item.summary.question} -->`)
        lines.push(this.formatImplication(item.summary.implication))
        lines.push('')
      }
    }

    // Add tech debt section
    if (categorized.smells.length > 0) {
      lines.push('---')
      lines.push('')
      lines.push('## TECH DEBT (Not Requirements)')
      lines.push('')
      lines.push('> These should become tickets, not spec requirements:')
      lines.push('')

      for (const item of categorized.smells.slice(0, 10)) {
        lines.push(`- [ ] **[${item.summary.category}]** ${item.summary.implication}`)
        if (item.summary.evidence[0]) {
          lines.push(`      Location: \`${item.summary.evidence[0].file}:${item.summary.evidence[0].line}\``)
        }
      }
    }

    // Add changelog
    lines.push('')
    lines.push('---')
    lines.push('')
    lines.push('## Changelog')
    lines.push('')
    lines.push(`### ${new Date().toISOString().split('T')[0]} - v0 (DRAFT)`)
    lines.push('- Auto-generated by Specflow Interrogator')
    lines.push('- **REQUIRES HUMAN REVIEW BEFORE USE**')
    lines.push('')

    return lines.join('\n')
  }

  nextReqId(category) {
    // Normalize category to 3-4 letter prefix
    const prefix = {
      'AUTH': 'AUTH',
      'SEC': 'SEC',
      'API': 'API',
      'DATA': 'DATA',
      'CONFIG': 'CFG',
      'ERROR': 'ERR',
      'UI': 'UI',
      'PERF': 'PERF',
      'COMPAT': 'COMPAT',
      'DEBT': 'DEBT',
      'ARCH': 'ARCH',
      'STORAGE': 'STOR',
      'GENERAL': 'GEN'
    }[category] || category.substring(0, 4).toUpperCase()

    if (!this.reqCounter[prefix]) {
      this.reqCounter[prefix] = 0
    }
    this.reqCounter[prefix]++

    return `${prefix}-${String(this.reqCounter[prefix]).padStart(3, '0')}`
  }

  formatImplication(implication) {
    // Capitalize and clean up
    let text = implication.charAt(0).toUpperCase() + implication.slice(1)

    // Ensure it ends with a period
    if (!/[.!?]$/.test(text)) {
      text += '.'
    }

    return text
  }
}

module.exports = { ReportGenerator }
