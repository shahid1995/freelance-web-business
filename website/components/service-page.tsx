import Link from "next/link";
import type { Service } from "@/lib/services";

export function ServicePage({ service }: Readonly<{ service: Service }>) {
  return (
    <div className="service-page">
      <div className="container">
        <section>
          <p className="eyebrow">Service</p>
          <h1>{service.title}</h1>
          <p>{service.summary}</p>
        </section>

        <section aria-labelledby="purpose-heading">
          <h2 id="purpose-heading">What this service is for</h2>
          <p className="detail-content">{service.purpose}</p>
        </section>

        <section aria-labelledby="need-heading">
          <h2 id="need-heading">Typical client need</h2>
          <p className="detail-content">{service.clientNeed}</p>
        </section>

        <section aria-labelledby="ideal-heading">
          <h2 id="ideal-heading">Good fit for</h2>
          <ul className="detail-list">
            {service.idealFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="scope-heading">
          <h2 id="scope-heading">Typical scope</h2>
          <p className="detail-content">{service.typicalScope}</p>
        </section>

        <section aria-labelledby="deliverables-heading">
          <h2 id="deliverables-heading">Typical deliverables</h2>
          <ul className="detail-list">
            {service.deliverables.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="boundaries-heading">
          <h2 id="boundaries-heading">Typical boundaries</h2>
          <ul className="detail-list">
            {service.boundaries.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <div className="cta-row">
          <Link className="button" href="/contact">
            {service.cta}
          </Link>
          <Link className="button button-secondary" href="/services">
            View all services
          </Link>
        </div>
      </div>
    </div>
  );
}