/**
 * Confidence Scorer
 *
 * Takes raw findings and categorizes them into:
 * - CONFIDENT: Almost certainly real requirements
 * - PROBABLE: Likely requirements, needs human confirmation
 * - SUSPICIOUS: Might be requirements, might be accidents
 * - SMELLS: Probably tech debt or mistakes, not requirements
 */

class ConfidenceScorer {
  constructor() {
    // Weights for different signals
    this.weights = {
      // Source of evidence
      multipleEvidence: 1.5,      // Found in multiple places
      hasTest: 2.0,               // Has corresponding test
      hasComment: 1.3,            // Has explaining comment
      consistentPattern: 1.8,     // Same pattern throughout codebase

      // Type of pattern
      securityPattern: 2.0,       // Security-related (high stakes)
      errorHandling: 1.5,         // Error handling
      validation: 1.5,            // Input validation

      // Negative signals
      singleOccurrence: 0.5,      // Only found once
      noTest: 0.7,                // No test coverage
      contradictoryPattern: 0.3,  // Inconsistent usage
      looksLikeCopied: 0.4        // Looks copy-pasted
    }
  }

  categorize(findings) {
    // Group findings by implied requirement
    const grouped = this.groupFindings(findings)

    // Score each group
    const scored = []
    for (const [key, items] of grouped) {
      const score = this.scoreGroup(key, items, findings)
      scored.push({
        id: key,
        items,
        score,
        category: this.determineCategory(score),
        summary: this.generateSummary(key, items, score)
      })
    }

    // Sort by confidence (highest first within each category)
    const categorized = {
      confident: [],
      probable: [],
      suspicious: [],
      smells: []
    }

    for (const item of scored) {
      categorized[item.category].push(item)
    }

    // Sort each category by score
    for (const cat of Object.keys(categorized)) {
      categorized[cat].sort((a, b) => b.score.final - a.score.final)
    }

    return categorized
  }

  groupFindings(findings) {
    const groups = new Map()

    const allFindings = [
      ...findings.patterns,
      ...findings.testInferences,
      ...findings.comments
    ]

    for (const finding of allFindings) {
      // Create a grouping key based on category + name/implication
      const key = this.createGroupKey(finding)

      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key).push(finding)
    }

    return groups
  }

  createGroupKey(finding) {
    // Normalize the finding into a groupable key
    const category = finding.category || 'GENERAL'
    const name = finding.name || finding.testType || 'unknown'

    // Extract the core concept
    let concept = name
    if (finding.implication && typeof finding.implication === 'string') {
      // Use first few meaningful words of implication
      concept = finding.implication
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .slice(0, 4)
        .join('_')
    }

    return `${category}:${concept}`
  }

  scoreGroup(key, items, allFindings) {
    let score = 1.0
    const factors = []

    // Count evidence sources
    const sources = {
      patterns: items.filter(i => i.type === 'pattern').length,
      tests: items.filter(i => i.type === 'test_inference').length,
      comments: items.filter(i => i.type === 'comment').length,
      suspicious: items.filter(i => i.type === 'suspicious').length
    }

    // Multiple sources of evidence
    const evidenceSources = Object.values(sources).filter(v => v > 0).length
    if (evidenceSources >= 2) {
      score *= this.weights.multipleEvidence
      factors.push(`multiple_sources(${evidenceSources})`)
    }

    // Has test coverage
    if (sources.tests > 0) {
      score *= this.weights.hasTest
      factors.push('has_tests')
    } else {
      score *= this.weights.noTest
      factors.push('no_tests')
    }

    // Has explanatory comments
    if (sources.comments > 0) {
      score *= this.weights.hasComment
      factors.push('has_comments')
    }

    // Consistency check
    const files = new Set(items.map(i => i.file))
    const totalOccurrences = items.length

    if (totalOccurrences >= 3 && files.size >= 2) {
      score *= this.weights.consistentPattern
      factors.push(`consistent(${totalOccurrences} in ${files.size} files)`)
    } else if (totalOccurrences === 1) {
      score *= this.weights.singleOccurrence
      factors.push('single_occurrence')
    }

    // Security patterns get boosted
    const category = key.split(':')[0]
    if (['SEC', 'AUTH'].includes(category)) {
      score *= this.weights.securityPattern
      factors.push('security_critical')
    }

    // Check for contradictions (some places have it, some don't)
    if (this.hasContradictions(items, allFindings)) {
      score *= this.weights.contradictoryPattern
      factors.push('contradictory_usage')
    }

    // Check original confidence levels
    const highConfidence = items.filter(i => i.confidence === 'high').length
    const mediumConfidence = items.filter(i => i.confidence === 'medium').length

    if (highConfidence > 0) {
      score *= 1 + (highConfidence * 0.2)
      factors.push(`high_confidence(${highConfidence})`)
    }
    if (mediumConfidence > 0) {
      score *= 1 + (mediumConfidence * 0.1)
    }

    return {
      raw: score,
      final: Math.min(score, 10),  // Cap at 10
      factors
    }
  }

  hasContradictions(items, allFindings) {
    // Look for patterns that are sometimes present, sometimes not
    // This is a simplified check - a real implementation would be smarter
    const pattern = items[0]?.name
    if (!pattern) return false

    // Check if there are similar code blocks without this pattern
    // (This would need actual code analysis to be accurate)
    return false
  }

  determineCategory(score) {
    const s = score.final

    if (s >= 4.0) return 'confident'
    if (s >= 2.0) return 'probable'
    if (s >= 1.0) return 'suspicious'
    return 'smells'
  }

  generateSummary(key, items, score) {
    const [category, concept] = key.split(':')
    const files = [...new Set(items.map(i => i.file))]

    // Get the best implication from items
    const implications = items
      .map(i => i.implication)
      .filter(Boolean)

    const bestImplication = implications[0] || concept.replace(/_/g, ' ')

    // Determine likely severity
    const severities = items.map(i => i.severity).filter(Boolean)
    const severity = severities.includes('MUST') ? 'MUST' :
      severities.includes('SHOULD') ? 'SHOULD' : 'MAYBE'

    return {
      category,
      concept: concept.replace(/_/g, ' '),
      implication: bestImplication,
      severity,
      files,
      occurrences: items.length,
      evidence: items.slice(0, 3).map(i => ({
        file: i.file,
        line: i.line,
        code: i.code || i.text || i.description
      })),
      question: this.generateQuestion(key, items, score)
    }
  }

  generateQuestion(key, items, score) {
    const [category] = key.split(':')

    // Generate a human question for review
    if (score.factors.includes('contradictory_usage')) {
      return 'This pattern is used inconsistently. Is it intentional or accidental?'
    }

    if (score.factors.includes('single_occurrence')) {
      return 'Only found once. Is this a one-off or a general requirement?'
    }

    if (score.factors.includes('no_tests')) {
      return 'No test coverage found. Is this behavior important enough to test?'
    }

    if (category === 'DEBT') {
      return 'This looks like tech debt. Should it be fixed or is it intentional?'
    }

    if (category === 'CONFIG') {
      return 'Is this configuration value intentional or arbitrary?'
    }

    return 'Is this an actual requirement or accidental implementation detail?'
  }
}

module.exports = { ConfidenceScorer }
