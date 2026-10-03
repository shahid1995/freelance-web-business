import Link from "next/link";
import type { Service } from "@/lib/services";

export function serviceNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

/**
 * Editorial numbered service list.
 *
 * The whole row is clickable through a stretched link on the title, so there
 * is exactly one link per service and the accessible link name stays short.
 */
export function ServiceList({
  items,
  showSignals = false,
  signalCount = 3,
}: Readonly<{
  items: Service[];
  showSignals?: boolean;
  signalCount?: number;
}>) {
  return (
    <div className="service-list">
      {items.map((service, index) => (
        <article className="service-row" key={service.slug}>
          <span className="service-row__index">{serviceNumber(index)}</span>

          <div className="service-row__main">
            <h3 className="service-row__title">
              <Link
                className="service-row__link"
                href={`/services/${service.slug}`}
              >
                {service.title}
              </Link>
              <span className="service-row__arrow" aria-hidden="true">
                &rarr;
              </span>
            </h3>

            <p className="service-row__summary">{service.summary}</p>

            {showSignals ? (
              <div className="service-row__signals">
                <div className="signal">
                  <p className="signal__label">Good fit for</p>
                  <ul className="signal__list">
                    {service.idealFor.slice(0, signalCount).map((item) => (
                      <li className="signal" key={item}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="signal">
                  <p className="signal__label">Typical deliverables</p>
                  <ul className="signal__list">
                    {service.deliverables.slice(0, signalCount).map((item) => (
                      <li className="signal" key={item}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}