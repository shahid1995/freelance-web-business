import Link from "next/link";
import { services } from "@/lib/services";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">Web development</p>
            <h1>Build, modernize, and maintain a better web presence.</h1>
            <p className="lede">
              Business websites, landing pages, and focused web applications
              with clear scope, practical usability, and maintainable
              implementation.
            </p>

            <div className="cta-row">
              <Link className="button" href="/contact">
                Discuss your project
              </Link>
              <Link className="button button-secondary" href="/services">
                Explore services
              </Link>
            </div>
          </div>

          <aside className="panel hero-note" aria-label="Working approach">
            <p className="eyebrow">How the work is approached</p>
            <p>
              Start from the actual business need, define the work clearly,
              implement the agreed solution, verify the important behavior,
              and hand over a maintainable result.
            </p>
          </aside>
        </div>
      </section>

      <section className="section" aria-labelledby="services-heading">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">Services</p>
            <h2 id="services-heading">Focused help across the web lifecycle.</h2>
            <p>
              Choose the service that matches the work you need today. Scope,
              deliverables, and boundaries are defined before implementation.
            </p>
          </div>

          <div className="card-grid">
            {services.map((service) => (
              <article className="panel card" key={service.slug}>
                <h3>{service.title}</h3>
                <p>{service.summary}</p>
                <Link className="card-link" href={`/services/${service.slug}`}>
                View {service.title}
              </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="work-heading">
        <div className="container">
          <div className="panel service-summary">
            <div className="section-heading">
              <p className="eyebrow">Work</p>
              <h2 id="work-heading">Portfolio work is evidence-led.</h2>
              <p>
                Published work will appear here only after ownership, evidence,
                confidentiality, factual accuracy, and any required permission
                have been reviewed.
              </p>
            </div>
            <Link className="button button-secondary" href="/work">
              View portfolio
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
