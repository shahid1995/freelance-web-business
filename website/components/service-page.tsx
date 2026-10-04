import Link from "next/link";
import type { Service } from "@/lib/services";
import { services } from "@/lib/services";
import { serviceNumber } from "@/components/service-list";

function relatedServices(index: number): Array<{ service: Service; index: number }> {
  const neighbours: number[] = [];

  if (index - 1 >= 0) neighbours.push(index - 1);
  if (index + 1 < services.length) neighbours.push(index + 1);

  return neighbours.flatMap((i) => {
    const service = services.at(i);
    return service ? [{ service, index: i }] : [];
  });
}

export function ServicePage({ service }: Readonly<{ service: Service }>) {
  const index = services.findIndex((item) => item.slug === service.slug);
  const number = serviceNumber(index);
  const related = relatedServices(index);

  return (
    <div className="service-page">
      <div className="container">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="breadcrumbs__sep" aria-hidden="true">
            /
          </span>
          <Link href="/services">Services</Link>
          <span className="breadcrumbs__sep" aria-hidden="true">
            /
          </span>
          <span className="breadcrumbs__current">{service.title}</span>
        </nav>

        <header className="service-header">
          <p className="eyebrow">Service {number}</p>
          <h1>{service.title}</h1>
          <p className="lede">{service.summary}</p>
        </header>

        <div className="service-layout">
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

            <div className="cta-row">
              <Link className="button" href="/contact">
                {service.cta}
              </Link>
              <Link className="button button-secondary" href="/services">
                View all services
              </Link>
            </div>
          </div>

          <div className="detail-grid">
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

            {related.length > 0 ? (
              <section aria-labelledby="related-heading">
                <h2 id="related-heading" className="label-heading">
                  Related services
                </h2>
                <div className="related-grid">
                  {related.map((item) => (
                    <Link
                      className="related-card"
                      href={`/services/${item.service.slug}`}
                      key={item.service.slug}
                    >
                      <span className="related-card__index">
                        {serviceNumber(item.index)}
                      </span>
                      <span className="related-card__title">
                        {item.service.title}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}