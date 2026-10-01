import Link from "next/link";
import type { Metadata } from "next";
import { services } from "@/lib/services";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Business websites, landing pages, redesign and modernization, custom web applications, dashboards and portals, maintenance and improvements.",
};

export default function ServicesPage() {
  return (
    <section className="section">
      <div className="container">
        <div className="prose">
          <p className="eyebrow">Services</p>
          <h1>Web work with clear scope and practical boundaries</h1>
          <p>{services.description}</p>
        </div>

        <div className="services-grid">
          {services.map((service) => (
            <article key={service.slug} className="service-card">
              <span className="service-number">
                {String(service.id).padStart(2, "0")}
              </span>
              <h2>{service.name}</h2>
              <p>{service.description}</p>
              {service.cta && (
                <Link className="service-cta" href={service.cta.href}>
                  {service.cta.label} →
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}