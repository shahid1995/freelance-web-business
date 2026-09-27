import Link from "next/link";
import { services } from "@/lib/services";

export const metadata = {
  title: "Services",
  description:
    "Business websites, landing pages, website redesign, custom web applications, dashboards and portals, and website maintenance.",
};

export default function ServicesPage() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">Services</p>
          <h1>Web work with clear scope and practical boundaries.</h1>
          <p>
            Each service is structured around a defined business need rather
            than an open-ended feature list. Scope, deliverables, and boundaries
            are agreed before implementation.
          </p>
        </div>

        <div className="card-grid">
          {services.map((service) => (
            <article className="panel card" key={service.slug}>
              <h2>{service.title}</h2>
              <p>{service.summary}</p>
              <Link className="card-link" href={`/services/${service.slug}`}>
                View {service.title}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
