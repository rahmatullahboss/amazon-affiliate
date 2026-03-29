import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // All public pages wrapped in Header + Footer layout
  layout("routes/public-layout.tsx", [
    // Home page
    index("routes/home.tsx"),

    // Public Content Pages
    route("privacy", "routes/privacy.tsx"),
    route("disclosure", "routes/disclosure.tsx"),
    route("about", "routes/about.tsx"),
    route("contact", "routes/contact.tsx"),

    // Dynamic Content Routes
    route("deals", "routes/deals.tsx"),
    route("deals/:asin", "routes/product-detail.tsx"),
    route("category/:slug", "routes/category.tsx"),
    route(":agent/:asin", "routes/bridge.tsx"),
  ]),

  // Admin routes — separate layout
  route("admin/login", "routes/admin/login.tsx"),
  route("admin", "routes/admin/layout.tsx", [
    index("routes/admin/dashboard.tsx"),
    route("users", "routes/admin/users.tsx"),
    route("agents", "routes/admin/agents.tsx"),
    route("products", "routes/admin/products.tsx"),
    route("product-submissions", "routes/admin/product-submissions.tsx"),
    route("tracking", "routes/admin/tracking.tsx"),
    route("mappings", "routes/admin/mappings.tsx"),
    route("analytics", "routes/admin/analytics.tsx"),
    route("reports", "routes/admin/reports.tsx"),
    route("audit-logs", "routes/admin/audit-logs.tsx"),
  ]),

  route("portal/login", "routes/portal/login.tsx"),
  route("portal/register", "routes/portal/register.tsx"),
  route("portal/forgot-password", "routes/portal/forgot-password.tsx"),
  route("portal/reset-password", "routes/portal/reset-password.tsx"),
  route("portal/complete-signup", "routes/portal/complete-signup.tsx"),
  route("portal", "routes/portal/layout.tsx", [
    index("routes/portal/dashboard.tsx"),
    route("asins/new", "routes/portal/asin-new.tsx"),
    route("products", "routes/portal/products.tsx"),
    route("links", "routes/portal/links.tsx"),
    route("tracking", "routes/portal/tracking.tsx"),
    route("analytics", "routes/portal/analytics.tsx"),
  ]),
] satisfies RouteConfig;
