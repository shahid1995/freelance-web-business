import Link from "next/link";
import type { Metadata } from "next";
import { services } from "@/lib/services";
import { messaging, portfolioStatus, site } from "@/lib/content";

export const metadata: Metadata = {
  title: messaging.primary,
  description: site.description,
};

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">Web development</p>
          <h1>{messaging.primary}</h1>
          <p className="lead">{messaging.supporting}</p>

          <div className="cta-row">
            <Link className="button" href="/contact">
              {messaging.ctaPrimary}
            </Link>
            <Link className="button button-secondary" href="/services">
              {messaging.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="services-heading">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">Services</p>
            <h2 id="services-heading">Focused help across the web lifecycle</h2>
            <p>
              Each service is structured around a defined business need.
              Scope, deliverables, and boundaries are agreed before implementation.
            </p>
          </div>

          <div className="service-list">
            {services.map((service, index) => (
              <div key={service.slug} className="service-entry">
                <div className="service-identifier">
                  <span className="service-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="service-title">{service.title}</h3>
                </div>
                <p className="service-summary">{service.summary}</p>
                <Link
                  className="service-link"
                  href={`/services/${service.slug}`}
                  aria-label={`View ${service.title}`}
                >
                  View {service.title}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="approach-heading">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">How it works</p>
            <h2 id="approach-heading">The working approach</h2>
            <p>{messaging.approach}</p>
          </div>

          <div className="approach-steps">
            {["Understand", "Define", "Build", "Verify", "Hand over"].map(
              (step, index) => (
                <div key={step} className="approach-step">
                  <span className="step-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="step-label">{step}</span>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="work-heading">
        <div className="container">
          <div className="prose">
            <p className="eyebrow">Work</p>
            <h2 id="work-heading">
              Portfolio work appears only after publication review
            </h2>
            <p>{portfolioStatus.summary}</p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="final-cta-heading">
        <div className="container">
          <div className="section-heading">
            <h2 id="final-cta-heading">Let's discuss your project</h2>
            <p className="lead">
              Clear scope, practical implementation, and maintainable results.
            </p>
          </div>

          <div className="cta-row">
            <Link className="button" href="/contact">
              {messaging.ctaPrimary}
            </Link>
            <Link className="button button-secondary" href="/services">
              {messaging.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}