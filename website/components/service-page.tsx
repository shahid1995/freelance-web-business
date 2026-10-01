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

            <div className="service-meta">
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

            <div className="detail-section">
              <h2>What this service is for</h2>
              <p className="detail-content">{service.purpose}</p>
            </div>

            <div className="detail-section">
              <h2>Typical client need</h2>
              <p className="detail-content">{service.clientNeed}</p>
            </div>

            <div className="detail-section">
              <h2>Good fit for</h2>
              <ul className="detail-list">
                {service.idealFor.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="detail-section">
              <h2>Typical scope</h2>
              <p className="detail-content">{service.typicalScope}</p>
            </div>

            <div className="detail-section">
              <h2>Typical deliverables</h2>
              <ul className="detail-list">
                {service.deliverables.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="detail-section">
              <h2>Typical boundaries</h2>
              <ul className="detail-list">
                {service.boundaries.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}