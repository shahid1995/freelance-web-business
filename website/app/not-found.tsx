import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section">
      <div className="container">
        <div className="prose">
          <p className="eyebrow">404</p>
          <h1>That page does not exist.</h1>
          <p>Use the navigation to return to the public portfolio.</p>
          <div className="cta-row">
            <Link className="button" href="/">
              Go home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
