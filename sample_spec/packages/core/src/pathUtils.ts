/**
 * Path utilities for note creation
 * Contract: ARCH-001 - No browser APIs allowed
 */

/**
 * Slugify a string for use in file paths
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)
}

/**
 * Extract date parts from ISO string
 */
export function parseDateParts(isoDate: string): {
  year: string
  month: string
  day: string
} {
  const date = new Date(isoDate)
  return {
    year: date.getUTCFullYear().toString(),
    month: String(date.getUTCMonth() + 1).padStart(2, '0'),
    day: String(date.getUTCDate()).padStart(2, '0'),
  }
}

/**
 * Create the file path for a note
 * Format: basePath/YYYY/MM/DD/topic-slug.md
 */
export function createNotePath(
  basePath: string,
  topic: string,
  capturedAt: string
): string {
  const { year, month, day } = parseDateParts(capturedAt)
  const slug = slugify(topic) || 'note'

  const cleanBasePath = basePath.replace(/^\/+|\/+$/g, '')

  return `${cleanBasePath}/${year}/${month}/${day}/${slug}.md`
}

/**
 * Create a path with a numeric suffix for collision handling
 */
export function createNotePathWithSuffix(
  basePath: string,
  topic: string,
  capturedAt: string,
  suffix: number
): string {
  const { year, month, day } = parseDateParts(capturedAt)
  const slug = slugify(topic) || 'note'

  const cleanBasePath = basePath.replace(/^\/+|\/+$/g, '')

  return `${cleanBasePath}/${year}/${month}/${day}/${slug}-${suffix}.md`
}

/**
 * Generate topic from content (first 80 chars, cleaned)
 */
export function generateTopicFromContent(content: string): string {
  const firstLine = content.split('\n')[0] || ''
  const cleaned = firstLine
    .replace(/^#+\s*/, '')
    .replace(/[*_`~]/g, '')
    .trim()
  return cleaned.substring(0, 80)
}

/**
 * Extract hashtags from content as tags
 * e.g. "my thoughts #ideas #life" → ["ideas", "life"]
 *
 * Rules:
 * - Hashtags must start with a letter (not number)
 * - Can contain letters, numbers, underscores, hyphens
 * - Returned lowercase and deduplicated
 * - Ignores hex colors like #fff, #ffffff, #a1b2c3
 */
export function extractHashtags(content: string): string[] {
  // Match hashtags that start with a letter, followed by letters/numbers/underscore/hyphen
  const matches = content.match(/#([a-zA-Z][a-zA-Z0-9_-]{1,})/g) || []
  const tags = matches
    .map(m => m.slice(1).toLowerCase())
    // Filter out likely hex colors (3 or 6 char alphanumeric without underscore/hyphen)
    .filter(tag => {
      // Hex colors are exactly 3 or 6 alphanumeric chars (no underscore/hyphen)
      if (/^[a-f0-9]{3}$/.test(tag) || /^[a-f0-9]{6}$/.test(tag)) {
        return false
      }
      return true
    })
  return [...new Set(tags)]
}
