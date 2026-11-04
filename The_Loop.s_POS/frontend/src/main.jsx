import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';

if (typeof window !== 'undefined') {
  if (!window.setAppView) {
    window.setAppView = (view) => {
      if (window.__loops_setAppView) {
        window.__loops_setAppView(view);
      }
    };
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

