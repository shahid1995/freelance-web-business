import { portfolioStatus } from "@/lib/content";

export const metadata = {
  title: "Work",
  description:
    "Portfolio work and case studies will appear here after ownership, evidence, confidentiality, and publication permission are reviewed.",
};

export default function WorkPage() {
  return (
    <section className="section">
      <div className="container">
        <section>
          <p className="eyebrow">Work</p>
          <h1>Portfolio work appears only after review</h1>
          <p>{portfolioStatus.summary}</p>
        </section>

        <section aria-labelledby="publication-heading">
          <h2 id="publication-heading">Publication requirements</h2>
          <ul className="prose">
            <li>A completed project record with its canonical Project ID</li>
            <li>Accurate ownership and role</li>
            <li>Defined scope</li>
            <li>Evidence supporting major claims</li>
            <li>Approved screenshots where applicable</li>
            <li>Permission confirmation where client material is involved</li>
            <li>Case study reviewed for confidentiality and factual accuracy</li>
          </ul>
        </section>

        <section aria-labelledby="ownership-heading">
          <h2 id="ownership-heading">Ownership categories</h2>
          <ul className="prose">
            <li>
              <strong>Client</strong> — real client project with publication rights
            </li>
            <li>
              <strong>Founder-owned</strong> — work owned and created by the
              Founder/business
            </li>
            <li>
              <strong>Demonstration</strong> — intentionally created to demonstrate
              capability
            </li>
            <li>
              <strong>Concept</strong> — design or implementation concept that is not
              presented as delivered client work
            </li>
          </ul>
        </section>

        <section aria-labelledby="registry-heading">
          <h2 id="registry-heading">Portfolio slots</h2>
          <p>
            The following represent work that could become public portfolio entries
            when evidence, permission, and ownership criteria are met:
          </p>
          <div className="work-registry">
            {portfolioStatus.currentSlots.map((slot, index) => (
              <div key={slot} className="registry-item">
                <span className="slot-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="registry-item-content">{slot}</div>
              </div>
            ))}
          </div>
        </section>

        <p className="registry-note">
          {portfolioStatus.slotNote}
        </p>
      </div>
    </section>
  );
}