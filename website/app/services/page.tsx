import Link from "next/link";
import type { Metadata } from "next";
import { services } from "@/lib/services";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Business websites, landing pages, website redesign, custom web applications, dashboards and portals, and website maintenance.",
};

export default function ServicesPage() {
  return (
    <section className="section" aria-labelledby="services-heading">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">Services</p>
          <h1 id="services-heading">Web work with clear scope and practical boundaries</h1>
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
  );
}