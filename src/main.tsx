import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './cosmic-glass.css'
import './solar.css'
import './arduino.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
