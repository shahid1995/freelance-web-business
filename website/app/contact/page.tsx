import Link from "next/link";
import { services } from "@/lib/services";
import { serviceNumber } from "@/components/service-list";
import { messaging } from "@/lib/content";

export const metadata = {
  title: "Contact",
  description: "Start a conversation about a website or web application project.",
};

// Customer-facing prompts for a project discussion. These are written for
// visitors, not derived from the internal qualification questionnaire.
const projectDiscussionInputs = [
  "What you need built, improved, or maintained",
  "The main pages, screens, features, or workflows involved",
  "What already exists and what needs to remain",
  "Who the website or application is for",
  "Any important integrations, dependencies, or constraints",
  "Your desired timing or launch target",
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
              The work is defined around the business need first, so these
              details are the most useful place to start.
            </p>
          </div>

          <ol className="tell-list">
            {projectDiscussionInputs.map((item, index) => (
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
              The goal is a clear picture of the work, agreed before anything is
              defined.
            </p>
          </div>

          <div className="status-notice">
            <p className="status-notice__label">Next steps</p>
            <p className="status-notice__body">
              Once we understand the project, the next step is to clarify the
              main scope, deliverables, dependencies, and any important
              constraints before the work is defined.
            </p>
            <p className="status-notice__body">
              Where the request fits the services offered, the next commercial
              step can then be agreed.
            </p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="status-heading">
        <div className="container">
          <div className="status-notice">
            <p className="status-notice__label" id="status-heading">
              Current status
            </p>
            <p className="status-notice__body">
              Contact options are being finalized. For now, reviewing the
              services and preparing the project details above is the best place
              to start.
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