import type { ReactNode } from 'react';
import './decision-section.css';

/** Shared cosmetic frame matching Profit Engine's four decision sections. */
export function DecisionSection({ id, number, eyebrow, title, children }: {
  id: string; number: '01' | '02' | '03' | '04'; eyebrow: string; title: string; children: ReactNode;
}) {
  return <section className="decision-section" data-decision-section={number} aria-labelledby={`${id}-heading`}>
    <div className="decision-section-title"><span aria-hidden="true">{number}</span><div><p>{eyebrow}</p><h2 id={`${id}-heading`}>{title}</h2></div></div>
    {children}
  </section>;
}
