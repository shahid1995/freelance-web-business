import Link from "next/link";
import { ServiceList } from "@/components/service-list";
import { services } from "@/lib/services";
import { messaging, site } from "@/lib/content";

export const metadata = {
  title: "Services",
  description:
    "Business websites, landing pages, website redesign, custom web applications, dashboards and portals, and website maintenance.",
};

export default function ServicesPage() {
  return (
    <>
      <section className="section">
        <div className="container">
          <div className="page-head">
            <p className="eyebrow">Services</p>
            <h1>Web work with clear scope and practical boundaries.</h1>
            <p className="lede">
              Each service is structured around a defined business need rather
              than an open-ended feature list. Scope, deliverables, and
              boundaries are agreed before implementation.
            </p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="catalog-heading">
        <div className="container">
          <div className="section-head">
            <h2 id="catalog-heading">The six service categories.</h2>
          </div>

          <ServiceList items={services} showSignals signalCount={3} />
        </div>
      </section>

      <section className="section" aria-labelledby="services-cta-heading">
        <div className="container">
          <div className="cta-band">
            <h2 id="services-cta-heading">{site.tagline}</h2>
            <p>{messaging.supporting}</p>
            <div className="cta-row">
              <Link className="button" href="/contact">
                {messaging.ctaPrimary}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}