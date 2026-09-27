import Link from "next/link";
import type { Service } from "@/lib/services";

export function ServicePage({ service }: Readonly<{ service: Service }>) {
  return (
    <div className="service-page">
      <div className="container">
        <div className="service-layout">
          <div>
            <p className="eyebrow">Service</p>
            <h1>{service.title}</h1>
            <div className="panel service-summary">
              <p>{service.summary}</p>
              <div className="cta-row">
                <Link className="button" href="/contact">
                  Discuss this project
                </Link>
                <Link className="button button-secondary" href="/services">
                  View all services
                </Link>
              </div>
            </div>
          </div>

          <div className="detail-grid">
            <section className="detail-card" aria-labelledby="ideal-for">
              <h2 id="ideal-for">Good fit for</h2>
              <ul>
                {service.idealFor.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="detail-card" aria-labelledby="deliverables">
              <h2 id="deliverables">Typical deliverables</h2>
              <ul>
                {service.deliverables.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="detail-card" aria-labelledby="boundaries">
              <h2 id="boundaries">Typical boundaries</h2>
              <ul>
                {service.boundaries.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
