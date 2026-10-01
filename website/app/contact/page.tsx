import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Discussion entry point for website and web application projects.",
};

export default function ContactPage() {
  return (
    <section className="section">
      <div className="container">
        <div className="prose">
          <p className="eyebrow">Project discussion</p>
          <h1>Let's discuss your project</h1>
          <p>
            I'm available for new website and web application projects. The
            project discussion process collects only the information needed to
            understand your needs and determine fit.
          </p>
        </div>

        <div className="notice">
          <strong>Current status:</strong> Project discussions are handled
          through the next phase of work. You can explore the services first or
          review the site structure.
        </div>

        <div className="cta-row">
          <Link className="button" href="/services">
            Review services
          </Link>
          <Link className="button button-secondary" href="/about">
            Learn about the approach
          </Link>
        </div>
      </div>
    </section>
  );
}