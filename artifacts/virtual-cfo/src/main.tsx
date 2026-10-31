import { createRoot } from "react-dom/client";
import "./index.css";

// The local design review has no auth SDK, store queries or merchant data.
// This entry is excluded from production; protected /v11 routes use App's gate.
const reviewPath = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/design/v11`;
if (import.meta.env.DEV && (window.location.pathname === reviewPath || window.location.pathname.startsWith(`${reviewPath}/`))) {
  void Promise.all([import('./v11-preview'), import('wouter')]).then(([{default: Preview}, {Router}]) => {
    createRoot(document.getElementById('root')!).render(<Router base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Preview reviewMode /></Router>);
  });
} else {
  void import('./App').then(({default: App}) => createRoot(document.getElementById('root')!).render(<App />));
}
