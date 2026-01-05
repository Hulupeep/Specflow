/**
 * Comment Miner
 *
 * Extracts potential requirements from code comments.
 * Comments often contain the "why" that code doesn't express.
 */

class CommentMiner {
  constructor() {
    // Comment patterns for different languages
    this.commentPatterns = [
      // Single-line comments
      /\/\/\s*(.+)/g,
      /#\s*(.+)/g,  // Python, shell

      // Multi-line comments
      /\/\*\s*([\s\S]*?)\s*\*\//g,
      /"""\s*([\s\S]*?)\s*"""/g,  // Python docstrings
      /'''\s*([\s\S]*?)\s*'''/g,

      // JSDoc/TSDoc
      /\/\*\*\s*([\s\S]*?)\s*\*\//g
    ]

    // Keywords that indicate important comments
    this.importantMarkers = [
      { marker: /^(?:IMPORTANT|CRITICAL|WARNING|SECURITY|NOTE)[\s:]/i, severity: 'MUST', confidence: 'high' },
      { marker: /^(?:TODO|FIXME|HACK|XXX)[\s:]/i, severity: 'DEBT', confidence: 'medium' },
      { marker: /^(?:BUG|BROKEN|ISSUE)[\s:]/i, severity: 'MUST', confidence: 'high' },
      { marker: /must\s+(?:be|have|use|not)/i, severity: 'MUST', confidence: 'medium' },
      { marker: /should\s+(?:be|have|use|not)/i, severity: 'SHOULD', confidence: 'low' },
      { marker: /never\s+/i, severity: 'MUST', confidence: 'medium' },
      { marker: /always\s+/i, severity: 'MUST', confidence: 'medium' },
      { marker: /required/i, severity: 'MUST', confidence: 'medium' },
      { marker: /don'?t\s+(?:use|call|remove|change|modify)/i, severity: 'MUST', confidence: 'medium' }
    ]

    // JSDoc tags that indicate requirements
    this.jsdocTags = [
      { tag: '@throws', severity: 'MUST', implication: 'Throws error under certain conditions' },
      { tag: '@deprecated', severity: 'SHOULD', implication: 'Should not use, marked for removal' },
      { tag: '@requires', severity: 'MUST', implication: 'Has dependency requirement' },
      { tag: '@security', severity: 'MUST', implication: 'Security consideration' },
      { tag: '@private', severity: 'SHOULD', implication: 'Not intended for external use' },
      { tag: '@internal', severity: 'SHOULD', implication: 'Internal API, may change' },
      { tag: '@readonly', severity: 'MUST', implication: 'Must not be modified' },
      { tag: '@override', severity: 'INFO', implication: 'Overrides parent implementation' }
    ]
  }

  mine(content, filePath) {
    const findings = []
    const lines = content.split('\n')

    // Extract all comments
    for (const pattern of this.commentPatterns) {
      const regex = new RegExp(pattern.source, pattern.flags)
      let match

      while ((match = regex.exec(content)) !== null) {
        const comment = match[1].trim()
        const lineNum = this.getLineNumber(content, match.index)

        // Analyze the comment
        const analysis = this.analyzeComment(comment, lineNum, lines)

        if (analysis.isImportant) {
          findings.push({
            type: 'comment',
            text: comment.substring(0, 200), // Truncate long comments
            category: analysis.category,
            confidence: analysis.confidence,
            severity: analysis.severity,
            implication: analysis.implication,
            file: filePath,
            line: lineNum,
            marker: analysis.marker
          })
        }
      }
    }

    // Also look for inline requirement hints
    const inlineFindings = this.findInlineHints(content, filePath)
    findings.push(...inlineFindings)

    return findings
  }

  analyzeComment(comment, lineNum, lines) {
    // Check for important markers
    for (const { marker, severity, confidence } of this.importantMarkers) {
      if (marker.test(comment)) {
        return {
          isImportant: true,
          category: this.categorizeComment(comment),
          severity,
          confidence,
          implication: this.cleanComment(comment),
          marker: marker.source
        }
      }
    }

    // Check for JSDoc tags
    for (const { tag, severity, implication } of this.jsdocTags) {
      if (comment.includes(tag)) {
        return {
          isImportant: true,
          category: this.categorizeComment(comment),
          severity,
          confidence: 'medium',
          implication: `${implication}: ${this.extractTagContent(comment, tag)}`,
          marker: tag
        }
      }
    }

    // Check if comment explains a constraint
    if (this.looksLikeConstraint(comment)) {
      return {
        isImportant: true,
        category: this.categorizeComment(comment),
        severity: 'MAYBE',
        confidence: 'low',
        implication: this.cleanComment(comment),
        marker: 'constraint_hint'
      }
    }

    return { isImportant: false }
  }

  categorizeComment(comment) {
    const lower = comment.toLowerCase()

    if (/security|auth|permission|access|csrf|xss|injection/.test(lower)) {
      return 'SEC'
    }
    if (/performance|optim|cache|speed|slow|fast/.test(lower)) {
      return 'PERF'
    }
    if (/backward|compat|legacy|deprecat|migration/.test(lower)) {
      return 'COMPAT'
    }
    if (/bug|fix|workaround|hack|issue/.test(lower)) {
      return 'DEBT'
    }
    if (/api|endpoint|request|response|http/.test(lower)) {
      return 'API'
    }
    if (/database|db|query|sql|migration/.test(lower)) {
      return 'DATA'
    }
    if (/config|env|setting|option/.test(lower)) {
      return 'CONFIG'
    }
    return 'GENERAL'
  }

  cleanComment(comment) {
    return comment
      .replace(/^(?:IMPORTANT|CRITICAL|WARNING|SECURITY|NOTE|TODO|FIXME|HACK|XXX|BUG)[\s:]*/i, '')
      .replace(/^\*+\s*/, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  extractTagContent(comment, tag) {
    const regex = new RegExp(`${tag}\\s+(.+?)(?:\\n|$)`)
    const match = comment.match(regex)
    return match ? match[1].trim() : ''
  }

  looksLikeConstraint(comment) {
    // Comments that explain "why" often indicate constraints
    const constraintPatterns = [
      /because\s+/i,
      /this\s+(?:is|ensures|prevents|requires)/i,
      /otherwise\s+/i,
      /to\s+(?:prevent|ensure|avoid|maintain)/i,
      /\d+\s+(?:seconds?|minutes?|hours?|days?|bytes?|kb|mb)/i,  // Has numeric constraints
      /max(?:imum)?|min(?:imum)?|limit/i
    ]

    return constraintPatterns.some(p => p.test(comment))
  }

  findInlineHints(content, filePath) {
    const findings = []
    const lines = content.split('\n')

    // Look for constants/variables that hint at requirements
    const constPatterns = [
      // Named timeouts/limits
      {
        pattern: /(?:const|let|var)\s+(MAX_|MIN_|TIMEOUT_|LIMIT_|DEFAULT_)(\w+)\s*=\s*(\d+)/g,
        type: 'constant'
      },
      // Environment variable checks
      {
        pattern: /process\.env\.(\w+)/g,
        type: 'env_var'
      }
    ]

    for (const { pattern, type } of constPatterns) {
      const regex = new RegExp(pattern.source, pattern.flags)
      let match

      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index)

        if (type === 'constant') {
          findings.push({
            type: 'comment',
            text: `${match[1]}${match[2]} = ${match[3]}`,
            category: 'CONFIG',
            confidence: 'low',
            severity: 'MAYBE',
            implication: `Configuration constant: ${match[1]}${match[2]} (value: ${match[3]})`,
            file: filePath,
            line: lineNum,
            marker: 'magic_constant'
          })
        } else if (type === 'env_var') {
          findings.push({
            type: 'comment',
            text: `Requires env: ${match[1]}`,
            category: 'CONFIG',
            confidence: 'medium',
            severity: 'MUST',
            implication: `Environment variable required: ${match[1]}`,
            file: filePath,
            line: lineNum,
            marker: 'env_dependency'
          })
        }
      }
    }

    return findings
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length
  }
}

module.exports = { CommentMiner }
