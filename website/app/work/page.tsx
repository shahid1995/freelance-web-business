import { portfolioStatus } from "@/lib/content";

export const metadata = {
  title: "Work",
  description:
    "Portfolio work and case studies will appear here after ownership, evidence, confidentiality, and publication permission are reviewed.",
};

export default function WorkPage() {
  return (
    <section className="section">
      <div className="container">
        <div className="prose">
          <p className="eyebrow">Work</p>
          <h1>
            Portfolio work appears only after publication review
          </h1>
          <p>{portfolioStatus.summary}</p>
        </div>

        <div className="work-registry" aria-label="Portfolio status">
          {portfolioStatus.currentSlots.map((slot, index) => (
            <div key={slot} className="registry-slot">
              <span className="slot-number">{String(index + 1).padStart(2, "0")}</span>
              <div className="registry-slot-content">{slot}</div>
            </div>
          ))}
        </div>

        <p className="registry-note">
          {portfolioStatus.slotNote}
        </p>
      </div>
    </section>
  );
}