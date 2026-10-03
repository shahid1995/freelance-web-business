import Link from "next/link";
import { services } from "@/lib/services";
import { serviceNumber } from "@/components/service-list";
import { messaging } from "@/lib/content";

export const metadata = {
  title: "Contact",
  description: "Start a conversation about a website or web application project.",
};

// Sourced from the approved qualification flow in docs/sales/qualification-flow.md
const qualificationInputs = [
  "What does the client need built, improved, or maintained?",
  "Which current service category appears relevant?",
  "What problem is the work intended to solve?",
  "Is the request related to the business's approved web-development scope?",
  "Main pages, screens, workflows, or functions required",
  "Known integrations or external systems",
  "Expected user types or audiences",
  "Existing assets or systems that must be retained",
  "Known exclusions or constraints",
  "Whether the request is a defined project or still exploratory",
];

// The four approved qualification outcomes.
const qualificationOutcomes = [
  {
    key: "Qualified",
    body: "Enough information exists to prepare a proposal or move to the next defined sales step.",
  },
  {
    key: "Clarification required",
    body: "The opportunity may be relevant, but important information is missing.",
  },
  {
    key: "Not a fit",
    body: "The requested work materially falls outside the current service boundaries, risk tolerance, capacity, or approved business direction.",
  },
  {
    key: "No decision",
    body: "Information is insufficient to determine fit and no further action is currently justified.",
  },
];

export default function ContactPage() {
  return (
    <>
      <section className="section">
        <div className="container">
          <div className="page-head">
            <p className="eyebrow">Project discussion</p>
            <h1>Let’s start with the work you need.</h1>
            <p className="lede">{messaging.supporting}</p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="tell-heading">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Starting point</p>
            <h2 id="tell-heading">What to tell us.</h2>
            <p>
              The work is defined around the business need first. These are the
              questions that scope gets agreed against.
            </p>
          </div>

          <ol className="tell-list">
            {qualificationInputs.map((item, index) => (
              <li key={item}>
                <span className="tell-list__num">{serviceNumber(index)}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="fit-heading">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Service fit</p>
            <h2 id="fit-heading">What kinds of projects fit.</h2>
            <p>
              Each service is structured around a defined business need. If the
              request does not map to one of these, that is useful to know
              early.
            </p>
          </div>

          <ul className="legend">
            {services.map((service, index) => (
              <li className="legend__item" key={service.slug}>
                <span className="legend__key">
                  <Link href={`/services/${service.slug}`}>
                    <span className="service-row__index">
                      {serviceNumber(index)}
                    </span>{" "}
                    {service.title}
                  </Link>
                </span>
                <span className="legend__body">{service.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="next-heading">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Process</p>
            <h2 id="next-heading">What happens next.</h2>
            <p>
              Every conversation ends in one of four stated states. A
              qualification outcome is a process state for the opportunity, not
              a judgment about the client.
            </p>
          </div>

          <ul className="legend">
            {qualificationOutcomes.map((outcome) => (
              <li className="legend__item" key={outcome.key}>
                <span className="legend__key">{outcome.key}</span>
                <span className="legend__body">{outcome.body}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="status-heading">
        <div className="container">
          <div className="status-notice">
            <p className="status-notice__label">Current status</p>
            <p className="status-notice__body">
              The public contact flow is the next Phase 4 work item. It will
              collect only the information needed to qualify a project and route
              it into the approved sales process.
            </p>
            <p className="status-notice__body">
              No contact form or external submission integration is enabled in
              this scaffold. That keeps the current website free of unapproved
              live integrations and production side effects.
            </p>
          </div>

          <div className="cta-row">
            <Link className="button button-secondary" href="/services">
              Review services first
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}