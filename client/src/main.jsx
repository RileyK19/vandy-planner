import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { RecommendationsProvider } from './RecommendationContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RecommendationsProvider>
      <App />
    </RecommendationsProvider>
  </React.StrictMode>,
)