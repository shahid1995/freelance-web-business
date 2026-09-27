export type Service = {
  slug: string;
  title: string;
  summary: string;
  idealFor: string[];
  deliverables: string[];
  boundaries: string[];
};

export const services: Service[] = [
  {
    slug: "business-websites",
    title: "Business Websites",
    summary:
      "Build a professional, responsive website that clearly presents an organization, its services, and the next step.",
    idealFor: [
      "Small and medium-sized businesses",
      "Consultants and professional-service businesses",
      "Startup founders establishing a credible web presence",
    ],
    deliverables: [
      "Agreed page structure and navigation",
      "Responsive layouts for agreed breakpoints",
      "Home and agreed core business pages",
      "Clear calls to action",
      "Basic metadata and page-level configuration",
      "Handover notes for agreed operating tasks",
    ],
    boundaries: [
      "Brand identity creation",
      "Complex customer accounts",
      "Custom business workflows",
      "E-commerce",
      "Ongoing maintenance after handover",
    ],
  },
  {
    slug: "landing-pages",
    title: "Landing Pages",
    summary:
      "Create a focused page around one offer, audience, campaign, or desired action.",
    idealFor: [
      "A specific product or service offer",
      "Launches and announcements",
      "Campaign or acquisition pages",
      "A focused initial web presence",
    ],
    deliverables: [
      "Focused page structure",
      "Hero and value proposition",
      "Supporting sections based on approved messaging",
      "Trust or proof elements when evidence exists",
      "Primary call to action",
      "Responsive implementation",
    ],
    boundaries: [
      "Full multi-page website",
      "Brand strategy or identity development",
      "Ad campaign management",
      "Guaranteed conversion or lead volume",
      "Complex application workflows",
    ],
  },
  {
    slug: "redesign-modernization",
    title: "Website Redesign and Modernization",
    summary:
      "Improve an existing website's structure, interface, responsiveness, usability, or maintainability.",
    idealFor: [
      "Outdated visual interfaces",
      "Poor mobile experiences",
      "Confusing navigation",
      "Inconsistent page structures",
      "Sites that no longer match the current business",
    ],
    deliverables: [
      "Current-state review of agreed areas",
      "Updated information structure where required",
      "Responsive layouts",
      "Modernized components and interaction patterns",
      "Improved navigation and calls to action",
      "Updated implementation and handover material",
    ],
    boundaries: [
      "Rebranding or new brand identity",
      "Complete backend replacement",
      "Unrelated feature development",
      "Large content rewrites",
      "Guaranteed traffic, leads, or conversion improvement",
    ],
  },
  {
    slug: "custom-web-applications",
    title: "Custom Web Applications",
    summary:
      "Build focused web functionality for defined workflows, business processes, or user tasks.",
    idealFor: [
      "Internal business tools",
      "Customer-facing workflows",
      "Booking or request systems",
      "Structured data-entry workflows",
      "Focused SaaS-style product surfaces",
    ],
    deliverables: [
      "Agreed user roles and workflows",
      "Application screens and pages",
      "Data model when required",
      "Authentication and authorization when required",
      "Forms, validation, and defined business rules",
      "Agreed integrations and key error states",
    ],
    boundaries: [
      "Undefined future feature backlogs",
      "Full enterprise platform replacement",
      "Unapproved data migration",
      "Unbounded administrative tooling",
      "Unapproved ongoing operations or support",
    ],
  },
  {
    slug: "dashboards-portals",
    title: "Dashboards and Portals",
    summary:
      "Provide a structured interface for viewing information, taking actions, and completing role-specific workflows.",
    idealFor: [
      "Customer portals",
      "Internal operational dashboards",
      "Reporting interfaces",
      "User account areas",
      "Role-based workflow surfaces",
    ],
    deliverables: [
      "Dashboard or portal information architecture",
      "Role-based navigation where required",
      "Summary and detail views",
      "Tables, cards, charts, or other agreed displays",
      "Filters or search where required",
      "Approved data-source integrations",
    ],
    boundaries: [
      "Unlimited reporting requests",
      "Data engineering or warehouse construction",
      "Third-party data licensing",
      "Unbounded admin functionality",
      "Advanced predictive analytics or machine learning",
    ],
  },
  {
    slug: "maintenance-improvements",
    title: "Website Maintenance and Improvements",
    summary:
      "Keep an existing website useful through defined fixes, incremental improvements, and agreed routine changes.",
    idealFor: [
      "Existing functioning websites",
      "Post-launch fixes",
      "Small improvements without a redesign",
      "Defined backlogs of web changes",
      "Ongoing development capacity for agreed tasks",
    ],
    deliverables: [
      "Defined bug fixes",
      "Small UI or UX improvements",
      "Content or page updates within scope",
      "Minor feature additions",
      "Dependency or configuration updates where appropriate",
      "Documentation of completed changes when useful",
    ],
    boundaries: [
      "Full website redesign",
      "Large new application features",
      "Unbounded emergency support",
      "24/7 monitoring or incident response",
      "Major infrastructure migration",
    ],
  },
];

export function getService(slug: string) {
  return services.find((service) => service.slug === slug);
}
