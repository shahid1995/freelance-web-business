export const metadata = {
  title: "About",
  description: "The business approach behind the public portfolio.",
};

export default function AboutPage() {
  return (
    <section className="section">
      <div className="container">
        <div className="prose">
          <p className="eyebrow">About</p>
          <h1>Practical web development with clear scope.</h1>
          <p>
            I build, modernize, and maintain business websites and focused web
            applications with clear scope, practical usability, and
            maintainable implementation.
          </p>
          <p>
            Projects are approached around the actual business need: building a
            professional web presence, making an existing site clearer and more
            usable, improving important user flows, or implementing focused
            functionality beyond a standard marketing website.
          </p>
          <p>
            I aim to keep the work plain and structured: define the scope,
            implement the agreed solution, verify the important behavior, and
            provide an organized handover.
          </p>
        </div>
      </div>
    </section>
  );
}
