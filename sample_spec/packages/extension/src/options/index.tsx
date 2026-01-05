import React from 'react'
import { createRoot } from 'react-dom/client'
import { OptionsPage } from './OptionsPage'

const container = document.getElementById('options-root')
if (container) {
  const root = createRoot(container)
  root.render(<OptionsPage />)
}
