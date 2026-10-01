import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "The business approach behind the public portfolio: clear scope, practical usability, and maintainable implementation.",
};

export default function AboutPage() {
  return (
    <section className="section">
      <div className="container">
        <section>
          <p className="eyebrow">About</p>
          <h1>A professional web-development practice</h1>
          <p>
            I build, modernize, and maintain business websites and focused web
            applications with clear scope, practical usability, and maintainable
            implementation.
          </p>
          <p>
            The work covers business websites, landing pages, website redesign and
            modernization, custom web applications, dashboards and portals, and
            website maintenance and improvements. Projects are approached around the
            actual business need: building a professional web presence, making an
            existing site clearer and more usable, improving important user flows, or
            implementing focused functionality beyond a standard marketing website.
          </p>
        </section>

        <section aria-labelledby="approach-heading">
          <h2 id="approach-heading">Working approach</h2>
          <p>
            Each project starts from the real business need. The scope, deliverables,
            and boundaries are defined before implementation. The agreed solution is
            implemented, the important behavior is verified, and an organized handover
            is provided.
          </p>
          <p>
            The work is kept plain and structured. Claims stay concrete, and the
            business deliverable is separated from outcomes such as traffic, leads,
            revenue, or conversions, which depend on factors outside the development
            work.
          </p>
          <div className="approach-steps">
            {["Understand", "Define", "Build", "Verify", "Hand over"].map(
              (step, index) => (
                <div key={step} className="approach-step">
                  <span className="step-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="step-label">{step}</span>
                </div>
              )
            )}
          </div>
        </section>

        <section aria-labelledby="audience-heading">
          <h2 id="audience-heading">Who the work helps</h2>
          <p>
            The practice works with small and medium-sized businesses, startup
            founders and early-stage companies, consultants and professional-service
            businesses, agencies that need additional web-development capacity, SaaS
            founders and product teams, and businesses with outdated, confusing, slow,
            or poorly maintained websites.
          </p>
        </section>

        <section aria-labelledby="delivery-heading">
          <h2 id="delivery-heading">Delivery standards</h2>
          <p>
            Public-facing work is guided by observable delivery characteristics
            rather than unverifiable superlatives:
          </p>
          <ul>
            <li>Clear scope and deliverables</li>
            <li>Modern, responsive implementation</li>
            <li>Practical usability and attention to important user flows</li>
            <li>Maintainable implementation rather than one-off visual work only</li>
            <li>
              Appropriate attention to accessibility, performance, security, and
              integrations when relevant
            </li>
            <li>Structured handover and documentation appropriate to the project</li>
            <li>Honest representation of capabilities, experience, and results</li>
          </ul>
        </section>

        <section aria-labelledby="boundaries-heading">
          <h2 id="boundaries-heading">What the business is not</h2>
          <p>
            The practice is not initially positioned as a full-service marketing
            agency, a guaranteed SEO or lead-generation provider, a branding agency,
            a large software consultancy, a provider of guaranteed revenue or
            conversion outcomes, or a low-cost "anything for anyone" development
            service.
          </p>
        </section>
      </div>
    </section>
  );
}