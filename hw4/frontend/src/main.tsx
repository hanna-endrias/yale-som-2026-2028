import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth.tsx'
import { SearchResultsProvider } from './searchResults.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SearchResultsProvider>
          <App />
        </SearchResultsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
