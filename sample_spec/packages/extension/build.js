#!/usr/bin/env node

const esbuild = require('esbuild')
const fs = require('fs')
const path = require('path')

const isWatch = process.argv.includes('--watch')

const outdir = path.join(__dirname, 'dist')

// Ensure dist directory exists
if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir, { recursive: true })
}

// Copy static files
const staticFiles = [
  'manifest.json',
  'src/content/styles.css',
  'src/popup/popup.html',
  'src/options/options.html',
]

for (const file of staticFiles) {
  const src = path.join(__dirname, file)
  const filename = path.basename(file)
  const destDir = file.includes('/')
    ? path.join(outdir, path.dirname(file).replace('src/', ''))
    : outdir

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(destDir, filename))
  }
}

// Create icons directory and copy Lucide send icon
const iconsDir = path.join(outdir, 'icons')
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

// Copy the Lucide send.png icon from root (24x24) to all sizes
// The icon is simple enough to work at small sizes
const sourceIcon = path.join(__dirname, '../../send.png')
if (fs.existsSync(sourceIcon)) {
  // Copy same icon for all sizes - it's vector-like and scales well
  for (const size of [16, 48, 128]) {
    fs.copyFileSync(sourceIcon, path.join(iconsDir, `icon${size}.png`))
  }
  console.log('📦 Copied Lucide send icon')
} else {
  console.warn('⚠️  send.png not found at', sourceIcon)
}

// Build configuration
const buildOptions = {
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch,
  target: ['chrome90'],
  format: 'esm',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
  },
  external: [],
}

async function build() {
  try {
    // Build background service worker
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['src/background/index.ts'],
      outfile: path.join(outdir, 'background/index.js'),
      platform: 'browser',
    })

    // Build content script
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['src/content/chatgptContentScript.ts'],
      outfile: path.join(outdir, 'content/chatgptContentScript.js'),
      platform: 'browser',
      format: 'iife',
    })

    // Build popup
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['src/popup/index.tsx'],
      outfile: path.join(outdir, 'popup/index.js'),
      platform: 'browser',
    })

    // Build options page
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['src/options/index.tsx'],
      outfile: path.join(outdir, 'options/index.js'),
      platform: 'browser',
    })

    console.log('✅ Build complete')
  } catch (error) {
    console.error('❌ Build failed:', error)
    process.exit(1)
  }
}

build()

if (isWatch) {
  console.log('👀 Watching for changes...')
}
