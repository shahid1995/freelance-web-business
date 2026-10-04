import Link from "next/link";
import { Metadata } from "next";
import { messaging, site } from "@/lib/content";
import { serviceNumber } from "@/components/service-list";

export const metadata: Metadata = {
  title: "About",
  description:
    "The business approach behind the public portfolio: clear scope, practical usability, and maintainable implementation.",
};

const workingApproach = [
  "Start from the actual business need",
  "Define the work clearly",
  "Implement the agreed solution",
  "Verify the important behavior",
  "Hand over a maintainable result",
];

const audiences = [
  "Small and medium-sized businesses",
  "Startup founders and early-stage companies",
  "Consultants and professional-service businesses",
  "Agencies that need additional web-development capacity",
  "SaaS founders and product teams",
  "Businesses with outdated, confusing, slow, or poorly maintained websites",
];

const deliveryStandards = [
  "Clear scope and deliverables",
  "Modern, responsive implementation",
  "Practical usability and attention to important user flows",
  "Maintainable implementation rather than one-off visual work only",
  "Appropriate attention to accessibility, performance, security, and integrations when relevant",
  "Structured handover and documentation appropriate to the project",
  "Honest representation of capabilities, experience, and results",
];

export default function AboutPage() {
  return (
    <>
      <section className="section">
        <div className="container">
          <div className="page-head">
            <p className="eyebrow">About</p>
            <h1>A professional web-development practice.</h1>
            <p className="lede">{site.shortDescription}</p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="positioning-heading">
        <div className="container prose">
          <div className="section-head">
            <p className="eyebrow">Positioning</p>
            <h2 id="positioning-heading">What the work covers.</h2>
          </div>

          <p>
            I build, modernize, and maintain business websites and focused web
            applications with clear scope, practical usability, and maintainable
            implementation.
          </p>
          <p>
            The work covers business websites, landing pages, website redesign
            and modernization, custom web applications, dashboards and portals,
            and website maintenance and improvements. Projects are approached
            around the actual business need: building a professional web
            presence, making an existing site clearer and more usable, improving
            important user flows, or implementing focused functionality beyond a
            standard marketing website.
          </p>
        </div>
      </section>

      <section className="section" aria-labelledby="approach-heading">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Working approach</p>
            <h2 id="approach-heading">How each project runs.</h2>
          </div>

          <ol className="steps">
            {workingApproach.map((step, index) => (
              <li className="step" key={step}>
                <span className="step__index">{serviceNumber(index)}</span>
                <p className="step__text">{step}</p>
              </li>
            ))}
          </ol>

          <div className="approach-notes">
            <p>
              Each project starts from the real business need. The scope,
              deliverables, and boundaries are defined before implementation.
              The agreed solution is implemented, the important behavior is
              verified, and an organized handover is provided.
            </p>
            <p>
              The work is kept plain and structured. Claims stay concrete, and
              the business deliverable is separated from outcomes such as
              traffic, leads, revenue, or conversions, which depend on factors
              outside the development work.
            </p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="audience-heading">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Audience</p>
            <h2 id="audience-heading">Who the work helps.</h2>
          </div>

          <ul className="audience-grid">
            {audiences.map((audience) => (
              <li key={audience}>{audience}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="delivery-heading">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Delivery standards</p>
            <h2 id="delivery-heading">
              Observable characteristics of public-facing work.
            </h2>
            <p>
              Public-facing work is guided by observable delivery characteristics
              rather than unverifiable superlatives:
            </p>
          </div>

          <ul className="standards">
            {deliveryStandards.map((standard) => (
              <li key={standard}>{standard}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="what-not-heading">
        <div className="container prose">
          <div className="section-head">
            <p className="eyebrow">Boundaries</p>
            <h2 id="what-not-heading">What the business is not</h2>
          </div>

          <p>
            The practice is not initially positioned as a full-service marketing
            agency, a guaranteed SEO or lead-generation provider, a branding
            agency, a large software consultancy, a provider of guaranteed
            revenue or conversion outcomes, or a low-cost
            &quot;anything for anyone&quot; development service.
          </p>
        </div>
      </section>

      <section className="section" aria-labelledby="about-cta-heading">
        <div className="container">
          <div className="cta-band">
            <h2 id="about-cta-heading">{messaging.primary}</h2>
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