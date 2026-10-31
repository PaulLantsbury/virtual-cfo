import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  BarChart3,
  TrendingUp,
  Megaphone,
  Wallet,
  ClipboardList,
  Bell,
  Settings,
  Menu,
  X,
} from "lucide-react";
import V11Workspace from "./pages/v11/workspace";
import "./v11-preview.css";

export const V11_DESTINATIONS = [
  { id: "scout", title: "Scout’s View", icon: BarChart3 },
  { id: "profit", title: "Profit Engine", icon: TrendingUp },
  { id: "growth", title: "Growth & Marketing", icon: Megaphone },
  { id: "cash", title: "Cash Control", icon: Wallet },
  { id: "plan", title: "Plan", icon: ClipboardList },
  { id: "monitoring", title: "Monitoring", icon: Bell },
  { id: "settings", title: "Settings", icon: Settings },
] as const;
type Section = (typeof V11_DESTINATIONS)[number]["id"];

/** Explicit fixture surface. Never feeds sample values into merchant reporting. */
export default function V11Preview({
  reviewMode = false,
}: {
  reviewMode?: boolean;
}) {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const [mobileOpen, setMobileOpen] = useState(false);
  const prefix = reviewMode ? "/design/v11" : "/v11";
  const candidate = location.slice(prefix.length).split("/").filter(Boolean)[0];
  const section: Section = V11_DESTINATIONS.some(
    (item) => item.id === candidate,
  )
    ? (candidate as Section)
    : "scout";
  const initialTab = new URLSearchParams(search).get("tab") ?? undefined;
  useEffect(() => {
    setMobileOpen(false);
  }, [location, search]);
  return (
    <div className="v11-shell">
      <a className="v11-skip" href="#v11-content">
        Skip to page content
      </a>
      <header className="v11-mobile-bar">
        <span>
          night<span className="v11-brand-blue">scout</span>
        </span>
        <button
          type="button"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
          aria-controls="v11-navigation"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </header>
      <aside className={`v11-nav ${mobileOpen ? "is-open" : ""}`}>
        <Link
          href={`${prefix}/scout`}
          className="v11-logo"
          aria-label="Night Scout — Scout’s View"
        >
          <img
            src={`${import.meta.env.BASE_URL}nightscout-navigation.png`}
            alt="Night Scout"
          />
        </Link>
        <p className="v11-tagline">Your business. In focus.</p>
        <nav id="v11-navigation" aria-label="Night Scout destinations">
          {V11_DESTINATIONS.map(({ id, title, icon: Icon }) => (
            <Link
              key={id}
              href={`${prefix}/${id}`}
              aria-current={section === id ? "page" : undefined}
            >
              <Icon aria-hidden="true" size={21} />
              <span>{title}</span>
              {section === id && (
                <span className="v11-nav-dot" aria-hidden="true" />
              )}
            </Link>
          ))}
        </nav>
        <div className="v11-nav-foot">
          <span>Approved design v11</span>
          {!reviewMode && (
            <Link href="/dashboard">Return to current reporting</Link>
          )}
        </div>
      </aside>
      <div className="v11-main">
        <div className="v11-sample-context" role="note">
          <div>
            <span className="v11-sample-badge">
              Fictional data · design review
            </span>
            <span>Scout &amp; Co · sample store</span>
          </div>
          <p>
            No real store or financial connection is used. Examples do not
            certify live integrations.
          </p>
        </div>
        <main id="v11-content" tabIndex={-1}>
          <V11Workspace
            section={section}
            initialTab={initialTab}
            onNavigate={(next, tab) =>
              navigate(
                `${prefix}/${next}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`,
              )
            }
          />
        </main>
      </div>
    </div>
  );
}
