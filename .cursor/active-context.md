> **BrainSync Context Pumper** 🧠
> Dynamically loaded for active file: `app/components/home/ProductCard.tsx` (Domain: **Frontend (React/UI)**)

### 📐 Frontend (React/UI) Conventions & Fixes
- **[convention] Fixed null crash in ProductCard — confirmed 3x**: -   category: string;
+   category: string | null;
-   price: string;
+   price?: string;
- }
+   marketplace?: string | null;
- 
+ }
- export function ProductCard({ item }: { item: ProductItem }) {
+ 
-   const url = item.asin ? `/deals/${item.asin}` : `/deals`;
+ export function ProductCard({ item }: { item: ProductItem }) {
- 
+   const url = item.asin ? `/deals/${item.asin}` : `/deals`;
-   return (
+ 
-     <Link 
+   return (
-       to={url} 
+     <Link 
-       className="group block bg-white rounded transition hover:shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] p-4 border border-gray-100/50"
+       to={url} 
-     >
+       className="group block rounded-[1.75rem] border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-30px_rgba(11,128,128,0.35)]"
-       {/* Product Image */}
+     >
-       <div className="relative w-full aspect-square mb-4 flex items-center justify-center bg-transparent">
+       <div className="mb-4 flex items-center justify-between gap-3">
-         <img 
+         <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
-           src={item.image_url} 
+           {item.marketplace || "US"}
-           alt={item.title} 
+         </span>
-           className="max-h-full max-w-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
+         <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
-           loading="lazy"
+           Amazon
-         />
+         </span>
-       <div className="flex flex-col text-left">
+       <div className="relative mb-5 flex aspect-square w-full items-center justify-center rounded-[1.4rem] bg-[#f5f8f8] p-5">
-         {/* Category */}
+         <img 
-         <span className="text-[11px] text-gray-500 uppercase tracking-wide mb-1 block">
+           src={item.image_url} 
-           {item.category || "General"}
+           alt={item.title} 
-         </
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [ProductItem, ProductCard]
- **[problem-fix] problem-fix in products.tsx**: File updated (external): app/routes/portal/products.tsx

Content summary (199 lines):
import { useEffect, useState } from "react";

interface PortalProduct {
  id: number;
  custom_title: string | null;
  product_id: number;
  asin: string;
  marketplace: string;
  title: string;
  image_url: string;
  status: string;
  tracking_tag: string;
}

export default function PortalProductsPage() {
  const [products, setProducts] = useState<PortalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [asin, setAsin] = useState(""
- **[what-changed] Replaced auth Reviews**: -     { to: "/admin/tracking", label: "Tracking", icon: "🏷️" },
+     { to: "/admin/product-submissions", label: "Reviews", icon: "🛂" },
-     { to: "/admin/mappings", label: "Mappings", icon: "🔗" },
+     { to: "/admin/tracking", label: "Tracking", icon: "🏷️" },
-     { to: "/admin/analytics", label: "Analytics", icon: "📈" },
+     { to: "/admin/mappings", label: "Mappings", icon: "🔗" },
-     { to: "/admin/audit-logs", label: "Audit Logs", icon: "🧾" },
+     { to: "/admin/analytics", label: "Analytics", icon: "📈" },
-   ];
+     { to: "/admin/reports", label: "Reports", icon: "🧾" },
- 
+     { to: "/admin/audit-logs", label: "Audit Logs", icon: "🧾" },
-   return (
+   ];
-     <div style={styles.layout}>
+ 
-       <aside style={styles.sidebar}>
+   return (
-         <div style={styles.sidebarHeader}>
+     <div style={styles.layout}>
-           <span style={styles.sidebarLogo}>D</span>
+       <aside style={styles.sidebar}>
-           <span style={styles.sidebarTitle}>DealsRky</span>
+         <div style={styles.sidebarHeader}>
-         </div>
+           <span style={styles.sidebarLogo}>D</span>
- 
+           <span style={styles.sidebarTitle}>DealsRky</span>
-         <nav style={styles.nav}>
+         </div>
-           {navItems.map((item) => (
+ 
-             <NavLink
+         <nav style={styles.nav}>
-               key={item.to}
+           {navItems.map((item) => (
-               to={item.to}
+             <NavLink
-               end={item.end}
+               key={item.to}
-               style={({ isActive }) => ({
+               to={item.to}
-                 ...styles.navLink,
+               end={item.end}
-                 background: isActive ? "rgba(255, 153, 0, 0.1)" : "transparent",
+               style={({ isActive }) => ({
-                 color: isActive ? "#ff9900" : "#a0a0b8",
+                 ...styles.navLink,
-                 borderLeft: isActive ? "3px solid #ff9900" : "3px solid transparent",
+                 ba
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [AdminLayout, styles]
- **[what-changed] what-changed in deals.tsx**: -       SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?
+       SELECT * FROM products WHERE is_active = 1 AND status = 'active' ORDER BY created_at DESC LIMIT ? OFFSET ?
-       SELECT COUNT(*) as total FROM products WHERE is_active = 1
+       SELECT COUNT(*) as total FROM products WHERE is_active = 1 AND status = 'active'

📌 IDE AST Context: Modified symbols likely include [meta, loader, DealsPage]
- **[what-changed] what-changed in home.tsx**: -       WHERE is_active = 1
+       WHERE is_active = 1 AND status = 'active'

📌 IDE AST Context: Modified symbols likely include [ProductRow, HomeLoaderData, meta, loader, editorialHighlights]
- **[what-changed] Replaced auth Audit**: -   ];
+     { to: "/admin/audit-logs", label: "Audit Logs", icon: "🧾" },
- 
+   ];
-   return (
+ 
-     <div style={styles.layout}>
+   return (
-       <aside style={styles.sidebar}>
+     <div style={styles.layout}>
-         <div style={styles.sidebarHeader}>
+       <aside style={styles.sidebar}>
-           <span style={styles.sidebarLogo}>D</span>
+         <div style={styles.sidebarHeader}>
-           <span style={styles.sidebarTitle}>DealsRky</span>
+           <span style={styles.sidebarLogo}>D</span>
-         </div>
+           <span style={styles.sidebarTitle}>DealsRky</span>
- 
+         </div>
-         <nav style={styles.nav}>
+ 
-           {navItems.map((item) => (
+         <nav style={styles.nav}>
-             <NavLink
+           {navItems.map((item) => (
-               key={item.to}
+             <NavLink
-               to={item.to}
+               key={item.to}
-               end={item.end}
+               to={item.to}
-               style={({ isActive }) => ({
+               end={item.end}
-                 ...styles.navLink,
+               style={({ isActive }) => ({
-                 background: isActive ? "rgba(255, 153, 0, 0.1)" : "transparent",
+                 ...styles.navLink,
-                 color: isActive ? "#ff9900" : "#a0a0b8",
+                 background: isActive ? "rgba(255, 153, 0, 0.1)" : "transparent",
-                 borderLeft: isActive ? "3px solid #ff9900" : "3px solid transparent",
+                 color: isActive ? "#ff9900" : "#a0a0b8",
-               })}
+                 borderLeft: isActive ? "3px solid #ff9900" : "3px solid transparent",
-             >
+               })}
-               <span>{item.icon}</span>
+             >
-               <span>{item.label}</span>
+               <span>{item.icon}</span>
-             </NavLink>
+               <span>{item.label}</span>
-           ))}
+             </NavLink>
-         </nav>
+           ))}
- 
+         </nav>
-         <div style={style
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [AdminLayout, styles]
- **[convention] Added JWT tokens authentication — prevents null/undefined runtime crashes — confirmed 3x**: -   topAgents: Array<{ name: string; slug: string; clicks: number }>;
+   totalOrderedItems: number;
-   topProducts: Array<{ asin: string; title: string; clicks: number }>;
+   totalRevenue: number;
- }
+   totalCommission: number;
- 
+   topAgents: Array<{ name: string; slug: string; clicks: number }>;
- export default function Dashboard() {
+   topProducts: Array<{ asin: string; title: string; clicks: number }>;
-   const [data, setData] = useState<OverviewData | null>(null);
+ }
-   const [loading, setLoading] = useState(true);
+ 
- 
+ export default function Dashboard() {
-   useEffect(() => { fetchData(); }, []);
+   const [data, setData] = useState<OverviewData | null>(null);
- 
+   const [loading, setLoading] = useState(true);
-   const fetchData = async () => {
+ 
-     try {
+   useEffect(() => { fetchData(); }, []);
-       const token = localStorage.getItem("auth_token");
+ 
-       const res = await fetch("/api/analytics/overview", {
+   const fetchData = async () => {
-         headers: { Authorization: `Bearer ${token}` },
+     try {
-       });
+       const token = localStorage.getItem("auth_token");
-       if (res.ok) setData(await res.json());
+       const res = await fetch("/api/analytics/overview", {
-     } catch (err) { console.error("Failed to fetch dashboard data:", err); }
+         headers: { Authorization: `Bearer ${token}` },
-     finally { setLoading(false); }
+       });
-   };
+       if (res.ok) setData(await res.json());
- 
+     } catch (err) { console.error("Failed to fetch dashboard data:", err); }
-   if (loading) {
+     finally { setLoading(false); }
-     return <div style={{ color: "#a0a0b8", padding: "2rem" }}>Loading dashboard...</div>;
+   };
-   }
+ 
- 
+   if (loading) {
-   const stats = [
+     return <div style={{ color: "#a0a0b8", padding: "2rem" }}>Loading dashboard...</div>;
-     { label: "Total Clicks", value: data?.totalClicks ?? 0, icon: "🖱️", color: "#ff9900" },
+   }
-     { label: "Total Views", value:
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [OverviewData, Dashboard]
- **[what-changed] Updated API endpoint DealsRky — improves module reusability**: -   { title: "DealsRky — Your Trusted Shopping Companion" },
+   { title: "DealsRky | Curated Amazon Affiliate Storefront" },
-     content: "Find the best deals on top products. Shop securely through Amazon with verified links.",
+     content:
-   },
+       "Curated Amazon product pages, fast bridge links, and transparent affiliate disclosures built for direct Amazon checkout.",
-   { name: "viewport", content: "width=device-width, initial-scale=1" },
+   },
-   { name: "theme-color", content: "#0a0a0f" },
+   { name: "viewport", content: "width=device-width, initial-scale=1" },
- ];
+   { name: "theme-color", content: "#0a0a0f" },
- 
+ ];
- export function Layout({ children }: { children: React.ReactNode }) {
+ 
-   return (
+ export function Layout({ children }: { children: React.ReactNode }) {
-     <html lang="en">
+   return (
-       <head>
+     <html lang="en">
-         <meta charSet="utf-8" />
+       <head>
-         <meta name="viewport" content="width=device-width, initial-scale=1" />
+         <meta charSet="utf-8" />
-         <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
+         <meta name="viewport" content="width=device-width, initial-scale=1" />
-         <Meta />
+         <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
-         <Links />
+         <Meta />
-       </head>
+         <Links />
-       <body>
+       </head>
-         {children}
+       <body>
-         <ScrollRestoration />
+         {children}
-         <Scripts />
+         <ScrollRestoration />
-       </body>
+         <Scripts />
-     </html>
+       </body>
-   );
+     </html>
- }
+   );
- 
+ }
- export default function App() {
+ 
-   return <Outlet />;
+ export default function App() {
- }
+   return <Outlet />;
- 
+ }
- export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
+ 
-   let message = "Oops!";
+ export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
-   let details = "An unexpected error occurred.";

… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [meta, Layout, App, ErrorBoundary]
- **[convention] Strengthened types ProductRow — formalizes the data contract with explicit types**: - export function meta({}: Route.MetaArgs) {
+ interface ProductRow {
-   return [
+   id: number;
-     { title: "DealsRky — Your Trusted Shopping Companion" },
+   asin: string;
-   ];
+   title: string;
- }
+   image_url: string;
- 
+   category: string | null;
- export async function loader({ context }: Route.LoaderArgs) {
+   marketplace: string | null;
-   const env = context.cloudflare.env;
+   created_at: string;
-   
+ }
-   // Minimal query for featured items
+ 
-   const products = await env.DB.prepare(`
+ interface HomeLoaderData {
-     SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC LIMIT 12
+   products: ProductRow[];
-   `).all();
+ }
-   return { products: products.results || [] };
+ export function meta({}: Route.MetaArgs) {
- }
+   return [
- 
+     { title: "DealsRky | Curated Amazon Finds" },
- export default function Home({ loaderData }: Route.ComponentProps) {
+     {
-   const data = loaderData as { products: any[] };
+       name: "description",
- 
+       content:
-   // Split products for different sections visually
+         "Browse curated Amazon product picks, review pages, and quick-buy landing pages designed for fast, transparent shopping.",
-   const trending = data.products.slice(0, 6);
+     },
-   const appliances = data.products.slice(6, 12);
+   ];
-   
+ }
-   return (
+ export async function loader({ context }: Route.LoaderArgs) {
-     <div className="bg-white min-h-screen">
+   const env = context.cloudflare.env;
-       
+ 
-       {/* 1. Hero Section (Categories + Banner) */}
+   const { results } = await env.DB.prepare(
-       <section className="bg-white py-4 md:py-8">
+     `
-          <div className="container mx-auto px-4 !max-w-[1280px]">
+       SELECT id, asin, title, image_url, category, marketplace, created_at
-            <div className="flex flex-col md:flex-row gap-6">
+       FROM products
-              {/* Left Column: Vertical Categories Menu (Hidden on Mobile, Visible on Desktop) */}
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [ProductRow, HomeLoaderData, meta, loader, editorialHighlights]
