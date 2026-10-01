export const metadata = {
  title: "About",
  description:
    "The business approach behind the public portfolio: clear scope, practical usability, and maintainable implementation.",
};

export default function AboutPage() {
  return (
    <section className="section">
      <div className="container">
        <div className="prose">
          <p className="eyebrow">About</p>
          <h1>A professional web-development practice</h1>
          <p>
            I build, modernize, and maintain business websites and focused web applications with clear scope, practical usability, and maintainable implementation.
          </p>
          <p>
            The work covers business websites, landing pages, website redesign and modernization, custom web applications, dashboards and portals, and website maintenance and improvements.
          </p>
        </div>

        <div className="detail-section">
          <h2>Working approach</h2>
          <div className="approach-steps">
            {["Understand", "Define", "Build", "Verify", "Hand over"].map(
              (step, index) => (
                <div key={step} className="approach-step">
                  <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="step-label">{step}</span>
                </div>
              )
            )}
          </div>
        </div>

        <div className="detail-section">
          <p className="eyebrow">Who the work helps</p>
          <h2>The audience</h2>
          <p>
            Small and medium-sized businesses, startup founders and early-stage companies,
            consultants and professional-service businesses, agencies that need additional
            web-development capacity, SaaS founders and product teams, and businesses with
            outdated, confusing, slow, or poorly maintained websites.
          </p>
        </div>

        <div className="detail-section">
          <p className="eyebrow">Delivery standards</p>
          <h2>Delivery standards</h2>
          <ul>
            <li>Clear scope and deliverables</li>
            <li>Modern, responsive implementation</li>
            <li>Practical usability and attention to important user flows</li>
            <li>Maintainable implementation rather than one-off visual work only</li>
            <li>Appropriate attention to accessibility, performance, security, and integrations</li>
            <li>Structured handover and documentation</li>
            <li>Honest representation of capabilities and experience</li>
          </ul>
        </div>

        <div className="detail-section">
          <p className="eyebrow">What the business is not</p>
          <h2>Scope boundaries</h2>
          <p>
            The practice is not a full-service marketing agency, a guaranteed SEO or lead-generation
            provider, a branding agency, a large software consultancy, a provider of guaranteed
            revenue or conversion outcomes, or a low-cost "anything for anyone" development service.
          </p>
        </div>
      </div>
    </section>
  );
}