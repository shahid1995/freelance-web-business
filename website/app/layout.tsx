import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { site } from "@/lib/content";

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: "%s | " + site.name,
  },
  description: site.description,
};

const navigation = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/work", label: "Work" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>

        <header className="site-header">
          <div className="site-header-inner">
            <Link className="brand" href="/">
              {site.name}
            </Link>

            <nav className="site-nav" aria-label="Primary navigation">
              {navigation.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main id="main-content" className="page">
          {children}
        </main>

        <footer className="site-footer">
          <div className="site-footer-inner">
            <p>{site.shortDescription}</p>
            <p>Public website foundation — publication controlled separately.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
