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
          <p>{services[0].summary}</p>
        </div>

        <div className="services-grid">
          {services.map((service, index) => (
            <article key={service.slug} className="service-card">
              <span className="service-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2>{service.title}</h2>
              <p>{service.summary}</p>
              {service.cta && (
                <Link className="service-cta" href="/contact">
                  {service.cta} →
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}