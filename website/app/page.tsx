import Link from "next/link";
import { ServiceList, serviceNumber } from "@/components/service-list";
import { services } from "@/lib/services";
import { messaging, portfolioStatus, site } from "@/lib/content";

export const metadata = {
  title: messaging.primary,
  description: site.description,
};

// Problem hierarchy as published in the approved positioning documents.
const problemLevels = [
  {
    name: "Presence",
    body: "The organization needs a professional web presence or a focused page for a specific offer.",
  },
  {
    name: "Clarity",
    body: "The organization has a website, but users cannot quickly understand the business, offer, or next action.",
  },
  {
    name: "Experience",
    body: "The site has usability, responsive, navigation, accessibility, performance, or consistency problems.",
  },
  {
    name: "Function",
    body: "The organization needs functionality beyond a standard marketing site, such as a dashboard, portal, workflow, or custom application.",
  },
  {
    name: "Continuity",
    body: "The organization has an existing web system that needs fixes, improvements, maintenance, or incremental modernization.",
  },
];

// The approved working approach, split into its five stated steps.
const workingApproach = [
  "Start from the actual business need",
  "Define the work clearly",
  "Implement the agreed solution",
  "Verify the important behavior",
  "Hand over a maintainable result",
];

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">Web development</p>
            <h1>{messaging.primary}</h1>
            <p className="lede">{messaging.supporting}</p>

            <div className="cta-row">
              <Link className="button" href="/contact">
                {messaging.ctaPrimary}
              </Link>
              <Link className="button button-secondary" href="/services">
                {messaging.ctaSecondary}
              </Link>
            </div>
          </div>

          <aside
            className="panel panel-focal hero-note"
            aria-label="Working approach"
          >
            <p className="eyebrow">How the work is approached</p>
            <p>{messaging.approach}</p>
          </aside>
        </div>
      </section>

      <section className="section" aria-labelledby="problems-heading">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Problem</p>
            <h2 id="problems-heading">The problems this work addresses.</h2>
            <p>
              The business helps organizations turn outdated, unclear, or
              incomplete web experiences into modern, usable, maintainable
              websites and web applications.
            </p>
          </div>

          <div className="problem-list">
            {problemLevels.map((problem, index) => (
              <div className="problem" key={problem.name}>
                <span className="problem__index">
                  {serviceNumber(index)}
                </span>
                <h3 className="problem__name">{problem.name}</h3>
                <p className="problem__body">{problem.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="services-heading">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Services</p>
            <h2 id="services-heading">
              Focused help across the web lifecycle.
            </h2>
            <p>
              Each service is structured around a defined business need rather
              than an open-ended feature list. Scope, deliverables, and
              boundaries are agreed before implementation.
            </p>
          </div>

          <ServiceList items={services} showSignals signalCount={3} />
        </div>
      </section>

      <section className="section" aria-labelledby="approach-heading">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Working approach</p>
            <h2 id="approach-heading">How the work runs.</h2>
            <p>{messaging.approach}</p>
          </div>

          <ol className="steps">
            {workingApproach.map((step, index) => (
              <li className="step" key={step}>
                <span className="step__index">{serviceNumber(index)}</span>
                <p className="step__text">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="work-heading">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Work</p>
            <h2 id="work-heading">
              Portfolio work appears only after publication review.
            </h2>
            <p>{portfolioStatus.summary}</p>
          </div>

          <div className="ownership">
            <h3 className="label-heading">How portfolio items are labeled</h3>
            <p className="ownership__note">{portfolioStatus.conceptNote}</p>

            <ul className="legend">
              {portfolioStatus.ownershipCategories.map((category) => {
                const [key, ...rest] = category.split(" — ");
                return (
                  <li className="legend__item" key={category}>
                    <span className="legend__key">{key}</span>
                    <span className="legend__body">{rest.join(" — ")}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="cta-row">
            <Link className="button button-secondary" href="/work">
              {messaging.ctaWork}
            </Link>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="contact-heading">
        <div className="container">
          <div className="cta-band">
            <h2 id="contact-heading">{messaging.primary}</h2>
            <p>{messaging.supporting}</p>
            <div className="cta-row">
              <Link className="button" href="/contact">
                {messaging.ctaPrimary}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}