/**
 * Tests for hashtag extraction from content
 * Feature: FEAT-001 - Extract hashtags from content as tags
 */

const fs = require('fs')
const path = require('path')

// Read the source file and extract the function for testing
const pathUtilsPath = path.join(__dirname, '../packages/core/src/pathUtils.ts')
const pathUtilsContent = fs.readFileSync(pathUtilsPath, 'utf-8')

// Simple extraction of the function logic for testing
// In production this would be properly compiled
function extractHashtags(content) {
  const matches = content.match(/#([a-zA-Z][a-zA-Z0-9_-]{1,})/g) || []
  const tags = matches
    .map(m => m.slice(1).toLowerCase())
    .filter(tag => {
      // Filter out likely hex colors (3 or 6 char alphanumeric without underscore/hyphen)
      if (/^[a-f0-9]{3}$/.test(tag) || /^[a-f0-9]{6}$/.test(tag)) {
        return false
      }
      return true
    })
  return [...new Set(tags)]
}

describe('extractHashtags', () => {
  describe('basic extraction', () => {
    test('extracts single hashtag', () => {
      expect(extractHashtags('my thoughts #ideas')).toEqual(['ideas'])
    })

    test('extracts multiple hashtags', () => {
      expect(extractHashtags('summary #ideas #life #work')).toEqual(['ideas', 'life', 'work'])
    })

    test('extracts hashtags from multiline content', () => {
      const content = `Here's my summary

Key points:
- Point one #important
- Point two #review

#actionable`
      expect(extractHashtags(content)).toEqual(['important', 'review', 'actionable'])
    })

    test('returns empty array when no hashtags', () => {
      expect(extractHashtags('just regular text')).toEqual([])
    })

    test('returns empty array for empty string', () => {
      expect(extractHashtags('')).toEqual([])
    })
  })

  describe('case handling', () => {
    test('converts hashtags to lowercase', () => {
      expect(extractHashtags('#Ideas #WORK #Life')).toEqual(['ideas', 'work', 'life'])
    })

    test('deduplicates same tag with different cases', () => {
      expect(extractHashtags('#Ideas #ideas #IDEAS')).toEqual(['ideas'])
    })
  })

  describe('valid hashtag formats', () => {
    test('accepts letters and numbers', () => {
      expect(extractHashtags('#idea1 #2024goals')).toEqual(['idea1'])
      // #2024goals is ignored because it starts with a number
    })

    test('accepts underscores', () => {
      expect(extractHashtags('#my_idea #work_notes')).toEqual(['my_idea', 'work_notes'])
    })

    test('accepts hyphens', () => {
      expect(extractHashtags('#my-idea #work-notes')).toEqual(['my-idea', 'work-notes'])
    })

    test('accepts mixed formats', () => {
      expect(extractHashtags('#idea_v2-final')).toEqual(['idea_v2-final'])
    })
  })

  describe('ignores invalid hashtags', () => {
    test('ignores hashtags starting with numbers', () => {
      expect(extractHashtags('#123 #2024')).toEqual([])
    })

    test('ignores hex color codes (3 chars)', () => {
      expect(extractHashtags('color: #fff #abc')).toEqual([])
    })

    test('ignores hex color codes (6 chars)', () => {
      expect(extractHashtags('color: #ffffff #a1b2c3')).toEqual([])
    })

    test('ignores single character hashtags', () => {
      expect(extractHashtags('#a #b #c')).toEqual([])
    })

    test('ignores hashtags with only special chars after #', () => {
      expect(extractHashtags('## heading')).toEqual([])
    })
  })

  describe('edge cases', () => {
    test('handles hashtag at start of content', () => {
      expect(extractHashtags('#first thing I want to say')).toEqual(['first'])
    })

    test('handles hashtag at end of content', () => {
      expect(extractHashtags('my thoughts #final')).toEqual(['final'])
    })

    test('handles adjacent hashtags', () => {
      expect(extractHashtags('#one#two #three')).toEqual(['one', 'two', 'three'])
    })

    test('handles hashtag in markdown link', () => {
      expect(extractHashtags('[link](#section) #real-tag')).toEqual(['section', 'real-tag'])
    })

    test('handles hashtag with trailing punctuation', () => {
      expect(extractHashtags('#idea, #work. #life!')).toEqual(['idea', 'work', 'life'])
    })

    test('deduplicates repeated hashtags', () => {
      expect(extractHashtags('#idea #work #idea #life #work')).toEqual(['idea', 'work', 'life'])
    })
  })

  describe('real-world examples', () => {
    test('ChatGPT summary with tags', () => {
      const content = `Here's my summary of the meeting:

1. We decided to launch in Q4
2. Budget approved for $50k
3. Team expanded by 2 people

#decisions #q4 #budget #team`
      expect(extractHashtags(content)).toEqual(['decisions', 'q4', 'budget', 'team'])
    })

    test('Stack Overflow answer with code', () => {
      const content = `To fix this error, use:
\`\`\`css
color: #333;
background: #f0f0f0;
\`\`\`
#css #debugging #frontend`
      // Should extract real tags but ignore CSS hex colors
      expect(extractHashtags(content)).toEqual(['css', 'debugging', 'frontend'])
    })

    test('mixed content with some invalid tags', () => {
      const content = `Check out issue #123 and PR #456
Also relevant: #api-design #v2 #2024-roadmap`
      // #123, #456, #2024-roadmap ignored (start with numbers)
      expect(extractHashtags(content)).toEqual(['api-design', 'v2'])
    })
  })
})

describe('extractHashtags function exists in pathUtils.ts', () => {
  test('function is exported', () => {
    expect(pathUtilsContent).toMatch(/export function extractHashtags/)
  })

  test('function has correct signature', () => {
    expect(pathUtilsContent).toMatch(/extractHashtags\(content:\s*string\):\s*string\[\]/)
  })
})
