/**
 * Options page for chat2repo settings
 * Based on design mockup: options.png
 */

import React, { useState, useEffect } from 'react'
import type { GitHubRepoConfig } from '@chat2repo/core'

interface RepoFormData {
  label: string
  owner: string
  repo: string
  defaultBranch: string
  basePath: string
}

const emptyRepoForm: RepoFormData = {
  label: '',
  owner: '',
  repo: '',
  defaultBranch: 'main',
  basePath: 'chat-notes',
}

export function OptionsPage() {
  const [pat, setPat] = useState('')
  const [repos, setRepos] = useState<GitHubRepoConfig[]>([])
  const [newRepo, setNewRepo] = useState<RepoFormData>(emptyRepoForm)
  const [defaultTags, setDefaultTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const result = await chrome.storage.local.get([
      'github_pat',
      'repo_configs',
      'default_tags',
    ])
    if (result.github_pat) setPat(result.github_pat)
    if (result.repo_configs) setRepos(result.repo_configs)
    if (result.default_tags) setDefaultTags(result.default_tags.join(', '))
  }

  async function saveSettings() {
    setSaving(true)
    setMessage(null)

    try {
      const tagsArray = defaultTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      await chrome.storage.local.set({
        github_pat: pat,
        repo_configs: repos,
        default_tags: tagsArray,
        default_repo_id: repos[0]?.id,
      })

      setMessage({ type: 'success', text: 'Settings saved!' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  function addRepo() {
    if (!newRepo.label || !newRepo.owner || !newRepo.repo) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' })
      return
    }

    const repo: GitHubRepoConfig = {
      id: crypto.randomUUID(),
      label: newRepo.label,
      owner: newRepo.owner,
      repo: newRepo.repo,
      defaultBranch: newRepo.defaultBranch || 'main',
      basePath: newRepo.basePath || 'chat-notes',
    }

    setRepos([...repos, repo])
    setNewRepo(emptyRepoForm)
  }

  function removeRepo(id: string) {
    setRepos(repos.filter((r) => r.id !== id))
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>chat2repo Settings</h1>
        <p style={styles.subtitle}>
          Configure your GitHub connection and repositories
        </p>
        <a
          href="https://hulupeep.github.io/chat2rep-help"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.helpLink}
        >
          📖 Help & Documentation
        </a>
      </header>

      {/* No GitHub Account? */}
      <section style={styles.calloutSection}>
        <p style={styles.calloutText}>
          <strong>Don't have a GitHub account?</strong> No problem — it's free and takes 2 minutes.{' '}
          <a href="https://hulupeep.github.io/chat2rep-help/INSTALL" target="_blank" rel="noopener noreferrer" style={styles.link}>
            Follow our step-by-step guide →
          </a>
        </p>
      </section>

      {/* GitHub Token Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>GitHub Personal Access Token</h2>
        <p style={styles.sectionDesc}>
          Once you have a GitHub account, you're 10 seconds away from a token:
        </p>
        <ol style={styles.quickSteps}>
          <li>Go to <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" style={styles.link}>github.com/settings/tokens</a></li>
          <li>Click "Generate new token (classic)"</li>
          <li>Check only <code>repo</code> scope → Generate → Copy</li>
        </ol>
        <div style={styles.field}>
          <label style={styles.label}>GitHub Token</label>
          <input
            type="password"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            style={styles.input}
          />
          <p style={styles.hint}>
            Your token is stored locally and never shared
          </p>
        </div>
      </section>

      {/* Repositories Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Repositories</h2>
        <p style={styles.sectionDesc}>
          Don't have a repo yet? No problem — <a href="https://github.com/new" target="_blank" rel="noopener noreferrer" style={styles.link}>create one in 30 seconds</a>.{' '}
          <a href="https://hulupeep.github.io/chat2rep-help/INSTALL" target="_blank" rel="noopener noreferrer" style={styles.link}>Step-by-step guide →</a>
        </p>

        {/* Existing repos */}
        {repos.map((repo) => (
          <div key={repo.id} style={styles.repoCard}>
            <div style={styles.repoHeader}>
              <strong>{repo.label}</strong>
              <button
                onClick={() => removeRepo(repo.id)}
                style={styles.removeBtn}
              >
                Remove
              </button>
            </div>
            <p style={styles.repoInfo}>
              {repo.owner}/{repo.repo} ({repo.defaultBranch}) → {repo.basePath}/
            </p>
          </div>
        ))}

        {/* Add new repo form */}
        <div style={styles.repoForm}>
          <div style={styles.field}>
            <div style={styles.labelRow}>
              <label style={styles.label}>Nickname</label>
              <span style={styles.infoTip} title="A friendly name to help you identify this repo. Only you see this - it's not sent to GitHub.">i</span>
            </div>
            <input
              type="text"
              value={newRepo.label}
              onChange={(e) =>
                setNewRepo({ ...newRepo, label: e.target.value })
              }
              placeholder="e.g. My Notes, Work Ideas, Learning"
              style={styles.input}
            />
            <p style={styles.hint}>
              A name to help you remember what this repo is for
            </p>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <div style={styles.labelRow}>
                <label style={styles.label}>Your GitHub Username</label>
                <span style={styles.infoTip} title="Your GitHub username. Find it at github.com - it's in the URL when you view your profile.">i</span>
              </div>
              <input
                type="text"
                value={newRepo.owner}
                onChange={(e) =>
                  setNewRepo({ ...newRepo, owner: e.target.value })
                }
                placeholder="e.g. johndoe"
                style={styles.input}
              />
            </div>
            <div style={styles.field}>
              <div style={styles.labelRow}>
                <label style={styles.label}>Repository Name</label>
                <span style={styles.infoTip} title="The name of your GitHub repository. This is what you called it when you created it (e.g. 'notes' or 'knowledge').">i</span>
              </div>
              <input
                type="text"
                value={newRepo.repo}
                onChange={(e) =>
                  setNewRepo({ ...newRepo, repo: e.target.value })
                }
                placeholder="e.g. notes, knowledge"
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.field}>
            <div style={styles.labelRow}>
              <label style={styles.label}>Folder for Notes</label>
              <span style={styles.infoTip} title="Your notes will be saved inside this folder. We'll organize them by date automatically (e.g. notes/2025/12/03/). Leave as 'notes' if unsure.">i</span>
            </div>
            <input
              type="text"
              value={newRepo.basePath}
              onChange={(e) =>
                setNewRepo({ ...newRepo, basePath: e.target.value })
              }
              placeholder="notes"
              style={styles.input}
            />
            <p style={styles.hint}>
              Your notes will appear here: <code>{newRepo.basePath || 'notes'}/2025/12/03/your-topic.md</code>
            </p>
          </div>

          <details style={styles.advancedSection}>
            <summary style={styles.advancedToggle}>Advanced settings</summary>
            <div style={styles.advancedContent}>
              <div style={styles.field}>
                <div style={styles.labelRow}>
                  <label style={styles.label}>Branch</label>
                  <span style={styles.infoTip} title="Which branch to save notes to. Most repos use 'main'. If you're not sure, leave this as 'main'.">i</span>
                </div>
                <input
                  type="text"
                  value={newRepo.defaultBranch}
                  onChange={(e) =>
                    setNewRepo({ ...newRepo, defaultBranch: e.target.value })
                  }
                  placeholder="main"
                  style={styles.input}
                />
                <p style={styles.hint}>
                  Usually "main" — only change if you know what you're doing
                </p>
              </div>
            </div>
          </details>

          <button onClick={addRepo} style={styles.addBtn}>
            Add Repository
          </button>
        </div>
      </section>

      {/* Default Tags Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Default Tags</h2>
        <p style={styles.sectionDesc}>
          Tags help you find and organize your notes later. These tags will be added to every note you capture.
        </p>
        <div style={styles.field}>
          <div style={styles.labelRow}>
            <label style={styles.label}>Tags to Add to Every Note</label>
            <span style={styles.infoTip} title="Tags are like labels or categories. They're saved in your note and help you search later. Separate multiple tags with commas.">i</span>
          </div>
          <input
            type="text"
            value={defaultTags}
            onChange={(e) => setDefaultTags(e.target.value)}
            placeholder="e.g. reference, learning, work"
            style={styles.input}
          />
          <p style={styles.hint}>
            Separate tags with commas. We automatically add "chatgpt" or "web" based on where you capture from.
          </p>
        </div>
        <div style={styles.tipBox}>
          <strong>Tip:</strong> You can also add hashtags directly in your content — they're extracted automatically.
          Ask ChatGPT: <em>"In every answer in this chat, add tags #idea #novel #thriller"</em>
          {' '}<a href="https://hulupeep.github.io/chat2rep-help/TAG_SET_UP" target="_blank" rel="noopener noreferrer" style={styles.tipLink}>See tagging instructions →</a>
        </div>
      </section>

      {/* Save Button */}
      <div style={styles.footer}>
        {message && (
          <p
            style={{
              ...styles.message,
              color: message.type === 'success' ? '#28a745' : '#dc3545',
            }}
          >
            {message.text}
          </p>
        )}
        <button
          onClick={saveSettings}
          disabled={saving}
          style={styles.saveBtn}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Support & Legal Section */}
      <section style={styles.supportSection}>
        <h2 style={styles.sectionTitle}>Support & Legal</h2>
        <div style={styles.supportLinks}>
          <a
            href="mailto:support@floutlabs.com"
            style={styles.supportLink}
          >
            <span style={styles.supportIcon}>✉️</span>
            <span>
              <strong>Contact Support</strong>
              <br />
              <span style={styles.supportDesc}>support@floutlabs.com</span>
            </span>
          </a>
          <a
            href="https://github.com/Hulupeep/chat2rep-help/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.supportLink}
          >
            <span style={styles.supportIcon}>🐛</span>
            <span>
              <strong>Report an Issue</strong>
              <br />
              <span style={styles.supportDesc}>GitHub Issues</span>
            </span>
          </a>
          <a
            href="https://hulupeep.github.io/chat2rep-help/PRIVACY"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.supportLink}
          >
            <span style={styles.supportIcon}>🔒</span>
            <span>
              <strong>Privacy Policy</strong>
              <br />
              <span style={styles.supportDesc}>How we handle your data</span>
            </span>
          </a>
          <a
            href="https://hulupeep.github.io/chat2rep-help/TERMS"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.supportLink}
          >
            <span style={styles.supportIcon}>📄</span>
            <span>
              <strong>Terms of Service</strong>
              <br />
              <span style={styles.supportDesc}>Usage terms and conditions</span>
            </span>
          </a>
        </div>
        <p style={styles.footerText}>
          chat2repo v1.0.0 • Made with ❤️ by{' '}
          <a
            href="https://floutlabs.com"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            Flout Labs
          </a>
        </p>
      </section>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 700,
    margin: '0 auto',
    padding: '40px 20px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 600,
    margin: '0 0 8px',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    margin: '0 0 12px',
  },
  helpLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    background: '#14B8A6',
    color: '#fff',
    borderRadius: 6,
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 500,
  },
  section: {
    background: '#f8f9fa',
    borderRadius: 8,
    padding: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    margin: '0 0 8px',
    color: '#1a1a1a',
  },
  sectionDesc: {
    fontSize: 14,
    color: '#666',
    margin: '0 0 16px',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 0,
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #ddd',
    borderRadius: 6,
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  quickSteps: {
    fontSize: 13,
    color: '#555',
    margin: '8px 0 16px',
    paddingLeft: 20,
    lineHeight: 1.8,
  },
  link: {
    color: '#0066cc',
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  infoTip: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#e0e0e0',
    color: '#666',
    fontSize: 11,
    cursor: 'help',
    fontStyle: 'normal',
  },
  advancedSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  advancedToggle: {
    fontSize: 13,
    color: '#666',
    cursor: 'pointer',
    padding: '8px 0',
  },
  advancedContent: {
    paddingTop: 12,
    borderTop: '1px solid #eee',
    marginTop: 8,
  },
  tipBox: {
    background: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: 6,
    padding: 12,
    fontSize: 13,
    color: '#166534',
    marginTop: 8,
  },
  tipLink: {
    color: '#15803d',
    textDecoration: 'underline',
  },
  row: {
    display: 'flex',
    gap: 16,
  },
  repoForm: {
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 6,
    padding: 16,
    marginTop: 16,
  },
  repoCard: {
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  repoHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  repoInfo: {
    fontSize: 12,
    color: '#666',
    margin: '4px 0 0',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#dc3545',
    cursor: 'pointer',
    fontSize: 12,
  },
  addBtn: {
    background: '#333',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
  },
  message: {
    fontSize: 14,
    margin: 0,
  },
  saveBtn: {
    background: '#0066cc',
    color: '#fff',
    border: 'none',
    padding: '12px 24px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
  calloutSection: {
    background: '#e7f5ff',
    border: '1px solid #74c0fc',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  calloutText: {
    fontSize: 14,
    color: '#1971c2',
    margin: 0,
  },
  supportSection: {
    background: '#f8f9fa',
    borderRadius: 8,
    padding: 24,
    marginTop: 24,
  },
  supportLinks: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
    marginBottom: 20,
  },
  supportLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 6,
    textDecoration: 'none',
    color: '#333',
    transition: 'border-color 0.2s',
  },
  supportIcon: {
    fontSize: 24,
  },
  supportDesc: {
    fontSize: 12,
    color: '#666',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center' as const,
    margin: 0,
  },
}

export default OptionsPage
