import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Suppress Google Maps authentication failure alert dialog & popups
if (typeof window !== 'undefined') {
  (window as any).gm_authFailure = () => {
    console.info('[CrisisSync AI] Google Maps running in demo/offline mode.');
  };

  // Proactively remove any Google Maps error modal popup
  const dismissGoogleMapsErrorModal = () => {
    const errContainers = document.querySelectorAll('.gm-err-container, .gm-err-content, .gm-err-message');
    errContainers.forEach(el => el.remove());

    // Check for any floating modal containing "This page can't load Google Maps correctly"
    document.querySelectorAll('div').forEach(div => {
      const text = div.innerText || '';
      if (text.includes("This page can't load Google Maps correctly") || text.includes("Do you own this website")) {
        div.style.display = 'none';
        div.remove();
      }
    });
  };

  // Run cleanup on DOM mutations
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      dismissGoogleMapsErrorModal();
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      window.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  }

  // Initial and periodic run
  setInterval(dismissGoogleMapsErrorModal, 500);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)
