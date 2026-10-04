import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/content";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: "%s | " + site.name,
  },
  description: site.description,
};

// Self-hosted at build time through next/font: no runtime request to a font
// service, and only real weights (400/500/600/700) are loaded.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
  variable: "--font-mono",
});

const navigation = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/work", label: "Work" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

// Runs before the document paints so a stored Dark preference is applied to
// <html> without a visible Light -> Dark flash. It only ever writes "dark":
// leaving the attribute off keeps the plain `:root` tokens, so a visitor with
// no preference sees exactly the default Light theme.
const themeInitScript = `(function(){try{var t=window.localStorage.getItem("theme");if(t==="dark"){document.documentElement.setAttribute("data-theme","dark");}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      // The init script sets data-theme before hydration, so the attribute is
      // already present on the client by the time React hydrates <html>.
      suppressHydrationWarning
      className={`${inter.variable} ${interTight.variable} ${jetBrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>

        <header className="site-header">
          <div className="site-header-inner">
            <div className="site-header-brand">
              <Link className="brand" href="/">
                {site.name}
              </Link>

              <ThemeToggle />
            </div>

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
