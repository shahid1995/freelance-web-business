import Link from "next/link";

export const metadata = {
  title: "Contact",
  description: "Start a conversation about a website or web application project.",
};

export default function ContactPage() {
  return (
    <section className="section">
      <div className="container">
        <div className="prose">
          <p className="eyebrow">Project discussion</p>
          <h1>Let's start with the work you need</h1>
          <p>
            The public contact flow is the next Phase 4 work item. It will collect only the
            information needed to qualify a project and route it into the approved sales process.
          </p>
        </div>

        <div className="notice">
          <strong>Current status:</strong> No contact form or external submission integration is
          enabled in this scaffold. That keeps the current website free of unapproved live
          integrations and production side effects.
        </div>

        <div className="cta-row">
          <Link className="button" href="/services">
            Review services
          </Link>
          <Link className="button button-secondary" href="/contact#discuss">
            Discuss a project
          </Link>
        </div>
      </div>
    </section>
  );
}