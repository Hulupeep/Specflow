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
