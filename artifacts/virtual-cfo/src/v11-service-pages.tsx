import { useEffect, useRef, useState } from "react";
import {
  Action,
  DataTable,
  Disclosure,
  Notice,
  Panel,
  Tabs,
  Verdict,
} from "./components/v11/primitives";
import { CASH_FIXTURE, formatMoney } from "./lib/v11";
import type { V11Section } from "./pages/v11/workspace";
import "./v11-service-pages.css";

interface ServiceProps {
  tab?: string;
  onTab?: (tab: string) => void;
  onEvidence?: () => void;
  onNavigate?: (section: V11Section, tab?: string) => void;
}
type MonitoringState =
  | "unavailable"
  | "ready"
  | "actionable"
  | "quiet"
  | "incomplete"
  | "delivery";
const MONITORING_STATES: {
  id: MonitoringState;
  label: string;
  title: string;
  detail: string;
  checked: string;
  coverage: string;
  next: string;
  action: string;
}[] = [
  {
    id: "unavailable",
    label: "Service unavailable",
    title: "Monitoring is not available in this build.",
    detail: "No checks or messages are running.",
    checked: "Not running",
    coverage: "Not available",
    next: "Not scheduled",
    action: "Review available data",
  },
  {
    id: "ready",
    label: "Ready to set up",
    title: "Choose what Night Scout should watch.",
    detail:
      "This fictional service is off by choice. Review its scope and consent before activation.",
    checked: "Not enabled",
    coverage: "Choose scope",
    next: "Not scheduled",
    action: "Review monitoring setup",
  },
  {
    id: "actionable",
    label: "Active and actionable",
    title: "One cash exception needs review.",
    detail: `A failed payout of ${formatMoney(CASH_FIXTURE.providerBalances.failed)} needs investigation. This is an example, not a live alert.`,
    checked: "1 Oct 2026, 08:00 London",
    coverage: "Complete selected scope",
    next: "2 Oct 2026, 08:00 London",
    action: "Review failed payout",
  },
  {
    id: "quiet",
    label: "Verified quiet",
    title: "No new material changes in the checked data.",
    detail:
      "A completed fictional check found no new material issue relative to the last completed review. Historical declines remain visible.",
    checked: "2 Oct 2026, 08:00 London",
    coverage: "Complete selected scope",
    next: "3 Oct 2026, 08:00 London",
    action: "View checked evidence",
  },
  {
    id: "incomplete",
    label: "Incomplete or failed data",
    title: "Cash checks could not be completed.",
    detail:
      "The example Xero update failed. Last usable evidence is dated 30 September; unaffected supported results are retained.",
    checked: "2 Oct 2026, 08:00 London · incomplete",
    coverage: "Cash source unavailable",
    next: "2 Oct 2026, 08:30 London · example retry",
    action: "Review connection issue",
  },
  {
    id: "delivery",
    label: "Delivery failed",
    title: "Briefing prepared but email delivery failed.",
    detail:
      "Analysis completed; delivery failed on 5 October at 08:02 London. The briefing remains readable in app.",
    checked: "5 Oct 2026, 08:00 London",
    coverage: "Complete selected scope",
    next: "5 Oct 2026, 08:30 London · example delivery retry",
    action: "Read briefing in app",
  },
];

export function V11Monitoring({ onNavigate, onEvidence }: ServiceProps) {
  const [state, setState] = useState<MonitoringState>("unavailable");
  const [consent, setConsent] = useState(false),
    [cadence, setCadence] = useState("Daily at 08:00 London"),
    [reviewed, setReviewed] = useState(false),
    [investigation, setInvestigation] = useState(false);
  const [watch, setWatch] = useState({
    profit: true,
    cash: true,
    actions: false,
  });
  const setupRef = useRef<HTMLDivElement>(null),
    investigationRef = useRef<HTMLDivElement>(null);
  const current = MONITORING_STATES.find((item) => item.id === state)!;
  useEffect(() => {
    setReviewed(false);
    setConsent(false);
    setInvestigation(false);
  }, [state]);
  const primary = () => {
    if (state === "unavailable" || state === "incomplete")
      onNavigate?.("settings", "connections");
    else if (state === "ready") {
      setReviewed(true);
      setupRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    } else {
      setInvestigation(true);
      setTimeout(() => {
        investigationRef.current?.focus();
        investigationRef.current?.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
      }, 0);
    }
  };
  return (
    <div className="v11-service">
      <details className="v11-review-state">
        <summary>Inspect a fictional workflow state</summary>
        <label>
          Monitoring example
          <select
            value={state}
            onChange={(event) =>
              setState(event.target.value as MonitoringState)
            }
          >
            {MONITORING_STATES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <p>
          Alternative reference states only. Selecting one does not enable a
          service or send a message.
        </p>
      </details>
      <div className="v11-service-strip" aria-label="Monitoring scope">
        <div>
          <span>Checks</span>
          <strong>{current.checked}</strong>
        </div>
        <div>
          <span>Coverage</span>
          <strong>{current.coverage}</strong>
        </div>
        <div>
          <span>Next check / retry</span>
          <strong>{current.next}</strong>
        </div>
      </div>
      <p className="v11-context-caption">
        {state === "quiet"
          ? "SAMPLE-QUIET-02"
          : state === "delivery"
            ? "SAMPLE-DELIVERY-05"
            : state === "ready" || state === "unavailable"
              ? "No completed check snapshot"
              : "SAMPLE-Q3-26"}{" "}
        · fictional workflow scope
      </p>
      <Verdict
        eyebrow="The monitoring view"
        title={current.title}
        description={current.detail}
        action={<Action onClick={primary}>{current.action}</Action>}
        tone={
          state === "incomplete" || state === "delivery"
            ? "warning"
            : state === "quiet"
              ? "success"
              : ""
        }
      />
      {state !== "unavailable" && (
        <Notice>
          Fictional workflow example · not the current status of Night Scout.
          Scheduling, consent storage and delivery are not implemented in this
          review.
        </Notice>
      )}
      {state === "ready" && (
        <div ref={setupRef}>
          <Panel
            title="Review monitoring setup"
            subtitle="Choose scope, cadence and consent. Nothing here is saved or activated."
          >
            <fieldset className="v11-checklist">
              <legend>What to watch</legend>
              {(
                [
                  ["profit", "Profit and contribution changes"],
                  ["cash", "Historical cash exceptions"],
                  ["actions", "Accepted action review dates"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={watch[key]}
                    onChange={(event) => {
                      setWatch({ ...watch, [key]: event.target.checked });
                      setReviewed(false);
                    }}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <div className="v11-service-form">
              <label>
                Cadence
                <select
                  value={cadence}
                  onChange={(event) => {
                    setCadence(event.target.value);
                    setReviewed(false);
                  }}
                >
                  <option>Daily at 08:00 London</option>
                  <option>Weekly Monday at 08:00 London</option>
                </select>
              </label>
              <label>
                Timezone
                <input type="text" value="Europe/London" readOnly />
              </label>
            </div>
            <p>
              Business-specific materiality thresholds and guardrails must be
              confirmed before live monitoring. No universal numeric threshold
              is assumed.
            </p>
            <label className="v11-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => {
                  setConsent(event.target.checked);
                  setReviewed(false);
                }}
              />
              I would consent to an email briefing for this reviewed scope.
            </label>
            {reviewed && (
              <Notice>
                <strong>Unsaved setup review.</strong>{" "}
                {Object.values(watch).filter(Boolean).length} scopes; {cadence};
                email consent{" "}
                {consent ? "selected in this draft" : "not selected"}.
                Activation remains unavailable.
              </Notice>
            )}
            <div className="v11-service-buttons">
              <Action secondary onClick={() => setReviewed(true)}>
                Review configuration
              </Action>
              <button type="button" className="v11-service-disabled" disabled>
                Activate monitoring
              </button>
              <span>
                Unavailable until secured scheduling and delivery exist.
              </span>
            </div>
          </Panel>
        </div>
      )}
      {state === "actionable" && investigation && (
        <div ref={investigationRef} tabIndex={-1}>
          <Panel
            title="Failed payout investigation"
            subtitle="Fictional provider evidence · SAMPLE-Q3-26"
          >
            <DataTable
              caption="Payout issue and next step"
              headers={["Evidence", "Value"]}
              rows={[
                ["Amount", formatMoney(CASH_FIXTURE.providerBalances.failed)],
                ["Status", "Failed payout; not available bank cash"],
                [
                  "Next step",
                  "Verify the provider record, failure reason and bank receipt before resolving",
                ],
                [
                  "Record access",
                  "No live provider record is attached to this design fixture",
                ],
              ]}
            />
            <Action
              secondary
              onClick={() => onNavigate?.("cash", "settlements")}
            >
              Review collections and settlements
            </Action>
          </Panel>
        </div>
      )}
      {state === "delivery" && (
        <div ref={investigationRef} tabIndex={-1}>
          <Panel title="Your prepared example briefing">
            <p>
              <strong>One cash exception needs review:</strong> the fictional
              failed payout is{" "}
              {formatMoney(CASH_FIXTURE.providerBalances.failed)}. Review its
              provider failure reason and confirm any bank receipt. No cash
              recovery or resolution has been established.
            </p>
            <p>
              Snapshot SAMPLE-DELIVERY-05 · analysis completed 5 October, 08:00
              London.
            </p>
            <h4>Analysis and delivery are separate</h4>
            <p>
              The fictional briefing contains one cash exception. A prepared
              briefing is not proof that email was delivered.
            </p>
            <DataTable
              caption="Example delivery history"
              headers={["Attempt", "Outcome"]}
              rows={[
                [
                  "5 Oct, 08:00 London",
                  "Analysis complete · SAMPLE-DELIVERY-05 · rule v11-example",
                ],
                [
                  "5 Oct, 08:02 London",
                  "Email failed · consent on in this fictional state",
                ],
                [
                  "5 Oct, 08:30 London",
                  "Illustrative retry time; no real retry is scheduled",
                ],
              ]}
            />
          </Panel>
        </div>
      )}
      {state === "quiet" && (
        <div ref={investigationRef} tabIndex={-1}>
          <Panel title="What was checked">
            <p>
              Snapshot SAMPLE-QUIET-02 · completed 2 October 2026, 08:00 London.
            </p>
            <p>
              Fictional rule v11-example checked the supported
              profit/contribution, mapped historical cash and review-date scope
              against the last completed review. Adequate coverage and
              completion support this quiet example; empty data alone never
              does.
            </p>
            <p>
              No immediate “all clear” email is sent simply to prove activity.
            </p>
          </Panel>
        </div>
      )}
      <Panel
        title="What will be monitored"
        subtitle="Available only after the supporting service and permissions are implemented."
      >
        <Disclosure
          title="Profit and contribution changes"
          summary="Scoped material changes, with evidence"
        >
          <p>
            Check supported sales, costs and contribution against matched
            periods and versioned business thresholds. Incomplete costs withhold
            profit conclusions.
          </p>
        </Disclosure>
        <Disclosure
          title="Historical cash exceptions"
          summary="Balances, movements and settlement exceptions"
        >
          <p>
            Check dated mapped bank balances and provider exceptions. Historical
            cash does not establish future spending capacity.
          </p>
        </Disclosure>
        <Disclosure
          title="Accepted action reviews"
          summary="Review dates linked to a saved action version"
        >
          <p>
            Only supported, permission-checked saved action records can enter a
            review queue. This build does not create those records or reminders.
          </p>
        </Disclosure>
      </Panel>
      <Disclosure title="Check history and preferences">
        <DataTable
          caption="Service boundaries"
          headers={["Capability", "Availability"]}
          rows={[
            [
              "Check history",
              state === "unavailable"
                ? "No service checks running"
                : "Fictional state only; no live check history loaded",
            ],
            ["Channel consent", "Not stored"],
            ["Notifications and retries", "Unavailable"],
            [
              "Snooze / reschedule",
              "Unavailable until versioned history and permissions exist",
            ],
          ]}
        />
        <button type="button" className="v11-service-disabled" disabled>
          Save preferences
        </button>
      </Disclosure>
    </div>
  );
}

const SETTINGS_TABS = [
  { id: "connections", label: "Connections" },
  { id: "guardrails", label: "Business guardrails" },
  { id: "team", label: "Team & access" },
];
export function V11Settings({ tab, onTab, onEvidence }: ServiceProps) {
  const active = SETTINGS_TABS.some((item) => item.id === tab)
    ? tab!
    : "connections";
  const [costReview, setCostReview] = useState(false);
  return (
    <div className="v11-service">
      <p className="v11-context-caption">
        Alternative incomplete fixture · snapshot: 1 Oct 2026, 08:00 London. Not
        live connection status.
      </p>
      {active === "connections" && (
        <Verdict
          eyebrow="The settings view"
          title="Resolve the data gap to unlock trusted decisions."
          description="12 products lack mapped costs. Supported sales remain available; complete profit advice does not."
          action={
            <Action onClick={() => setCostReview(!costReview)}>
              Review missing product costs
            </Action>
          }
        />
      )}
      {active === "guardrails" && (
        <Verdict
          eyebrow="Business guardrails"
          title="Set limits that reflect your business."
          description="Define your basis and consequences. Draft settings are not saved or applied."
          action={
            <Action
              onClick={() =>
                document.getElementById("v11-guardrails-review")?.click()
              }
            >
              Review guardrails
            </Action>
          }
        />
      )}
      {active === "team" && (
        <Verdict
          eyebrow="Team and access"
          title="Make responsibilities clear."
          description="Review the planned access policy. This view does not create members or change permissions."
          action={
            <Action
              onClick={() => {
                const policy = document.getElementById("v11-access-policy");
                policy?.focus();
                policy?.scrollIntoView({ block: "center", behavior: "smooth" });
              }}
            >
              Review access policy
            </Action>
          }
        />
      )}
      <Tabs
        tabs={SETTINGS_TABS}
        active={active}
        onChange={(value) => onTab?.(value)}
        label="Settings pages"
      />
      {active === "connections" && (
        <>
          <Panel
            title="Connected systems"
            subtitle="Fictional credentials, collection and financial readiness are separate checks."
          >
            <DataTable
              caption="Example source status · data through 30 September 2026"
              headers={[
                "Provider",
                "Connection / collection",
                "Financial readiness",
                "Last sample sync",
                "Actions",
              ]}
              rows={[
                [
                  "Shopify",
                  <>
                    <strong>Connected</strong>
                    <br />
                    Ready through 30 Sep
                  </>,
                  <>
                    Complete
                    <br />
                    Sales complete
                  </>,
                  "30 Sep 2026 · 23:42",
                  <UnavailableConnectionActions />,
                ],
                [
                  "Xero",
                  <>
                    <strong>Connected</strong>
                    <br />
                    Needs cost review
                  </>,
                  <>
                    Incomplete
                    <br />
                    12 products without COGS
                  </>,
                  "30 Sep 2026 · 23:16",
                  <UnavailableConnectionActions />,
                ],
                [
                  "Meta",
                  <>
                    <strong>Connected</strong>
                    <br />
                    Ready through 30 Sep
                  </>,
                  <>
                    Selected spend collected
                    <br />
                    Attribution scope still matters
                  </>,
                  "30 Sep 2026 · 23:03",
                  <UnavailableConnectionActions />,
                ],
                [
                  "Google Ads",
                  <>
                    <strong>Connected</strong>
                    <br />
                    Ready through 30 Sep
                  </>,
                  <>
                    Selected spend collected
                    <br />
                    Attribution scope still matters
                  </>,
                  "30 Sep 2026 · 20:55",
                  <UnavailableConnectionActions />,
                ],
              ]}
            />
          </Panel>
          {costReview && (
            <Panel
              title="Review missing product costs"
              subtitle="Read-only investigation · 12 affected products in this alternative example"
            >
              <p>
                Your Finance lead resolves product-to-cost mapping; Night Scout
                support owns import faults. Confirm historical landed costs and
                saleable-return dates before recalculating dependent profit.
              </p>
              <Notice>
                Individual product records are not supplied in this fixture. No
                live mapping can be edited here, and no invented product list is
                shown.
              </Notice>
              <DataTable
                caption="Evidence needed to complete the cost review"
                headers={["Required evidence", "Why it matters"]}
                rows={[
                  [
                    "Affected product IDs and original eligible sale dates",
                    "Match the correct historical scope",
                  ],
                  [
                    "Effective-dated landed unit costs",
                    "Do not substitute current prices or a zero cost",
                  ],
                  [
                    "Recoverable return-to-stock evidence",
                    "Recover COGS only when goods re-enter saleable stock",
                  ],
                ]}
              />
            </Panel>
          )}
          <div className="v11-service-columns">
            <Panel title="Who resolves this?">
              <p>Finance lead: product-to-cost mapping.</p>
              <p>Night Scout support: import faults.</p>
            </Panel>
            <Panel title="Example gap">
              <p>
                12 products without COGS. This is a partial cost gap; unaffected
                sales remain available.
              </p>
            </Panel>
            <Panel title="Background updates">
              <p>
                Connected services should update without owner visits. Opening
                this review neither refreshes nor validates a source.
              </p>
            </Panel>
          </div>
          <Disclosure title="Financial readiness and retained evidence">
            <DataTable
              caption="Readiness is more than a connection"
              headers={["Layer", "Required proof"]}
              rows={[
                [
                  "Credentials",
                  "Authorised connection to the correct business",
                ],
                ["Collection", "Successful, scoped and dated source import"],
                [
                  "Financial readiness",
                  "Complete required mappings, costs and exclusions",
                ],
                [
                  "Retained result",
                  "Dated same-scope supported snapshot; never current by assumption",
                ],
              ]}
            />
          </Disclosure>
          <Disclosure
            title="Technical run history"
            summary="Fictional example; no live logs"
          >
            <p>
              The displayed times belong to this design fixture. They are not
              evidence of a current outage or completed scheduled run.
            </p>
            <p>
              Permission-checked operational history remains in the current
              reporting tools.
            </p>
          </Disclosure>
          <Disclosure title="Account, billing and authorised review">
            <p>
              Export, disconnect and billing are unavailable until their secured
              services exist. Financial review is a permission-checked exception
              workflow; no permission is granted by this page.
            </p>
            <button type="button" className="v11-service-disabled" disabled>
              Manage billing
            </button>
          </Disclosure>
        </>
      )}
      {active === "guardrails" && <GuardrailDraft />}
      {active === "team" && (
        <div id="v11-access-policy" tabIndex={-1}>
          <Panel
            title="Team and access"
            subtitle="Planned policy only. No identities or invitations are fabricated."
          >
            <DataTable
              caption="Planned responsibilities; not a grant of these permissions"
              headers={["Role", "Responsibilities", "Availability"]}
              rows={[
                [
                  "Owner",
                  "Manage authorised access and connections; preserve review history",
                  "Planned policy",
                ],
                [
                  "Finance",
                  "Edit authorised cost mappings and guardrails within the business",
                  "Planned policy",
                ],
                [
                  "Viewer",
                  "Read evidence permitted for that business",
                  "Planned policy",
                ],
              ]}
            />
            <Notice>
              Server-side business isolation and role enforcement must be
              verified before this policy can be enabled.
            </Notice>
            <button type="button" className="v11-service-disabled" disabled>
              Invite team member
            </button>
            <p className="v11-muted">
              Invitations are unavailable until delivery and secured access
              management are implemented.
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}
function UnavailableConnectionActions() {
  return (
    <div className="v11-connection-actions">
      <div>
        <button type="button" disabled>
          Export
        </button>
        <button type="button" disabled>
          Disconnect
        </button>
      </div>
      <small>Unavailable in this build</small>
    </div>
  );
}
const initialGuardrails = {
  owner: "",
  effective: "",
  contribution: "",
  loss: "",
  payback: "",
  reserve: "",
  goal: "",
  rationale: "",
};
function GuardrailDraft() {
  const [draft, setDraft] = useState(initialGuardrails),
    [review, setReview] = useState(false),
    [error, setError] = useState("");
  const update = (key: keyof typeof draft, value: string) => {
    setDraft({ ...draft, [key]: value });
    setReview(false);
    setError("");
  };
  const reviewDraft = () => {
    if (!draft.owner.trim() || !draft.effective || !draft.rationale.trim()) {
      setError(
        "Choose an owner, an effective date and a rationale before reviewing this draft.",
      );
      setReview(false);
      return;
    }
    for (const key of ["contribution", "loss", "payback", "reserve"] as const)
      if (
        draft[key] !== "" &&
        (!Number.isFinite(Number(draft[key])) || Number(draft[key]) < 0)
      ) {
        setError(
          "Enter a non-negative value or leave an unconfirmed limit blank.",
        );
        setReview(false);
        return;
      }
    setError("");
    setReview(true);
  };
  return (
    <div className="v11-service-columns guardrails">
      <Panel
        title="Basis and limits"
        subtitle="Choose basis → Set limits → Review effective date. No universal numeric defaults."
      >
        <ol className="v11-guardrail-steps">
          <li>1 · Choose basis</li>
          <li>2 · Set limits</li>
          <li>3 · Review effective date</li>
        </ol>
        <div className="v11-service-form">
          <label>
            Responsible owner
            <select
              value={draft.owner}
              onChange={(event) => update("owner", event.target.value)}
            >
              <option value="">Choose responsibility</option>
              <option>Store owner</option>
              <option>Finance lead</option>
            </select>
          </label>
          <label>
            Effective date
            <input
              type="date"
              value={draft.effective}
              onChange={(event) => update("effective", event.target.value)}
            />
          </label>
          <label>
            Required contribution per order · GBP
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Not set"
              value={draft.contribution}
              onChange={(event) => update("contribution", event.target.value)}
            />
          </label>
          <label>
            Maximum first-order loss · GBP
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Not set"
              value={draft.loss}
              onChange={(event) => update("loss", event.target.value)}
            />
          </label>
          <label>
            Maximum observed payback · days
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Not set"
              value={draft.payback}
              onChange={(event) => update("payback", event.target.value)}
            />
          </label>
          <label>
            Cash reserve preference · GBP
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Not set"
              value={draft.reserve}
              onChange={(event) => update("reserve", event.target.value)}
            />
          </label>
          <label>
            Owner goal
            <input
              type="text"
              placeholder="Describe your goal"
              value={draft.goal}
              onChange={(event) => update("goal", event.target.value)}
            />
          </label>
          <label>
            Rationale and basis
            <input
              type="text"
              placeholder="Explain the basis for these limits"
              value={draft.rationale}
              onChange={(event) => update("rationale", event.target.value)}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="v11-field-error">
            {error}
          </p>
        )}
        <div className="v11-service-buttons">
          <button type="button" className="v11-service-disabled" disabled>
            Save guardrails
          </button>
          <button
            type="button"
            id="v11-guardrails-review"
            className="v11-action secondary"
            onClick={reviewDraft}
          >
            Review guardrails →
          </button>
        </div>
        <p className="v11-muted">
          Saving is unavailable. This draft is lost when you leave the page or
          reload.
        </p>
        {review && (
          <div aria-live="polite">
            <Notice>
              <strong>Unsaved draft review.</strong> No guardrail has been
              applied.
            </Notice>
            <DataTable
              caption="Proposed basis and effective date"
              headers={["Field", "Draft"]}
              rows={[
                ["Owner responsibility", draft.owner],
                ["Effective date", draft.effective],
                [
                  "Required contribution per order",
                  draft.contribution ? `£${draft.contribution}` : "Unconfirmed",
                ],
                [
                  "Maximum first-order loss",
                  draft.loss ? `£${draft.loss}` : "Unconfirmed",
                ],
                [
                  "Maximum observed payback",
                  draft.payback ? `${draft.payback} days` : "Unconfirmed",
                ],
                [
                  "Reserve preference",
                  draft.reserve ? `£${draft.reserve}` : "Unconfirmed",
                ],
                ["Goal", draft.goal || "Unconfirmed"],
                ["Rationale", draft.rationale],
              ]}
            />
          </div>
        )}
      </Panel>
      <div>
        <Panel title="What these limits do">
          <p>
            Limits guide interpretation and review. A chosen cash reserve is a
            preference, not proof that cash is free to spend.
          </p>
          <p>
            Commitments, dated bank coverage and payback evidence remain
            separate.
          </p>
        </Panel>
        <Disclosure title="Effective date and history">
          <p>
            A future secured implementation must retain previous values, owner,
            rationale and effective dates. No saved versions exist in this
            review.
          </p>
        </Disclosure>
        <Disclosure title="Cost coverage needs review">
          <p>
            This alternative fixture has 12 products without mapped costs.
            Guardrails cannot repair missing financial evidence.
          </p>
        </Disclosure>
      </div>
    </div>
  );
}
