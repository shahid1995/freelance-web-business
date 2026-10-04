import Link from "next/link";
import { portfolioStatus, messaging } from "@/lib/content";
import { serviceNumber } from "@/components/service-list";

export const metadata = {
  title: "Work",
  description:
    "Portfolio work and case studies will appear here after ownership, evidence, confidentiality, and publication permission are reviewed.",
};

export default function WorkPage() {
  return (
    <>
      <section className="section">
        <div className="container">
          <div className="page-head">
            <p className="eyebrow">Work</p>
            <h1>
              Selected work will appear here as it becomes publication-ready.
            </h1>
            <p className="lede">
              The portfolio registry currently contains candidate concepts
              rather than approved published projects. This page intentionally
              avoids presenting unverified work as completed client work.
            </p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="slots-heading">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Current portfolio status</p>
            <h2 id="slots-heading">Concept slots awaiting evidence.</h2>
            <p>The portfolio registry includes concept slots for:</p>
          </div>

          <ul className="slot-grid">
            {portfolioStatus.currentSlots.map((slot) => (
              <li className="slot" key={slot}>
                <span className="slot__badge">Concept slot</span>
                <span className="slot__title">{slot}</span>
                <p className="slot__note">
                  Not published. Not represented as completed client work.
                </p>
              </li>
            ))}
          </ul>

          <p className="ownership__note">{portfolioStatus.slotNote}</p>
          <p className="ownership__note">{portfolioStatus.summary}</p>
        </div>
      </section>

      <section className="section" aria-labelledby="ownership-heading">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Evidence</p>
            <h2 id="ownership-heading">Ownership categories</h2>
            <p>
              When portfolio items are published, they will be labeled using one
              of these ownership categories:
            </p>
          </div>

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

          <p className="ownership__note">{portfolioStatus.conceptNote}</p>
        </div>
      </section>

      <section className="section" aria-labelledby="publication-heading">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Publication requirements</p>
            <h2 id="publication-heading">
              What must exist before an item is published.
            </h2>
            <p>
              Portfolio items are added only after the project record, scope,
              evidence, confidentiality review, factual-accuracy review, and
              required publication permission are satisfied.
            </p>
            <p>
              Before an item becomes a public case study, the repository must
              contain:
            </p>
          </div>

          <ol className="checklist">
            {portfolioStatus.publicationRequirements.map(
              (requirement, index) => (
                <li key={requirement}>
                  <span className="checklist__num">
                    {serviceNumber(index)}
                  </span>
                  <span>{requirement}</span>
                </li>
              ),
            )}
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="work-cta-heading">
        <div className="container">
          <div className="cta-band">
            <h2 id="work-cta-heading">{messaging.primary}</h2>
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