export type Service = {
  slug: string;
  title: string;
  summary: string;
  purpose: string;
  clientNeed: string;
  idealFor: string[];
  typicalScope: string;
  deliverables: string[];
  boundaries: string[];
  cta: string;
};

export const services: Service[] = [
  {
    slug: "business-websites",
    title: "Business Websites",
    summary:
      "Build a professional, responsive website that clearly presents an organization, its services, and the next step.",
    purpose:
      "Build a professional, responsive website that clearly presents an organization's identity, services, credibility, and next steps.",
    clientNeed:
      "A business needs a credible modern website when it has no web presence, an incomplete site, or a basic site that no longer represents the organization well.",
    idealFor: [
      "Small and medium-sized businesses",
      "Consultants and professional-service businesses",
      "Startup founders establishing a credible web presence",
      "Organizations replacing an incomplete or outdated basic website",
    ],
    typicalScope:
      "A standard business website commonly includes a small set of marketing and information pages such as Home, About, Services, service detail pages where required, Contact, and agreed supporting pages. The exact page count and content structure is agreed before implementation.",
    deliverables: [
      "Agreed page structure and navigation",
      "Responsive page layouts for agreed breakpoints",
      "Home page and agreed core business pages",
      "Clear calls to action appropriate to the site",
      "Contact or enquiry flow when included",
      "Reusable visual and component structure",
      "Basic metadata and page-level technical configuration appropriate to the project",
      "Production-ready implementation",
      "Handover notes for agreed editable content or operating tasks",
    ],
    boundaries: [
      "Full brand identity creation",
      "Extensive copywriting or content strategy",
      "Professional photography or video",
      "Complex customer accounts",
      "Custom business workflows",
      "Advanced dashboards or portals",
      "E-commerce",
      "Ongoing SEO campaigns",
      "Paid marketing",
      "Large-scale content migration",
      "Ongoing maintenance after handover",
    ],
    cta: "Discuss your website project",
  },
  {
    slug: "landing-pages",
    title: "Landing Pages",
    summary:
      "Create a focused page around one offer, audience, campaign, or desired action.",
    purpose:
      "Create a focused page that communicates one offer, audience, campaign, or desired action clearly.",
    clientNeed:
      "A business needs a landing page when a specific offer, launch, announcement, or campaign requires a clear single objective and one main conversion path rather than a full website.",
    idealFor: [
      "A specific product or service offer",
      "Launches and announcements",
      "Campaign or acquisition pages",
      "A startup needing a focused initial web presence",
      "A business testing a clearer offer before expanding a full website",
    ],
    typicalScope:
      "A landing page usually centers on one primary objective and one main conversion path. The page may include a headline and supporting proposition, benefits or feature explanation, problem/solution framing, social proof or evidence where it exists, process or offer details, FAQ, and a final call to action. The exact content hierarchy is agreed before implementation.",
    deliverables: [
      "Focused page structure",
      "Hero and value proposition section",
      "Supporting sections based on the agreed message",
      "Trust or proof elements where evidence exists",
      "Clear primary call to action",
      "Responsive implementation",
      "Form or enquiry interaction when included",
      "Basic page metadata and technical configuration appropriate to the project",
    ],
    boundaries: [
      "Full multi-page website",
      "Brand strategy or identity development",
      "Ad campaign management",
      "Guaranteed conversion rate",
      "Guaranteed lead volume",
      "Paid copywriting or professional content production",
      "Complex account or application workflows",
    ],
    cta: "Discuss your landing page project",
  },
  {
    slug: "redesign-modernization",
    title: "Website Redesign and Modernization",
    summary:
      "Improve an existing website's structure, interface, responsiveness, usability, or maintainability.",
    purpose:
      "Improve an existing website's structure, interface, responsiveness, usability, or maintainability without assuming the site must be rebuilt completely.",
    clientNeed:
      "A business needs a redesign or modernization when its existing website has an outdated visual interface, poor mobile experience, confusing navigation, inconsistent page designs, or a site that no longer matches the current business.",
    idealFor: [
      "Outdated visual interfaces",
      "Poor mobile experiences",
      "Confusing navigation or information architecture",
      "Inconsistent page structures",
      "Sites that no longer match the current business",
      "A maintainability problem requiring structured modernization",
    ],
    typicalScope:
      "A redesign project identifies which of the following is being changed: visual design, information architecture, responsive behavior, navigation, content presentation, components, selected integrations, front-end implementation, or CMS/content structure. A redesign does not automatically include every legacy page or system component.",
    deliverables: [
      "Current-state review of agreed website areas",
      "Redesigned information structure or page hierarchy where required",
      "Updated responsive layouts",
      "Modernized components and interaction patterns",
      "Improved navigation and calls to action",
      "Content or layout migration for agreed pages",
      "Removal or replacement of agreed obsolete elements",
      "Updated implementation and agreed handover material",
    ],
    boundaries: [
      "Rebranding or creation of a new brand identity",
      "Complete backend replacement",
      "Unrelated feature development",
      "Large content rewrites",
      "Migration of every historical page or asset",
      "Guaranteed SEO ranking improvement",
      "Guaranteed traffic, leads, or conversion improvement",
      "Ongoing maintenance after the project",
    ],
    cta: "Discuss your redesign",
  },
  {
    slug: "custom-web-applications",
    title: "Custom Web Applications",
    summary:
      "Build focused web functionality for defined workflows, business processes, or user tasks.",
    purpose:
      "Build focused web functionality for a defined workflow, business process, or user task that a standard marketing website cannot adequately support.",
    clientNeed:
      "A business needs a custom web application when it has internal tools, customer-facing workflows, booking or request systems, structured data-entry workflows, specialized utilities, or focused SaaS-style product surfaces that a standard marketing website cannot handle.",
    idealFor: [
      "Internal business tools",
      "Customer-facing workflows",
      "Booking or request systems",
      "Structured data-entry workflows",
      "Specialized web utilities",
      "Focused SaaS-style product surfaces",
      "Integrations that require application logic",
    ],
    typicalScope:
      "A custom application is scoped around concrete workflows rather than an open-ended feature list. The project should define user types, entry points, main workflows, required data, permissions, business rules, external integrations, required notifications, reporting or export requirements, and administrative capabilities.",
    deliverables: [
      "Agreed user roles and workflows",
      "Application screens and pages",
      "Data model and required persistence",
      "Authentication and authorization when required",
      "Forms and validation",
      "Business rules explicitly included in scope",
      "Agreed integrations",
      "Error and empty states for key workflows",
      "Responsive behavior appropriate to the use case",
      "Deployment or handover material when included",
    ],
    boundaries: [
      "Undefined future feature backlog",
      "Full enterprise platform replacement",
      "Third-party service fees",
      "Unapproved data migration",
      "Unbounded administrative tooling",
      "Ongoing 24/7 operations or support",
      "Compliance certification or legal assurance",
      "Business-process consulting beyond the agreed implementation scope",
    ],
    cta: "Discuss your custom web application",
  },
  {
    slug: "dashboards-portals",
    title: "Dashboards and Portals",
    summary:
      "Provide a structured interface for viewing information, taking actions, and completing role-specific workflows.",
    purpose:
      "Provide users with a structured interface for viewing information, taking actions, and completing role-specific workflows in one place.",
    clientNeed:
      "A business needs a dashboard or portal when it requires a customer portal, internal operational dashboard, reporting interface, user account area, management view, role-based workflow surface, or a data-heavy but focused web product.",
    idealFor: [
      "Customer portals",
      "Internal operational dashboards",
      "Reporting interfaces",
      "User account areas",
      "Management views",
      "Role-based workflow surfaces",
      "Data-heavy but focused web products",
    ],
    typicalScope:
      "A dashboard or portal project should define user roles, data sources, key metrics or records, required actions, filters or search, permissions, reporting or export requirements, refresh or update expectations, and empty or error states. A dashboard is not automatically a full analytics platform, and a portal is not automatically a complete customer relationship or enterprise system.",
    deliverables: [
      "Dashboard or portal information architecture",
      "Role-based navigation where required",
      "Summary and detail views",
      "Tables, cards, charts, or other agreed information displays",
      "Filters or search where required",
      "Action workflows defined in scope",
      "Authentication and authorization when required",
      "Responsive behavior appropriate to the dashboard use case",
      "Integration with approved data sources",
      "Handover material",
    ],
    boundaries: [
      "Unlimited reporting or visualization requests",
      "Data engineering or warehouse construction",
      "Third-party data licensing",
      "Enterprise identity infrastructure",
      "Unbounded admin functionality",
      "Advanced predictive analytics or machine learning",
      "Ongoing data operations after handover",
    ],
    cta: "Discuss your dashboard or portal",
  },
  {
    slug: "maintenance-improvements",
    title: "Website Maintenance and Improvements",
    summary:
      "Keep an existing website useful through defined fixes, incremental improvements, and agreed routine changes.",
    purpose:
      "Keep an existing website useful by addressing defined defects, making incremental improvements, and handling agreed routine changes.",
    clientNeed:
      "A business needs maintenance or improvements when it already has a functioning website but needs fixes after launch, small improvements without a redesign, a backlog of defined web changes, or ongoing development capacity for agreed maintenance work.",
    idealFor: [
      "Existing functioning websites",
      "Post-launch fixes",
      "Small improvements without a redesign",
      "Defined backlogs of web changes",
      "Ongoing development capacity for agreed maintenance work",
    ],
    typicalScope:
      "Maintenance work should be ticket- or task-defined wherever practical. A maintenance engagement may operate as a fixed group of changes, a recurring block of defined improvements, or a prioritized backlog with explicitly approved tasks. New requests that materially expand the nature of the work are scoped separately.",
    deliverables: [
      "Defined bug fixes",
      "Small UI or UX improvements",
      "Content or page updates within agreed responsibility",
      "Minor feature additions",
      "Dependency or configuration updates where appropriate",
      "Performance or accessibility fixes in agreed areas",
      "Small integration changes",
      "Documentation of completed changes when useful",
    ],
    boundaries: [
      "Full website redesign",
      "Large new application features",
      "Unbounded emergency support",
      "24/7 monitoring or incident response",
      "Third-party subscription costs",
      "Major infrastructure migration",
      "Unrelated legacy-system remediation",
      "Guaranteed uptime when infrastructure is controlled by another provider",
    ],
    cta: "Discuss your maintenance needs",
  },
];

export function getService(slug: string) {
  return services.find((service) => service.slug === slug);
}
