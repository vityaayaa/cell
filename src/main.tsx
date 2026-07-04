import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { ThemeProvider } from './app/ThemeProvider'
import { AppRouter } from './app/router'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AppRouter />
      <Toaster
        position="top-center"
        richColors
        closeButton
        duration={2000}
        swipeDirections={['top', 'left', 'right']}
      />
    </ThemeProvider>
  </StrictMode>,
)
