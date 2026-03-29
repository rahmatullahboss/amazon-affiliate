// Environment bindings for Cloudflare Workers
export type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  ENVIRONMENT: string;
  SUPPORTED_MARKETPLACES: string;
  PUBLIC_APP_URL?: string;
  DEFAULT_AMAZON_TAG?: string;
  JWT_SECRET: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  AMAZON_API_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_REPLY_TO?: string;
  GOOGLE_CLIENT_ID?: string;
  IP_SALT?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
};

// Hono app types
export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    userId?: number;
    userRole?: 'super_admin' | 'admin' | 'agent';
    agentId?: number | null;
    username?: string;
  };
};

// Database row types
export interface AgentRow {
  id: number;
  slug: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ProductRow {
  id: number;
  asin: string;
  title: string;
  image_url: string;
  marketplace: string;
  category: string | null;
  status?: 'active' | 'pending_review' | 'rejected';
  is_active: number;
  fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackingIdRow {
  id: number;
  agent_id: number;
  tag: string;
  label: string | null;
  marketplace: string;
  is_default: number;
  is_active: number;
  created_at: string;
}

export interface AgentProductRow {
  id: number;
  agent_id: number;
  product_id: number;
  tracking_id: number;
  custom_title: string | null;
  is_active: number;
  created_at: string;
}

export interface ClickRow {
  id: number;
  agent_id: number;
  product_id: number;
  tracking_tag: string;
  ip_hash: string | null;
  user_agent: string | null;
  referer: string | null;
  country: string | null;
  clicked_at: string;
}

export interface PageViewRow {
  id: number;
  agent_id: number;
  product_id: number;
  ip_hash: string | null;
  user_agent: string | null;
  referer: string | null;
  country: string | null;
  viewed_at: string;
}

export interface AdminUserRow {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  created_at: string;
}

export interface UserRow {
  id: number;
  username: string;
  email: string | null;
  password_hash: string;
  role: 'super_admin' | 'admin' | 'agent';
  agent_id: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// API response types
export interface LandingPageData {
  agent: {
    slug: string;
    name: string;
  };
  product: {
    asin: string;
    title: string;
    imageUrl: string;
    description?: string | null;
    features?: string[];
    productImages?: string[];
    aplusImages?: string[];
    customTitle?: string;
  };
  trackingTag: string;
  amazonUrl: string;
  marketplace: string;
}

export interface AnalyticsOverview {
  totalClicks: number;
  totalViews: number;
  clicksToday: number;
  viewsToday: number;
  clicksThisWeek: number;
  viewsThisWeek: number;
  totalOrderedItems: number;
  totalRevenue: number;
  totalCommission: number;
  topAgents: Array<{ name: string; slug: string; clicks: number }>;
  topProducts: Array<{ asin: string; title: string; clicks: number }>;
  topAgentsByCommission: Array<{
    name: string;
    slug: string;
    orderedItems: number;
    revenueAmount: number;
    commissionAmount: number;
  }>;
  recentReports: Array<{
    id: number;
    marketplace: string;
    sourceFileName: string;
    importedAt: string;
    importedByUsername: string | null;
    conversionsCount: number;
  }>;
}

// Amazon URL builder — 7 marketplaces supported
export const AMAZON_DOMAINS: Record<string, string> = {
  US: 'www.amazon.com',
  UK: 'www.amazon.co.uk',
  DE: 'www.amazon.de',
  FR: 'www.amazon.fr',
  IT: 'www.amazon.it',
  ES: 'www.amazon.es',
  CA: 'www.amazon.ca',
  JP: 'www.amazon.co.jp',
  IN: 'www.amazon.in',
  AU: 'www.amazon.com.au',
};

export const buildAmazonUrl = (
  asin: string,
  tag: string,
  marketplace: string = 'US'
): string => {
  const domain = AMAZON_DOMAINS[marketplace] || AMAZON_DOMAINS.US;
  return `https://${domain}/dp/${asin}?tag=${tag}`;
};
