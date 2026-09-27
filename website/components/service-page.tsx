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
                  {service.cta}
                </Link>
                <Link className="button button-secondary" href="/services">
                  View all services
                </Link>
              </div>
            </div>
          </div>

          <div className="detail-grid">
            <section className="detail-card" aria-labelledby="purpose">
              <h2 id="purpose">What this service is for</h2>
              <p>{service.purpose}</p>
            </section>

            <section className="detail-card" aria-labelledby="client-need">
              <h2 id="client-need">Typical client need</h2>
              <p>{service.clientNeed}</p>
            </section>

            <section className="detail-card" aria-labelledby="ideal-for">
              <h2 id="ideal-for">Good fit for</h2>
              <ul>
                {service.idealFor.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="detail-card" aria-labelledby="typical-scope">
              <h2 id="typical-scope">Typical scope</h2>
              <p>{service.typicalScope}</p>
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
