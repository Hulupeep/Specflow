/**
 * Test Inferrer
 *
 * Extracts implicit requirements from test files.
 * Tests often state requirements more clearly than implementation code.
 */

class TestInferrer {
  constructor() {
    // Patterns to extract from test descriptions
    this.testPatterns = [
      // Jest/Mocha/Jasmine style
      {
        pattern: /(?:it|test)\s*\(\s*['"`](.+?)['"`]/g,
        type: 'test_case'
      },
      {
        pattern: /describe\s*\(\s*['"`](.+?)['"`]/g,
        type: 'test_suite'
      },
      // Assertion patterns that reveal requirements
      {
        pattern: /expect\s*\([^)]+\)\.to(?:Be|Equal|Have|Throw|Match|Contain)([^(]*)\(/g,
        type: 'assertion'
      },
      {
        pattern: /expect\s*\([^)]+\)\.not\.to(?:Be|Equal|Have|Throw|Match|Contain)/g,
        type: 'negative_assertion'
      },
      // Error expectations (strong MUST indicators)
      {
        pattern: /expect\s*\([^)]+\)\.toThrow(?:Error)?\s*\(\s*['"`]?([^'"`\)]+)/g,
        type: 'error_case'
      },
      // Rejects pattern (async error handling)
      {
        pattern: /expect\s*\([^)]+\)\.rejects\.toThrow/g,
        type: 'async_error'
      }
    ]

    // Keywords that indicate requirement severity
    this.mustKeywords = [
      'must', 'should not', 'cannot', 'fails', 'throws', 'rejects',
      'unauthorized', 'forbidden', 'invalid', 'required', 'mandatory'
    ]

    this.shouldKeywords = [
      'should', 'can', 'may', 'optionally', 'preferably', 'ideally'
    ]
  }

  infer(content, filePath) {
    const findings = []
    const lines = content.split('\n')

    // Extract test descriptions
    for (const { pattern, type } of this.testPatterns) {
      const regex = new RegExp(pattern.source, pattern.flags)
      let match

      while ((match = regex.exec(content)) !== null) {
        const description = match[1]
        if (!description || typeof description !== 'string') continue

        const lineNum = this.getLineNumber(content, match.index)

        // Analyze the description for requirement keywords
        const analysis = this.analyzeDescription(description)

        if (analysis.isRequirement) {
          findings.push({
            type: 'test_inference',
            testType: type,
            description: description,
            category: analysis.category,
            confidence: analysis.confidence,
            severity: analysis.severity,
            implication: this.generateImplication(description, analysis),
            file: filePath,
            line: lineNum,
            keywords: analysis.keywords
          })
        }
      }
    }

    // Look for test context (what's being tested)
    const contextFindings = this.extractTestContext(content, filePath)
    findings.push(...contextFindings)

    return findings
  }

  analyzeDescription(description) {
    const lowerDesc = description.toLowerCase()

    // Check for MUST indicators
    const mustMatches = this.mustKeywords.filter(k => lowerDesc.includes(k))
    const shouldMatches = this.shouldKeywords.filter(k => lowerDesc.includes(k))

    // Determine category from keywords
    let category = 'GENERAL'
    if (/auth|login|session|token|permission|role/.test(lowerDesc)) {
      category = 'AUTH'
    } else if (/valid|input|sanitiz|escap|xss|sql|inject/.test(lowerDesc)) {
      category = 'SEC'
    } else if (/error|fail|throw|reject|exception/.test(lowerDesc)) {
      category = 'ERROR'
    } else if (/api|endpoint|route|request|response/.test(lowerDesc)) {
      category = 'API'
    } else if (/database|db|query|save|store|persist/.test(lowerDesc)) {
      category = 'DATA'
    } else if (/ui|render|display|show|component/.test(lowerDesc)) {
      category = 'UI'
    }

    // Determine severity
    let severity = 'SHOULD'
    let confidence = 'low'

    if (mustMatches.length > 0) {
      severity = 'MUST'
      confidence = 'medium'
    }

    // Error tests are almost always MUSTs
    if (/throws|rejects|fails|error|invalid|unauthorized/.test(lowerDesc)) {
      severity = 'MUST'
      confidence = 'high'
    }

    return {
      isRequirement: mustMatches.length > 0 || shouldMatches.length > 0 ||
        category !== 'GENERAL',
      category,
      severity,
      confidence,
      keywords: [...mustMatches, ...shouldMatches]
    }
  }

  generateImplication(description, analysis) {
    // Transform test description into requirement language
    let implication = description

    // Clean up common test description patterns
    implication = implication
      .replace(/^it\s+/, '')
      .replace(/^should\s+/, 'System must ')
      .replace(/^can\s+/, 'System can ')
      .replace(/^returns?\s+/, 'Must return ')
      .replace(/^throws?\s+/, 'Must throw ')

    return implication
  }

  extractTestContext(content, filePath) {
    const findings = []

    // Look for imports/requires to understand what's being tested
    const importMatches = content.matchAll(/(?:import|require)\s*\(?['"`]([^'"`]+)/g)
    const testedModules = []

    for (const match of importMatches) {
      const modulePath = match[1]
      // Skip test utilities and node_modules
      if (!modulePath.startsWith('.') ||
        /test|mock|fixture|stub/.test(modulePath)) {
        continue
      }
      testedModules.push(modulePath)
    }

    // Look for mock patterns (what's being mocked often reveals dependencies)
    const mockMatches = content.matchAll(/jest\.mock\s*\(\s*['"`]([^'"`]+)/g)
    for (const match of mockMatches) {
      findings.push({
        type: 'test_inference',
        testType: 'mock_dependency',
        description: `Mocks: ${match[1]}`,
        category: 'ARCH',
        confidence: 'low',
        severity: 'INFO',
        implication: `Code depends on ${match[1]} (mocked in tests)`,
        file: filePath,
        line: this.getLineNumber(content, match.index)
      })
    }

    return findings
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length
  }
}

module.exports = { TestInferrer }
