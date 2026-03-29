> **BrainSync Context Pumper** 🧠
> Dynamically loaded for active file: `app/routes/portal/register.tsx` (Domain: **Frontend (React/UI)**)

### 🔴 Frontend (React/UI) Gotchas
- **⚠️ GOTCHA: Fixed null crash in PortalLoginPage — improves module reusability**: - 
+ import { extractApiErrorMessage } from "../../utils/api-errors";
- export default function PortalLoginPage() {
+ 
-   const navigate = useNavigate();
+ export default function PortalLoginPage() {
-   const [username, setUsername] = useState("");
+   const navigate = useNavigate();
-   const [password, setPassword] = useState("");
+   const [username, setUsername] = useState("");
-   const [loading, setLoading] = useState(false);
+   const [password, setPassword] = useState("");
-   const [error, setError] = useState("");
+   const [loading, setLoading] = useState(false);
- 
+   const [error, setError] = useState("");
-   const handleLogin = async (event: React.FormEvent) => {
+ 
-     event.preventDefault();
+   const handleLogin = async (event: React.FormEvent) => {
-     setLoading(true);
+     event.preventDefault();
-     setError("");
+     setLoading(true);
- 
+     setError("");
-     try {
+ 
-       const response = await fetch("/api/auth/login", {
+     try {
-         method: "POST",
+       const response = await fetch("/api/auth/login", {
-         headers: { "Content-Type": "application/json" },
+         method: "POST",
-         body: JSON.stringify({ username, password }),
+         headers: { "Content-Type": "application/json" },
-       });
+         body: JSON.stringify({ username, password }),
- 
+       });
-       if (!response.ok) {
+ 
-         const data = (await response.json()) as { error?: string };
+       if (!response.ok) {
-         throw new Error(data.error || "Login failed");
+         const data = await response.json();
-       }
+         throw new Error(extractApiErrorMessage(data, "Login failed"));
- 
+       }
-       const data = (await response.json()) as {
+ 
-         token: string;
+       const data = (await response.json()) as {
-         user: { id: number; username: string; role: string; agentId: number | null };
+         token: string;
-       };
+         user: { id: number; username: string; role: string; ag
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [PortalLoginPage, styles]
- **⚠️ GOTCHA: Fixed null crash in PortalProduct — formalizes the data contract with explici...**: - 
+ import { copyTextToClipboard } from "../../utils/clipboard";
- interface PortalProduct {
+ 
-   id: number;
+ interface PortalProduct {
-   custom_title: string | null;
+   id: number;
-   product_id: number;
+   custom_title: string | null;
-   asin: string;
+   product_id: number;
-   marketplace: string;
+   asin: string;
-   title: string;
+   marketplace: string;
-   image_url: string;
+   title: string;
-   status: string;
+   image_url: string;
-   tracking_tag: string;
+   status: string;
- }
+   tracking_tag: string;
- 
+ }
- interface SubmissionResponse {
+ 
-   message: string;
+ interface SubmissionResponse {
-   link: string;
+   message: string;
-   redirectLink: string;
+   link: string;
-   status: string;
+   redirectLink: string;
-   product: {
+   status: string;
-     asin: string;
+   product: {
-     marketplace: string;
+     asin: string;
-     title: string;
+     marketplace: string;
-     imageUrl: string;
+     title: string;
-   };
+     imageUrl: string;
- }
+   };
- 
+ }
- export default function PortalProductsPage() {
+ 
-   const [products, setProducts] = useState<PortalProduct[]>([]);
+ export default function PortalProductsPage() {
-   const [loading, setLoading] = useState(true);
+   const [products, setProducts] = useState<PortalProduct[]>([]);
-   const [error, setError] = useState("");
+   const [loading, setLoading] = useState(true);
-   const [asin, setAsin] = useState("");
+   const [error, setError] = useState("");
-   const [marketplace, setMarketplace] = useState("US");
+   const [asin, setAsin] = useState("");
-   const [customTitle, setCustomTitle] = useState("");
+   const [marketplace, setMarketplace] = useState("US");
-   const [submitting, setSubmitting] = useState(false);
+   const [customTitle, setCustomTitle] = useState("");
-   const [success, setSuccess] = useState<SubmissionResponse | null>(null);
+   const [submitting, setSubmitting] = useState(false);
- 
+   const [success, setSuccess] = useState<Submis
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [PortalProduct, SubmissionResponse, PortalProductsPage, styles]

### 📐 Frontend (React/UI) Conventions & Fixes
- **[problem-fix] problem-fix in register.tsx**: File updated (external): app/routes/portal/register.tsx

Content summary (221 lines):
import { useState } from "react";
import { Link, useNavigate } from "react-router";

interface ValidationIssue {
  message?: string;
  path?: string[];
}

function extractErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Registration failed";
  }

  const data = payload as {
    error?: string | { issues?: ValidationIssue[] };
    message?: string;
  };

  if (typeof data.error === "string" && data.error.trim()) {
    return data.error;
  }

  
- **[discovery] discovery in reset-password.tsx**: File updated (external): app/routes/portal/reset-password.tsx

Content summary (162 lines):
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { extractApiErrorMessage } from "../../utils/api-errors";

export default function PortalResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

- **[what-changed] Replaced auth Agent**: -     <main style={styles.page}>
+     <main className="min-h-screen flex text-left items-center justify-center p-8 bg-slate-900">
-       <form onSubmit={handleLogin} style={styles.card}>
+       <form onSubmit={handleLogin} className="w-full max-w-[420px] bg-slate-900/90 border border-white/10 rounded-2xl p-8 grid gap-4 shadow-xl">
-         <h1 style={styles.title}>Agent Portal</h1>
+         <div className="text-center mb-2">
-         <p style={styles.subtitle}>Log in to submit ASINs and manage your affiliate links.</p>
+             <h1 className="m-0 text-2xl font-bold text-gray-50">Agent Portal</h1>
- 
+             <p className="m-0 text-sm text-slate-400 mt-1 leading-relaxed">Log in to submit ASINs and manage your affiliate links.</p>
-         {error ? <p style={styles.error}>{error}</p> : null}
+         </div>
-         <label style={styles.label}>
+         {error ? <p className="m-0 mb-2 py-3 px-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm text-center">{error}</p> : null}
-           Username
+ 
-           <input style={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} required />
+         <label className="grid gap-2 text-sm font-medium text-slate-300">
-         </label>
+           Username
- 
+           <input 
-         <label style={styles.label}>
+             className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-gray-50 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50" 
-           Password
+             value={username} 
-           <input
+             onChange={(e) => setUsername(e.target.value)} 
-             style={styles.input}
+             required 
-             type="password"
+           />
-             value={password}
+         </label>
-             onChange={(e) => setPassword(e.target.value)}
+ 
-             required
+         <label className="grid gap-2 text-sm font-medium text-slate-300">
-     
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [PortalLoginPage]
- **[discovery] discovery in forgot-password.tsx**: File updated (external): app/routes/portal/forgot-password.tsx

Content summary (133 lines):
import { useState } from "react";
import { Link } from "react-router";
import { extractApiErrorMessage } from "../../utils/api-errors";

export default function PortalForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
   
- **[problem-fix] Fixed null crash in Delete**: -               <div className="flex items-center gap-2">
+               <div className="flex items-center gap-2 flex-wrap">
-                 <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/25 rounded-full text-amber-500 text-xs font-bold">
+                 <button
-                   {trackingId.is_default ? "Default" : "Saved"}
+                   type="button"
-                 </span>
+                   className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full text-red-400 text-xs font-semibold cursor-pointer hover:bg-red-500/20 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
-               </div>
+                   disabled={deletingId === trackingId.id}
-             </div>
+                   onClick={async () => {
-           ))}
+                     if (!window.confirm("Delete this tag?")) return;
-         </div>
+ 
-       </article>
+                     setDeletingId(trackingId.id);
-     </section>
+                     setError("");
-   );
+                     setSuccess("");
- }
+ 
- 
+                     try {
+                       const token = localStorage.getItem("auth_token");
+                       const response = await fetch(`/api/portal/tracking/${trackingId.id}`, {
+                         method: "DELETE",
+                         headers: { Authorization: `Bearer ${token}` },
+                       });
+ 
+                       if (!response.ok) {
+                         const data = await response.json();
+                         throw new Error(extractApiErrorMessage(data, "Failed to delete tag"));
+                       }
+ 
+                       if (editingId === trackingId.id) {
+                         setEditingId(null);
+                         setForm({ tag: "", label: "", marketplace: "US" });
+                       }
+ 
+                       setSuccess("Tag deleted successfully");
+                       await loadTracking();
+                    
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [TrackingIdRow, MARKETPLACES, PortalTrackingPage]
- **[problem-fix] Fixed null crash in Authorization**: -   const [editingId, setEditingId] = useState<number | null>(null);
+   const [deletingId, setDeletingId] = useState<number | null>(null);
-   const [form, setForm] = useState({
+   const [editingId, setEditingId] = useState<number | null>(null);
-     tag: "",
+   const [form, setForm] = useState({
-     label: "",
+     tag: "",
-     marketplace: "US",
+     label: "",
-   });
+     marketplace: "US",
- 
+   });
-   async function loadTracking() {
+ 
-     const token = localStorage.getItem("auth_token");
+   async function loadTracking() {
-     const response = await fetch("/api/portal/tracking", {
+     const token = localStorage.getItem("auth_token");
-       headers: { Authorization: `Bearer ${token}` },
+     const response = await fetch("/api/portal/tracking", {
-     });
+       headers: { Authorization: `Bearer ${token}` },
- 
+     });
-     if (!response.ok) {
+ 
-       throw new Error("Failed to load tracking IDs");
+     if (!response.ok) {
-     }
+       throw new Error("Failed to load tracking IDs");
- 
+     }
-     const data = (await response.json()) as { trackingIds: TrackingIdRow[] };
+ 
-     setTrackingIds(data.trackingIds);
+     const data = (await response.json()) as { trackingIds: TrackingIdRow[] };
-   }
+     setTrackingIds(data.trackingIds);
- 
+   }
-   useEffect(() => {
+ 
-     loadTracking()
+   useEffect(() => {
-       .catch((requestError) =>
+     loadTracking()
-         setError(requestError instanceof Error ? requestError.message : "Failed to load tracking IDs")
+       .catch((requestError) =>
-       )
+         setError(requestError instanceof Error ? requestError.message : "Failed to load tracking IDs")
-       .finally(() => setLoading(false));
+       )
-   }, []);
+       .finally(() => setLoading(false));
- 
+   }, []);
-   const handleSubmit = async (event: React.FormEvent) => {
+ 
-     event.preventDefault();
+   const handleSubmit = async (event: React.FormEvent) => {
-     setSaving(true);
+     event.preven
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [TrackingIdRow, MARKETPLACES, PortalTrackingPage, styles]
- **[what-changed] Updated schema Submit**: -     <section style={styles.wrap}>
+     <section className="flex flex-col lg:grid lg:grid-cols-[minmax(320px,420px)_1fr] gap-4">
-       <article style={styles.card}>
+       <article className="bg-[#111827] border border-white/10 rounded-2xl p-6">
-         <h1 style={styles.title}>Submit ASIN</h1>
+         <h1 className="m-0 mb-3 text-gray-50 text-xl font-bold">Submit ASIN</h1>
-         <p style={styles.copy}>Paste an ASIN or full Amazon product link. If live product data is fetched successfully, your tracked link will be ready instantly.</p>
+         <p className="m-0 mb-2 text-slate-300 leading-relaxed text-sm">Paste an ASIN or full Amazon product link. If live product data is fetched successfully, your tracked link will be ready instantly.</p>
-         <p style={styles.helper}>
+         <p className="m-0 mb-3 text-blue-300 leading-relaxed text-sm">
-           First time here? Add your marketplace tracking ID in <Link style={styles.link} to="/portal/tracking">Tracking IDs</Link>.
+           First time here? Add your marketplace tracking ID in <Link className="text-amber-400 no-underline font-semibold hover:text-amber-300" to="/portal/tracking">Tracking IDs</Link>.
-         <form onSubmit={handleSubmit} style={styles.form}>
+         <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3">
-             style={styles.input}
+             className="rounded-xl border border-white/10 bg-gray-800 text-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
-           <select style={styles.input} value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
+           <select className="rounded-xl border border-white/10 bg-gray-800 text-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-auto" value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
-             style={styles.input}
+             className="rounded-xl border border-white/10 bg-gray-800 text-gray-50 px-4 py-3 f
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [PortalProduct, SubmissionResponse, PortalProductsPage]
- **[problem-fix] problem-fix in dashboard.tsx**: -     return <p style={styles.copy}>Loading dashboard...</p>;
+     return <p className="m-0 mb-2 text-[#cbd5e1] leading-relaxed">Loading dashboard...</p>;
-       <section style={styles.grid}>
+       <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
-         <article style={styles.card}>
+         <article className="bg-[#111827] border border-white/10 rounded-2xl p-6">
-           <h2 style={styles.heading}>Portal Dashboard</h2>
+           <h2 className="m-0 mb-3 text-[#f9fafb] text-xl font-bold">Portal Dashboard</h2>
-           <p style={styles.copy}>{error}</p>
+           <p className="m-0 mb-2 text-[#cbd5e1] leading-relaxed">{error}</p>
-           <button onClick={() => void loadDashboard()} style={styles.retryButton}>
+           <button onClick={() => void loadDashboard()} className="px-4 py-3 bg-[#0f766e] rounded-xl text-[#f8fafc] font-semibold cursor-pointer border-none mt-2">

📌 IDE AST Context: Modified symbols likely include [PortalMeResponse, PortalPerformanceResponse, PortalDashboardPage]
- **[convention] Updated schema MARKETPLACES — confirmed 3x**: - 
+         <p style={styles.helper}>
-         <form onSubmit={handleSubmit} style={styles.form}>
+           You can paste just the tracking ID or the full tag format like <code>?tag=agent-us-20</code>. The
-           <select
+           system will save only the tracking ID automatically.
-             style={styles.input}
+         </p>
-             value={form.marketplace}
+ 
-             onChange={(e) => setForm({ ...form, marketplace: e.target.value })}
+         <form onSubmit={handleSubmit} style={styles.form}>
-           >
+           <select
-             {MARKETPLACES.map((marketplace) => (
+             style={styles.input}
-               <option key={marketplace} value={marketplace}>
+             value={form.marketplace}
-                 {marketplace}
+             onChange={(e) => setForm({ ...form, marketplace: e.target.value })}
-               </option>
+           >
-             ))}
+             {MARKETPLACES.map((marketplace) => (
-           </select>
+               <option key={marketplace} value={marketplace}>
- 
+                 {marketplace}
-           <input
+               </option>
-             style={styles.input}
+             ))}
-             placeholder="Tracking ID (example: agent-us-20)"
+           </select>
-             value={form.tag}
+ 
-             onChange={(e) => setForm({ ...form, tag: e.target.value })}
+           <input
-             required
+             style={styles.input}
-           />
+             placeholder="Tracking ID or ?tag=agent-us-20"
- 
+             value={form.tag}
-           <input
+             onChange={(e) => setForm({ ...form, tag: e.target.value })}
-             style={styles.input}
+             required
-             placeholder="Label (optional)"
+           />
-             value={form.label}
+ 
-             onChange={(e) => setForm({ ...form, label: e.target.value })}
+           <input
-           />
+             style={styles.input}
- 
+             placeholder="Label 
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [TrackingIdRow, MARKETPLACES, PortalTrackingPage, styles]
- **[discovery] discovery in links.tsx**: File updated (external): app/routes/portal/links.tsx

Content summary (129 lines):
import { useEffect, useState } from "react";
import { copyTextToClipboard } from "../../utils/clipboard";

interface PortalLink {
  agentSlug: string;
  agentName: string;
  asin: string;
  marketplace: string;
  title: string;
  imageUrl: string;
  trackingTag: string;
  bridgePageUrl: string;
  redirectUrl: string;
}

export default function PortalLinksPage() {
  const [links, setLinks] = useState<PortalLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = us
- **[what-changed] what-changed in tracking.tsx**: File updated (external): app/routes/portal/tracking.tsx

Content summary (221 lines):
import { useEffect, useState } from "react";
import { extractApiErrorMessage } from "../../utils/api-errors";

interface TrackingIdRow {
  id: number;
  tag: string;
  label: string | null;
  marketplace: string;
  is_default: number;
  is_active: number;
  created_at: string;
}

const MARKETPLACES = ["US", "CA", "UK", "DE", "IT", "FR", "ES"];

export default function PortalTrackingPage() {
  const [trackingIds, setTrackingIds] = useState<TrackingIdRow[]>([]);
  const [loading, setLoading] = use
- **[convention] Fixed null crash in Link — formalizes the data contract with explicit types — confirmed 5x**: - 
+ import { Link } from "react-router";
- interface PortalProduct {
+ 
-   id: number;
+ interface PortalProduct {
-   custom_title: string | null;
+   id: number;
-   product_id: number;
+   custom_title: string | null;
-   asin: string;
+   product_id: number;
-   marketplace: string;
+   asin: string;
-   title: string;
+   marketplace: string;
-   image_url: string;
+   title: string;
-   status: string;
+   image_url: string;
-   tracking_tag: string;
+   status: string;
- }
+   tracking_tag: string;
- 
+ }
- interface SubmissionResponse {
+ 
-   message: string;
+ interface SubmissionResponse {
-   link: string;
+   message: string;
-   redirectLink: string;
+   link: string;
-   status: string;
+   redirectLink: string;
-   product: {
+   status: string;
-     asin: string;
+   product: {
-     marketplace: string;
+     asin: string;
-     title: string;
+     marketplace: string;
-     imageUrl: string;
+     title: string;
-   };
+     imageUrl: string;
- }
+   };
- 
+ }
- export default function PortalProductsPage() {
+ 
-   const [products, setProducts] = useState<PortalProduct[]>([]);
+ export default function PortalProductsPage() {
-   const [loading, setLoading] = useState(true);
+   const [products, setProducts] = useState<PortalProduct[]>([]);
-   const [error, setError] = useState("");
+   const [loading, setLoading] = useState(true);
-   const [asin, setAsin] = useState("");
+   const [error, setError] = useState("");
-   const [marketplace, setMarketplace] = useState("US");
+   const [asin, setAsin] = useState("");
-   const [customTitle, setCustomTitle] = useState("");
+   const [marketplace, setMarketplace] = useState("US");
-   const [submitting, setSubmitting] = useState(false);
+   const [customTitle, setCustomTitle] = useState("");
-   const [success, setSuccess] = useState<SubmissionResponse | null>(null);
+   const [submitting, setSubmitting] = useState(false);
- 
+   const [success, setSuccess] = useState<SubmissionResponse | null>(nul
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [PortalProduct, SubmissionResponse, PortalProductsPage, styles]
- **[problem-fix] problem-fix in login.tsx**: File updated (external): app/routes/portal/login.tsx

Content summary (128 lines):
import { useState } from "react";
import { Link, useNavigate } from "react-router";

export default function PortalLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const 
