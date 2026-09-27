export const metadata = {
  title: "Work",
  description: "Approved portfolio work and case studies.",
};

export default function WorkPage() {
  return (
    <section className="section">
      <div className="container">
        <div className="prose">
          <p className="eyebrow">Work</p>
          <h1>Selected work will appear here as it becomes publication-ready.</h1>
          <p>
            The portfolio system currently contains concept slots rather than
            approved published projects. This page intentionally avoids
            presenting unverified work as completed client work.
          </p>
          <div className="notice">
            Portfolio items are added only after the project record, scope,
            evidence, confidentiality review, factual-accuracy review, and
            required publication permission are satisfied.
          </div>
        </div>
      </div>
    </section>
  );
}
