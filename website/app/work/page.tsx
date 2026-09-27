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
        <div className="prose">
          <p className="eyebrow">Work</p>
          <h1>
            Selected work will appear here as it becomes publication-ready.
          </h1>
          <p>
            The portfolio registry currently contains candidate concepts rather
            than approved published projects. This page intentionally avoids
            presenting unverified work as completed client work.
          </p>

          <section aria-labelledby="status-heading">
            <h2 id="status-heading">Current portfolio status</h2>
            <p>
              The portfolio registry includes concept slots for:
            </p>
            <ul>
              {portfolioStatus.currentSlots.map((slot) => (
                <li key={slot}>{slot}</li>
              ))}
            </ul>
            <p>{portfolioStatus.slotNote}</p>
          </section>

          <section aria-labelledby="publication-heading">
            <h2 id="publication-heading">Publication requirements</h2>
            <p>
              Portfolio items are added only after the project record, scope,
              evidence, confidentiality review, factual-accuracy review, and
              required publication permission are satisfied.
            </p>
            <p>
              Before an item becomes a public case study, the repository must
              contain:
            </p>
            <ul>
              {portfolioStatus.publicationRequirements.map((req) => (
                <li key={req}>{req}</li>
              ))}
            </ul>
            <p>{portfolioStatus.conceptNote}</p>
          </section>

          <section aria-labelledby="ownership-heading">
            <h2 id="ownership-heading">Ownership categories</h2>
            <p>
              When portfolio items are published, they will be labeled using one
              of these ownership categories:
            </p>
            <ul>
              {portfolioStatus.ownershipCategories.map((cat) => (
                <li key={cat}>{cat}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}
