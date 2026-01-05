/**
 * Extension popup - quick access and status
 * Contract: ARCH-002 - No direct GitHub API calls
 */

import React, { useState, useEffect } from 'react'
import type { ConfigStatusResponse } from '../shared/messages'

export function Popup() {
  const [status, setStatus] = useState<ConfigStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkStatus()
  }, [])

  async function checkStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'get-config-status',
      })
      setStatus(response)
    } catch (error) {
      setStatus({ configured: false, hasToken: false, hasRepos: false })
    } finally {
      setLoading(false)
    }
  }

  function openOptions() {
    chrome.runtime.openOptionsPage()
  }

  function openRepo() {
    if (status?.configured && status.defaultRepo) {
      const { owner, repo } = status.defaultRepo
      chrome.tabs.create({ url: `https://github.com/${owner}/${repo}` })
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <p style={styles.loading}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>chat2repo</h1>
          <button onClick={openOptions} style={styles.settingsButton} aria-label="Settings">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
        <p style={styles.subtitle}>Now your ideas live where your code lives</p>
      </header>

      {status?.configured ? (
        <div style={styles.content}>
          <div style={styles.statusBadge}>
            <span style={styles.statusDot}></span>
            Connected
          </div>
          <p style={styles.info}>
            Select text on any page and right-click to send to GitHub,
            or use the paper airplane button{' '}
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={styles.inlineIcon}>
              <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/>
              <path d="m21.854 2.147-10.94 10.939"/>
            </svg>{' '}
            on ChatGPT messages.
          </p>
          <div style={styles.banner}>
            Ready for Pro? <a href="https://hulupeep.github.io/chat2rep-help/PRO" target="_blank" rel="noopener noreferrer" style={styles.bannerLink}>Limited seats</a> for beta.
          </div>
        </div>
      ) : (
        <div style={styles.content}>
          <div style={{ ...styles.statusBadge, background: '#fff3cd' }}>
            <span style={{ ...styles.statusDot, background: '#ffc107' }}></span>
            Not configured
          </div>
          <p style={styles.info}>
            Set up your GitHub token and repository to start capturing notes.
          </p>
          <button onClick={openOptions} style={styles.button}>
            Open Settings
          </button>
        </div>
      )}

      <footer style={styles.footer}>
        <button
          onClick={openRepo}
          disabled={!status?.configured}
          data-testid="open-repo-button"
          style={status?.configured ? styles.openRepoButton : styles.openRepoButtonDisabled}
        >
          Open Repo
        </button>
        <a
          href="https://hulupeep.github.io/chat2rep-help"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.helpLink}
        >
          Help & Docs
        </a>
      </footer>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 300,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    padding: '16px 16px 12px',
    borderBottom: '1px solid #eee',
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    color: '#202124',
  },
  subtitle: {
    fontSize: 11,
    color: '#5f6368',
    margin: 0,
  },
  settingsButton: {
    background: 'none',
    border: 'none',
    color: '#5f6368',
    padding: 4,
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#d4edda',
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
    color: '#333',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#28a745',
  },
  info: {
    fontSize: 13,
    color: '#666',
    lineHeight: 1.5,
    margin: '12px 0 0',
  },
  button: {
    marginTop: 12,
    width: '100%',
    padding: '10px 16px',
    background: '#0066cc',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  openRepoButton: {
    background: '#f0f0f0',
    border: 'none',
    color: '#333',
    fontSize: 12,
    padding: '6px 12px',
    borderRadius: 4,
    cursor: 'pointer',
  },
  openRepoButtonDisabled: {
    background: '#f0f0f0',
    border: 'none',
    color: '#999',
    fontSize: 12,
    padding: '6px 12px',
    borderRadius: 4,
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  helpLink: {
    color: '#1a73e8',
    fontSize: 12,
    textDecoration: 'none',
  },
  banner: {
    background: '#e8f0fe',
    padding: 8,
    borderRadius: 4,
    fontSize: 11,
    color: '#1967d2',
    marginTop: 12,
  },
  bannerLink: {
    color: '#1967d2',
    textDecoration: 'underline',
  },
  inlineIcon: {
    verticalAlign: 'middle',
    display: 'inline',
    marginBottom: 2,
  },
  loading: {
    padding: 20,
    textAlign: 'center',
    color: '#666',
  },
}

export default Popup
