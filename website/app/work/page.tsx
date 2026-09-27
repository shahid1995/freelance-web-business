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
              <li>Modern Business Website</li>
              <li>SaaS Landing Page</li>
              <li>Financial Analytics Dashboard</li>
              <li>Customer Portal</li>
              <li>Website Redesign — Before/After</li>
            </ul>
            <p>
              These are portfolio slots, not claims of completed client work. A
              slot does not become a project record until real work, an
              intentionally created demonstration, or a clearly labeled concept
              is documented.
            </p>
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
              <li>A completed project record with its canonical Project ID</li>
              <li>Accurate ownership and role</li>
              <li>Defined scope</li>
              <li>Evidence supporting major claims</li>
              <li>Approved screenshots where applicable</li>
              <li>Permission confirmation where client material is involved</li>
              <li>A case study reviewed for confidentiality and factual accuracy</li>
            </ul>
            <p>
              Concept or demonstration work remains clearly labeled, and client
              projects do not automatically grant public portfolio rights.
            </p>
          </section>

          <section aria-labelledby="ownership-heading">
            <h2 id="ownership-heading">Ownership categories</h2>
            <p>
              When portfolio items are published, they will be labeled using one
              of these ownership categories:
            </p>
            <ul>
              <li>Client — real client project</li>
              <li>Founder-owned — work owned and created by the Founder/business</li>
              <li>Demonstration — intentionally created to demonstrate capability</li>
              <li>Concept — design or implementation concept that is not represented as delivered client work</li>
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}
