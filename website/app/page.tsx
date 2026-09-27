import Link from "next/link";
import { services } from "@/lib/services";
import { messaging, portfolioStatus, site } from "@/lib/content";

export const metadata = {
  title: messaging.primary,
  description: site.description,
};

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

          <aside className="panel hero-note" aria-label="Working approach">
            <p className="eyebrow">How the work is approached</p>
            <p>{messaging.approach}</p>
          </aside>
        </div>
      </section>

      <section className="section" aria-labelledby="services-heading">
        <div className="container">
          <div className="section-heading">
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
              <h2 id="work-heading">
                Portfolio work appears only after publication review.
              </h2>
              <p>{portfolioStatus.summary}</p>
            </div>
            <Link className="button button-secondary" href="/work">
              {messaging.ctaWork}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
