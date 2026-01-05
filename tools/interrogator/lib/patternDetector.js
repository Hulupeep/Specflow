/**
 * Pattern Detector
 *
 * Scans code for patterns that indicate implicit requirements.
 * Distinguishes between "probably a MUST" vs "might be an accident"
 */

class PatternDetector {
  constructor() {
    // Patterns that strongly indicate MUST requirements
    this.mustIndicators = [
      // Security patterns
      {
        name: 'auth_check',
        pattern: /if\s*\(\s*!(?:is)?(?:Auth|Login|Session|Token|User)/i,
        category: 'AUTH',
        confidence: 'high',
        implication: 'Authentication required before this action'
      },
      {
        name: 'auth_middleware',
        pattern: /(?:authMiddleware|requireAuth|ensureAuth|checkAuth|isAuthenticated)/,
        category: 'AUTH',
        confidence: 'high',
        implication: 'Route requires authentication'
      },
      {
        name: 'permission_check',
        pattern: /(?:hasPermission|canAccess|isAdmin|checkRole|authorize)/,
        category: 'AUTH',
        confidence: 'high',
        implication: 'Permission/role check required'
      },
      {
        name: 'input_validation',
        pattern: /(?:validate|sanitize|escape|htmlEncode|xss)/i,
        category: 'SEC',
        confidence: 'high',
        implication: 'Input must be validated/sanitized'
      },
      {
        name: 'sql_prepared',
        pattern: /(?:\$\d|\?|:[\w]+).*(?:query|execute|prepare)/i,
        category: 'SEC',
        confidence: 'high',
        implication: 'SQL queries must use prepared statements'
      },
      {
        name: 'password_hash',
        pattern: /(?:bcrypt|argon2|scrypt|pbkdf2)\.(?:hash|compare)/,
        category: 'SEC',
        confidence: 'high',
        implication: 'Passwords must be hashed'
      },
      {
        name: 'https_only',
        pattern: /(?:https|tls|ssl).*(?:required|only|enforce)/i,
        category: 'SEC',
        confidence: 'medium',
        implication: 'HTTPS required'
      },
      {
        name: 'rate_limit',
        pattern: /(?:rateLimit|throttle|rateLimiter)/,
        category: 'SEC',
        confidence: 'high',
        implication: 'Rate limiting required'
      },

      // Data integrity patterns
      {
        name: 'null_check',
        pattern: /if\s*\(\s*(?:![\w.]+|[\w.]+\s*(?:===?|!==?)\s*(?:null|undefined))/,
        category: 'DATA',
        confidence: 'low',
        implication: 'Null check (might be defensive or required)'
      },
      {
        name: 'type_check',
        pattern: /typeof\s+[\w.]+\s*(?:===?|!==?)/,
        category: 'DATA',
        confidence: 'low',
        implication: 'Type validation'
      },
      {
        name: 'schema_validation',
        pattern: /(?:Joi|yup|zod|ajv)\.(?:validate|parse|object)/,
        category: 'DATA',
        confidence: 'high',
        implication: 'Schema validation required'
      },
      {
        name: 'transaction',
        pattern: /(?:transaction|BEGIN|COMMIT|ROLLBACK)/i,
        category: 'DATA',
        confidence: 'medium',
        implication: 'Database transaction required'
      },

      // Error handling patterns
      {
        name: 'error_throw',
        pattern: /throw\s+new\s+(?:Error|TypeError|ValidationError|AuthError)/,
        category: 'ERROR',
        confidence: 'medium',
        implication: 'Error condition must be handled'
      },
      {
        name: 'try_catch',
        pattern: /try\s*\{[\s\S]*?\}\s*catch/,
        category: 'ERROR',
        confidence: 'low',
        implication: 'Error handling present'
      },

      // API patterns
      {
        name: 'cors',
        pattern: /(?:cors|Access-Control-Allow)/,
        category: 'API',
        confidence: 'medium',
        implication: 'CORS configuration required'
      },
      {
        name: 'api_version',
        pattern: /\/v\d+\//,
        category: 'API',
        confidence: 'medium',
        implication: 'API versioning in use'
      },

      // Storage patterns
      {
        name: 'localstorage',
        pattern: /localStorage\.(?:get|set|remove)Item/,
        category: 'STORAGE',
        confidence: 'medium',
        implication: 'Using localStorage (check if appropriate)'
      },
      {
        name: 'session_storage',
        pattern: /sessionStorage\.(?:get|set|remove)Item/,
        category: 'STORAGE',
        confidence: 'medium',
        implication: 'Using sessionStorage'
      },
      {
        name: 'cookie_httponly',
        pattern: /httpOnly\s*:\s*true/,
        category: 'SEC',
        confidence: 'high',
        implication: 'Cookies must be httpOnly'
      },
      {
        name: 'cookie_secure',
        pattern: /secure\s*:\s*true/,
        category: 'SEC',
        confidence: 'high',
        implication: 'Cookies must be secure'
      },

      // Timing/TTL patterns
      {
        name: 'ttl_explicit',
        pattern: /(?:ttl|expiresIn|maxAge|timeout)\s*[=:]\s*\d+/i,
        category: 'CONFIG',
        confidence: 'medium',
        implication: 'TTL/expiry time configured'
      },
      {
        name: 'magic_number_time',
        pattern: /(?:86400|3600|604800|2592000)\s*(?:\*|$)/,
        category: 'CONFIG',
        confidence: 'low',
        implication: 'Magic number (time constant?) - 86400=1day, 3600=1hr'
      }
    ]

    // Patterns that indicate "suspicious" code (might be bugs/tech debt)
    this.suspiciousPatterns = [
      {
        name: 'todo_fixme',
        pattern: /(?:TODO|FIXME|HACK|XXX|BUG)[\s:]/i,
        category: 'DEBT',
        confidence: 'low',
        implication: 'Tech debt marker'
      },
      {
        name: 'commented_code',
        pattern: /\/\/.*(?:return|if|function|const|let|var)\s+\w+/,
        category: 'DEBT',
        confidence: 'low',
        implication: 'Commented-out code (dead code?)'
      },
      {
        name: 'eval_usage',
        pattern: /\beval\s*\(/,
        category: 'SEC',
        confidence: 'high',
        implication: 'eval() usage - security risk'
      },
      {
        name: 'console_log',
        pattern: /console\.(?:log|debug|info)/,
        category: 'DEBT',
        confidence: 'low',
        implication: 'Console logging (leftover debugging?)'
      },
      {
        name: 'hardcoded_secret',
        pattern: /(?:password|secret|key|token)\s*[=:]\s*['"][^'"]+['"]/i,
        category: 'SEC',
        confidence: 'high',
        implication: 'Possible hardcoded secret'
      },
      {
        name: 'disable_eslint',
        pattern: /eslint-disable/,
        category: 'DEBT',
        confidence: 'low',
        implication: 'ESLint rules disabled (intentional or hack?)'
      },
      {
        name: 'any_type',
        pattern: /:\s*any\b/,
        category: 'DEBT',
        confidence: 'low',
        implication: 'TypeScript any type (loss of type safety)'
      },
      {
        name: 'empty_catch',
        pattern: /catch\s*\([^)]*\)\s*\{\s*\}/,
        category: 'ERROR',
        confidence: 'medium',
        implication: 'Empty catch block (swallowing errors)'
      }
    ]
  }

  detect(content, filePath) {
    const findings = []
    const lines = content.split('\n')

    // Track what we've found to detect consistency
    const patternCounts = new Map()

    for (const indicator of [...this.mustIndicators, ...this.suspiciousPatterns]) {
      const matches = content.matchAll(new RegExp(indicator.pattern, 'g'))

      for (const match of matches) {
        const lineNum = this.getLineNumber(content, match.index)
        const lineContent = lines[lineNum - 1]?.trim() || ''

        findings.push({
          type: indicator === this.suspiciousPatterns ? 'suspicious' : 'pattern',
          name: indicator.name,
          category: indicator.category,
          confidence: indicator.confidence,
          implication: indicator.implication,
          file: filePath,
          line: lineNum,
          code: lineContent,
          match: match[0]
        })

        // Count for consistency analysis
        const key = `${indicator.category}:${indicator.name}`
        patternCounts.set(key, (patternCounts.get(key) || 0) + 1)
      }
    }

    // Boost confidence for consistent patterns
    return this.adjustConfidenceByConsistency(findings, patternCounts)
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length
  }

  adjustConfidenceByConsistency(findings, patternCounts) {
    // If a pattern appears 3+ times consistently, boost confidence
    return findings.map(f => {
      const key = `${f.category}:${f.name}`
      const count = patternCounts.get(key) || 1

      if (count >= 5 && f.confidence === 'low') {
        return { ...f, confidence: 'medium', consistencyBoost: true, occurrences: count }
      }
      if (count >= 3 && f.confidence === 'medium') {
        return { ...f, confidence: 'high', consistencyBoost: true, occurrences: count }
      }
      return { ...f, occurrences: count }
    })
  }
}

module.exports = { PatternDetector }
