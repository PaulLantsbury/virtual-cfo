import { useState, type ReactNode } from 'react';
import { samplePlanKey } from '../lib/newProfitSavedPlan';
import { DEMO_STORE_ID, DEMO_USER_ID } from './DemoAuth';
import './demo.css';
const upcomingPages = ["Scout’s view", 'Marketing', 'Cash', 'Scenarios', 'Monitoring'];
export function AppLayout({ children }: { children: ReactNode; showMonitoring?: boolean }) {
  const [resetError, setResetError] = useState('');
  const resetSample = () => {
    try {
      // Remove only the synthetic demo identity's plan. Never clear application storage.
      window.localStorage.removeItem(samplePlanKey(DEMO_USER_ID, DEMO_STORE_ID));
      window.location.reload();
    } catch {
      setResetError('This browser could not reset the demo plan. Please allow browser storage and try again.');
    }
  };
  return <div className="ns-demo-shell">
    <a className="ns-demo-skip" href="#ns-demo-content">Skip to profit dashboard</a>
    <aside className="ns-demo-sidebar" aria-label="Night Scout demo navigation">
      <div className="ns-demo-brand"><img src="/nightscout-navigation.png" alt="Night Scout"/><span>YOUR BUSINESS. IN FOCUS.</span></div>
      <div className="ns-demo-store"><span className="ns-demo-store-icon" aria-hidden="true">S</span><div><strong>Scout &amp; Co</strong><small>Fictional sample store</small></div></div>
      <nav aria-label="Demo pages"><p className="ns-demo-nav-caption">YOUR CFO WORKSPACE</p>
        <span className="ns-demo-nav-item ns-demo-nav-active" aria-current="page"><span>Profit</span><span className="ns-demo-active-dot" aria-hidden="true"/></span>
        {upcomingPages.map(page=><span key={page} className="ns-demo-nav-item ns-demo-nav-unavailable"><span>{page}</span><small>Coming next</small></span>)}
      </nav>
      <div className="ns-demo-sidebar-foot"><span className="ns-demo-pill">DEMO</span><p>Explore the numbers.<br/>Find your next move.</p><small>Sample figures only</small></div>
    </aside>
    <div className="ns-demo-main">
      <header className="ns-demo-header">
        <div className="ns-demo-header-copy"><span className="ns-demo-pill">DEMO · SAMPLE DATA ONLY</span><strong>Scout &amp; Co · sample store</strong><p>No real store, financial account or data connection is used.</p></div>
        <button type="button" className="ns-demo-reset" onClick={resetSample}>Reset demo plan</button>
        {resetError&&<p className="ns-demo-reset-error" role="alert">{resetError}</p>}
      </header>
      <main id="ns-demo-content" className="ns-demo-content" tabIndex={-1}><div className="ns-demo-content-inner">{children}</div></main>
      <footer id="demo-marketing" className="ns-demo-footer"><span>Night Scout demo</span><span>Marketing detail is coming next · sample figures, not a forecast</span></footer>
    </div>
  </div>;
}
export default AppLayout;
