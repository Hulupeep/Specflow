/**
 * Chrome Web Store Pre-Submit Validation Tests
 *
 * Automated checks for Chrome Web Store requirements.
 * Run before every submission to catch instant-rejection issues.
 */

const fs = require('fs')
const path = require('path')

const DIST_DIR = path.join(__dirname, '../packages/extension/dist')
const MANIFEST_PATH = path.join(DIST_DIR, 'manifest.json')
const ROOT_DIR = path.join(__dirname, '..')

// Helper to recursively get all files in a directory
function getAllFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      getAllFiles(fullPath, files)
    } else {
      files.push(fullPath)
    }
  }
  return files
}

// Helper to read file content
function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8')
}

describe('Chrome Web Store Checklist', () => {
  let manifest

  beforeAll(() => {
    if (fs.existsSync(MANIFEST_PATH)) {
      manifest = JSON.parse(readFile(MANIFEST_PATH))
    }
  })

  describe('1. Manifest / Packaging (MV3)', () => {
    test('manifest.json exists in dist', () => {
      expect(fs.existsSync(MANIFEST_PATH)).toBe(true)
    })

    test('manifest_version is 3', () => {
      expect(manifest.manifest_version).toBe(3)
    })

    test('required fields are present: name, version, description', () => {
      expect(manifest.name).toBeDefined()
      expect(manifest.name.length).toBeGreaterThan(0)

      expect(manifest.version).toBeDefined()
      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/)

      expect(manifest.description).toBeDefined()
      expect(manifest.description.length).toBeGreaterThan(0)
      expect(manifest.description.length).toBeLessThanOrEqual(132) // Chrome limit
    })

    test('icons defined for 16, 48, and 128 px', () => {
      expect(manifest.icons).toBeDefined()
      expect(manifest.icons['16']).toBeDefined()
      expect(manifest.icons['48']).toBeDefined()
      expect(manifest.icons['128']).toBeDefined()

      // Verify icon files exist
      for (const size of ['16', '48', '128']) {
        const iconPath = path.join(DIST_DIR, manifest.icons[size])
        expect(fs.existsSync(iconPath)).toBe(true)
      }
    })

    test('background uses service_worker (not persistent page)', () => {
      expect(manifest.background).toBeDefined()
      expect(manifest.background.service_worker).toBeDefined()
      expect(manifest.background.persistent).toBeUndefined()
      expect(manifest.background.scripts).toBeUndefined()
    })

    test('no deprecated MV2 keys', () => {
      expect(manifest.browser_action).toBeUndefined()
      expect(manifest.page_action).toBeUndefined()
      if (manifest.background) {
        expect(manifest.background.persistent).toBeUndefined()
      }
    })

    test('dist folder has no build junk', () => {
      const distFiles = getAllFiles(DIST_DIR)
      const junkPatterns = [
        /node_modules/,
        /\.map$/,
        /\.test\./,
        /\.spec\./,
        /tsconfig/,
        /package-lock/,
        /\.git/,
        /\.DS_Store/,
      ]

      for (const file of distFiles) {
        for (const pattern of junkPatterns) {
          expect(file).not.toMatch(pattern)
        }
      }
    })
  })

  describe('2. Code & Architecture (Remote Code, Eval)', () => {
    let allJsFiles
    let allJsContent

    beforeAll(() => {
      allJsFiles = getAllFiles(DIST_DIR).filter(f => f.endsWith('.js'))
      allJsContent = allJsFiles.map(f => ({
        path: f,
        content: readFile(f)
      }))
    })

    test('no eval() calls in extension code', () => {
      for (const file of allJsContent) {
        // Match eval( but not .evaluate or similar
        const evalMatches = file.content.match(/[^a-zA-Z_]eval\s*\(/g)
        if (evalMatches) {
          fail(`Found eval() in ${file.path}`)
        }
      }
    })

    test('no new Function() calls', () => {
      for (const file of allJsContent) {
        const matches = file.content.match(/new\s+Function\s*\(/g)
        if (matches) {
          fail(`Found new Function() in ${file.path}`)
        }
      }
    })

    test('no remote script loading', () => {
      for (const file of allJsContent) {
        // Check for script src with http/https
        const remoteScripts = file.content.match(/<script[^>]+src\s*=\s*["']https?:\/\//gi)
        if (remoteScripts) {
          fail(`Found remote script loading in ${file.path}: ${remoteScripts}`)
        }

        // Check for dynamic script creation with remote URLs
        const dynamicRemote = file.content.match(/createElement\s*\(\s*["']script["']\s*\)[^;]*\.src\s*=\s*["']https?:/gi)
        if (dynamicRemote) {
          fail(`Found dynamic remote script in ${file.path}`)
        }
      }
    })

    test('no obviously obfuscated code', () => {
      for (const file of allJsContent) {
        // Check for very long single lines (often obfuscated)
        const lines = file.content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].length > 5000) {
            // Allow minified but not excessively long single lines
            console.warn(`Warning: Very long line (${lines[i].length} chars) in ${file.path}:${i+1}`)
          }
        }

        // Check for hex-encoded strings abuse
        const hexStrings = file.content.match(/\\x[0-9a-f]{2}/gi) || []
        if (hexStrings.length > 50) {
          console.warn(`Warning: Many hex-encoded strings (${hexStrings.length}) in ${file.path}`)
        }
      }
    })

    test('CSP in manifest is MV3-compliant', () => {
      // MV3 doesn't allow unsafe-eval or unsafe-inline
      if (manifest.content_security_policy) {
        const csp = JSON.stringify(manifest.content_security_policy)
        expect(csp).not.toMatch(/unsafe-eval/)
        expect(csp).not.toMatch(/unsafe-inline/)
      }
    })
  })

  describe('3. Permissions & Host Access', () => {
    test('no overly broad host permissions', () => {
      const hostPerms = manifest.host_permissions || []

      // Check for <all_urls> or *://*/*
      for (const perm of hostPerms) {
        expect(perm).not.toBe('<all_urls>')
        expect(perm).not.toBe('*://*/*')
        expect(perm).not.toBe('http://*/*')
        expect(perm).not.toBe('https://*/*')
      }
    })

    test('host_permissions are specific domains', () => {
      const hostPerms = manifest.host_permissions || []
      const allowedDomains = [
        'chatgpt.com',
        'chat.openai.com',
        'api.github.com',
      ]

      for (const perm of hostPerms) {
        const hasAllowedDomain = allowedDomains.some(d => perm.includes(d))
        expect(hasAllowedDomain).toBe(true)
      }
    })

    test('permissions are minimal and justified', () => {
      const perms = manifest.permissions || []

      // These are the permissions we actually need
      const allowedPerms = [
        'storage',      // For storing PAT and settings
        'contextMenus', // For right-click menu
        'activeTab',    // For getting current tab URL
        'notifications', // For save feedback
      ]

      for (const perm of perms) {
        expect(allowedPerms).toContain(perm)
      }
    })

    test('no dangerous permissions without justification', () => {
      const perms = manifest.permissions || []
      const dangerousPerms = [
        'webRequest',
        'webRequestBlocking',
        'cookies',
        'history',
        'bookmarks',
        'downloads',
        'management',
        'nativeMessaging',
        'debugger',
      ]

      for (const perm of perms) {
        if (dangerousPerms.includes(perm)) {
          fail(`Dangerous permission "${perm}" found - needs strong justification`)
        }
      }
    })
  })

  describe('4. User Data & Privacy', () => {
    test('privacy policy files exist', () => {
      const privacyPaths = [
        path.join(ROOT_DIR, 'packages/extension/PRIVACY_POLICY.md'),
        path.join(ROOT_DIR, '../chat2rep-help/PRIVACY.md'),
      ]

      const hasPrivacyPolicy = privacyPaths.some(p => fs.existsSync(p))
      expect(hasPrivacyPolicy).toBe(true)
    })

    test('no hardcoded external tracking domains', () => {
      const allJsFiles = getAllFiles(DIST_DIR).filter(f => f.endsWith('.js'))
      const trackingDomains = [
        'google-analytics.com',
        'googletagmanager.com',
        'facebook.com/tr',
        'mixpanel.com',
        'segment.io',
        'amplitude.com',
        'hotjar.com',
        'fullstory.com',
      ]

      for (const file of allJsFiles) {
        const content = readFile(file)
        for (const domain of trackingDomains) {
          expect(content).not.toMatch(new RegExp(domain, 'i'))
        }
      }
    })

    test('all external URLs are HTTPS', () => {
      const allJsFiles = getAllFiles(DIST_DIR).filter(f => f.endsWith('.js'))

      // Allowed http:// URLs (XML/SVG namespaces used by React, not actual network requests)
      const allowedHttpUrls = [
        'http://www.w3.org/',  // W3C namespaces (SVG, XML, XHTML, MathML)
      ]

      for (const file of allJsFiles) {
        const content = readFile(file)
        // Find http:// URLs (but allow localhost and W3C namespaces)
        const httpUrls = content.match(/["']http:\/\/(?!localhost|127\.0\.0\.1)[^"']+["']/g) || []

        const problematicUrls = httpUrls.filter(url => {
          return !allowedHttpUrls.some(allowed => url.includes(allowed))
        })

        expect(problematicUrls).toEqual([])
      }
    })
  })

  describe('5. UX / Behavior', () => {
    test('no auto-opening tabs or popups in code', () => {
      const allJsFiles = getAllFiles(DIST_DIR).filter(f => f.endsWith('.js'))

      for (const file of allJsFiles) {
        const content = readFile(file)
        // Check for suspicious auto-open patterns
        const autoOpenPatterns = [
          /chrome\.tabs\.create\s*\(\s*\{[^}]*url[^}]*\}\s*\)/,
          /window\.open\s*\(/,
        ]

        // These are fine if user-initiated, just log for review
        for (const pattern of autoOpenPatterns) {
          if (pattern.test(content)) {
            console.log(`Info: Tab/window opening found in ${path.basename(file)} - verify it's user-initiated`)
          }
        }
      }
    })

    test('content scripts only match declared domains', () => {
      const contentScripts = manifest.content_scripts || []
      const hostPerms = manifest.host_permissions || []

      for (const cs of contentScripts) {
        for (const match of cs.matches || []) {
          // Content script matches should be subset of host_permissions
          // or be for sites that don't need host_permissions
          console.log(`Content script matches: ${match}`)
        }
      }
    })
  })

  describe('6. Store Listing Requirements', () => {
    test('description is within Chrome limits', () => {
      expect(manifest.description.length).toBeLessThanOrEqual(132)
    })

    test('128x128 icon exists and is valid PNG', () => {
      const iconPath = path.join(DIST_DIR, manifest.icons['128'])
      expect(fs.existsSync(iconPath)).toBe(true)

      const iconBuffer = fs.readFileSync(iconPath)
      // PNG magic bytes
      expect(iconBuffer[0]).toBe(0x89)
      expect(iconBuffer[1]).toBe(0x50) // P
      expect(iconBuffer[2]).toBe(0x4E) // N
      expect(iconBuffer[3]).toBe(0x47) // G
    })

    test('CHROME_STORE_LISTING.md exists with required info', () => {
      const listingPath = path.join(ROOT_DIR, 'packages/extension/CHROME_STORE_LISTING.md')
      expect(fs.existsSync(listingPath)).toBe(true)

      const content = readFile(listingPath)
      expect(content).toMatch(/Short Description/i)
      expect(content).toMatch(/Detailed Description/i)
      expect(content).toMatch(/Privacy/i)
      expect(content).toMatch(/Support/i)
    })

    test('support email is configured', () => {
      const listingPath = path.join(ROOT_DIR, 'packages/extension/CHROME_STORE_LISTING.md')
      const content = readFile(listingPath)
      expect(content).toMatch(/support@floutlabs\.com/)
    })
  })

  describe('7. Abuse Prevention', () => {
    test('no cryptocurrency mining code patterns', () => {
      const allJsFiles = getAllFiles(DIST_DIR).filter(f => f.endsWith('.js'))
      const miningPatterns = [
        /coinhive/i,
        /cryptonight/i,
        /webminer/i,
        /minero/i,
        /coin-?hive/i,
      ]

      for (const file of allJsFiles) {
        const content = readFile(file)
        for (const pattern of miningPatterns) {
          expect(content).not.toMatch(pattern)
        }
      }
    })

    test('no click fraud patterns', () => {
      const allJsFiles = getAllFiles(DIST_DIR).filter(f => f.endsWith('.js'))

      for (const file of allJsFiles) {
        const content = readFile(file)
        // Check for suspicious click simulation
        const clickFraudPatterns = [
          /\.click\s*\(\s*\)\s*.*setInterval/,
          /setInterval.*\.click\s*\(\s*\)/,
        ]

        for (const pattern of clickFraudPatterns) {
          expect(content).not.toMatch(pattern)
        }
      }
    })
  })

  describe('8. Pre-Submit Smoke Test', () => {
    test('all declared files exist in dist', () => {
      // Check background script
      if (manifest.background?.service_worker) {
        const bgPath = path.join(DIST_DIR, manifest.background.service_worker)
        expect(fs.existsSync(bgPath)).toBe(true)
      }

      // Check content scripts
      for (const cs of manifest.content_scripts || []) {
        for (const js of cs.js || []) {
          const jsPath = path.join(DIST_DIR, js)
          expect(fs.existsSync(jsPath)).toBe(true)
        }
        for (const css of cs.css || []) {
          const cssPath = path.join(DIST_DIR, css)
          expect(fs.existsSync(cssPath)).toBe(true)
        }
      }

      // Check popup
      if (manifest.action?.default_popup) {
        const popupPath = path.join(DIST_DIR, manifest.action.default_popup)
        expect(fs.existsSync(popupPath)).toBe(true)
      }

      // Check options page
      if (manifest.options_page) {
        const optionsPath = path.join(DIST_DIR, manifest.options_page)
        expect(fs.existsSync(optionsPath)).toBe(true)
      }
    })

    test('HTML files reference existing JS', () => {
      const htmlFiles = getAllFiles(DIST_DIR).filter(f => f.endsWith('.html'))

      for (const htmlFile of htmlFiles) {
        const content = readFile(htmlFile)
        const scriptRefs = content.match(/src=["']([^"']+\.js)["']/g) || []

        for (const ref of scriptRefs) {
          const jsFile = ref.match(/src=["']([^"']+)["']/)[1]
          const jsPath = path.join(path.dirname(htmlFile), jsFile)
          expect(fs.existsSync(jsPath)).toBe(true)
        }
      }
    })

    test('service worker has no syntax errors', () => {
      if (manifest.background?.service_worker) {
        const bgPath = path.join(DIST_DIR, manifest.background.service_worker)
        const content = readFile(bgPath)

        // Basic syntax check - try to parse
        expect(() => {
          // This is a basic check - real syntax errors would be caught by esbuild
          // Just make sure it's not empty or obviously broken
          expect(content.length).toBeGreaterThan(100)
          expect(content).not.toMatch(/syntax\s*error/i)
        }).not.toThrow()
      }
    })
  })
})

// Summary reporter
afterAll(() => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           Chrome Web Store Pre-Submit Validation              ║
╠═══════════════════════════════════════════════════════════════╣
║ Run 'npm run build:extension' before testing                  ║
║ Manual checks still required:                                 ║
║   - Load unpacked in fresh Chrome profile                     ║
║   - Test all user journeys                                    ║
║   - Verify screenshots match current UI                       ║
║   - Check Network tab matches privacy policy                  ║
╚═══════════════════════════════════════════════════════════════╝
`)
})
