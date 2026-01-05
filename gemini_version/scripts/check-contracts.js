const fs = require('fs');
const path = require('path');
const glob = require('glob'); // Need to ensure glob is available

// CONTRACT REGISTRY
const CONTRACT_REGISTRY = {
    // Map dirs to contracts
    'packages/core/src': ['arch_001_layering.yml', 'data_001_frontmatter.yml'],
    'packages/extension/src/content': ['arch_001_layering.yml', 'sec_001_secrets.yml'],
};

// FORBIDDEN PATTERNS (Duplicated from YAML for speed, ideally parsed)
const FORBIDDEN_PATTERNS = {
    'arch_001_pure_core': [
        { pattern: /(window\.|document\.|chrome\.|localStorage\.|fetch\()/, message: "Core must be pure TS" }
    ],
    'arch_002_no_github_in_content': [
        { pattern: /api\.github\.com/, message: "No direct GitHub API calls in content" },
        { pattern: /import.*GitHubClient/, message: "No GitHub Client import in content" }
    ],
    'sec_001_pat_storage': [
        { pattern: /chrome\.storage\.local\.get.*['"]pat['"]/, message: "Do not read PAT in content script" },
        { pattern: /console\.log.*pat/i, message: "Do not log secrets" }
    ]
};

function checkFile(filePath) {
    if (!fs.existsSync(filePath)) return true;
    
    // Naive scope check
    let contracts = [];
    for (const [scope, c] of Object.entries(CONTRACT_REGISTRY)) {
        if (filePath.includes(scope)) {
            contracts.push(...c);
        }
    }

    if (contracts.length === 0) return true;

    const content = fs.readFileSync(filePath, 'utf-8');
    let violations = [];

    // Check against ALL forbidden patterns (simplified for this script)
    // In a real generic script, we'd map patterns to specific contracts
    for (const [ruleId, patterns] of Object.entries(FORBIDDEN_PATTERNS)) {
        // Only apply if the rule makes sense for this file's contract context
        // (Skipping complex mapping logic for this demo, just checking patterns)
        
        // Very basic check: if we are in core, check core rules
        if (filePath.includes('packages/core') && ruleId.includes('arch_001')) {
             patterns.forEach(p => {
                 if (p.pattern.test(content)) violations.push({ ruleId, ...p });
             });
        }
        
        if (filePath.includes('packages/extension/src/content') && (ruleId.includes('arch_002') || ruleId.includes('sec_001'))) {
             patterns.forEach(p => {
                 if (p.pattern.test(content)) violations.push({ ruleId, ...p });
             });
        }
    }

    if (violations.length > 0) {
        console.log(`❌ VIOLATION in ${filePath}`);
        violations.forEach(v => console.log(`   - ${v.message}`));
        return false;
    }
    
    console.log(`✅ ${filePath} passed`);
    return true;
}

// Run checks
const args = process.argv.slice(2);
if (args.length > 0) {
    checkFile(args[0]);
} else {
    // Scan typical dirs
    const files = glob.sync('packages/**/*.{ts,tsx}');
    let failed = false;
    files.forEach(f => {
        if (!checkFile(f)) failed = true;
    });
    if (failed) process.exit(1);
}