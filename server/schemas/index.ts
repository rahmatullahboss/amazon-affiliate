import { z } from 'zod';

// Supported marketplaces
export const MARKETPLACES = ['US', 'CA', 'UK', 'DE', 'IT', 'FR', 'ES'] as const;
export type Marketplace = (typeof MARKETPLACES)[number];
export const PRODUCT_STATUSES = ['active', 'pending_review', 'rejected'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

function normalizeTrackingTag(value: string): string {
  return value.trim().replace(/^\?/i, '').replace(/^tag=/i, '');
}

const trackingTagSchema = z
  .string()
  .min(1, 'Tag is required')
  .max(50)
  .transform(normalizeTrackingTag)
  .refine(
    (value) => /^[a-zA-Z0-9][a-zA-Z0-9-]*-[a-zA-Z0-9]+$/.test(value),
    'Use the full tag, like jahid29000-21 or tag=jahid29000-21'
  );

// ─── Agent Schemas ─────────────────────────────────────
export const createAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  is_active: z.boolean().optional(),
});

// ─── Product Schemas ───────────────────────────────────
export const createProductSchema = z.object({
  asin: z.string().length(10, 'ASIN must be 10 characters'),
  title: z.string().min(1, 'Title is required').max(500),
  image_url: z.string().url('Valid image URL required'),
  marketplace: z.enum(MARKETPLACES).default('US'),
  category: z.string().max(100).optional().nullable(),
});

export const fetchAsinSchema = z.object({
  asin: z.string().length(10, 'ASIN must be 10 characters'),
  marketplace: z.enum(MARKETPLACES).default('US'),
});

export const bulkAsinImportSchema = z.object({
  asins: z.array(z.string().length(10)).min(1, 'At least 1 ASIN required').max(500, 'Max 500 ASINs per import'),
  marketplace: z.enum(MARKETPLACES).default('US'),
  default_title_prefix: z.string().max(100).optional(),
});

export const updateProductSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  image_url: z.string().url('Valid image URL required').optional(),
  category: z.string().max(100).optional().nullable(),
  is_active: z.boolean().optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
});

// ─── Tracking ID Schemas ───────────────────────────────
export const createTrackingIdSchema = z.object({
  agent_id: z.number().int().positive(),
  tag: trackingTagSchema,
  label: z.string().max(100).optional().nullable(),
  marketplace: z.enum(MARKETPLACES).default('US'),
  is_default: z.boolean().default(false),
});

// ─── Mapping Schemas ───────────────────────────────────
export const createMappingSchema = z.object({
  agent_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  tracking_id: z.number().int().positive(),
  custom_title: z.string().max(500).optional().nullable(),
});

export const bulkMappingSchema = z.object({
  mappings: z.array(createMappingSchema).min(1).max(100),
});

// ─── Auth Schemas ──────────────────────────────────────
export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const setupSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().optional().nullable(),
  password: z.string().min(8),
});

export const agentRegistrationSchema = z.object({
  agent_name: z.string().min(1).max(100),
  agent_slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  username: z.string().min(3).max(50),
  password: z.string().min(8),
});

export const googleAuthSchema = z.object({
  credential: z.string().min(1, 'Google credential is required'),
});

export const googleCompleteSignupSchema = z.object({
  token: z.string().min(1, 'Signup token is required'),
  agent_name: z.string().min(1).max(100),
  agent_slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  phone: z.string().max(20).optional().nullable(),
  username: z.string().min(3).max(50),
});

export const portalAsinSubmissionSchema = z.object({
  asin: z.string().min(1, 'ASIN or Amazon link is required').max(1000),
  marketplace: z.enum(MARKETPLACES).default('US'),
  custom_title: z.string().max(500).optional().nullable(),
});

export const portalTrackingSetupSchema = z.object({
  tag: trackingTagSchema,
  label: z.string().max(100).optional().nullable(),
  marketplace: z.enum(MARKETPLACES).default('US'),
});

export const portalTrackingReplaceDeleteSchema = z.object({
  replacement_tracking_id: z.number().int().positive(),
});

export const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().optional().nullable(),
  password: z.string().min(8),
  role: z.enum(['super_admin', 'admin', 'agent']).default('agent'),
  agent_id: z.number().int().positive().optional().nullable(),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional().nullable(),
  password: z.string().min(8).optional(),
  role: z.enum(['super_admin', 'admin', 'agent']).optional(),
  agent_id: z.number().int().positive().optional().nullable(),
  is_active: z.boolean().optional(),
});

export const importAmazonReportSchema = z.object({
  marketplace: z.enum(MARKETPLACES),
  source_file_name: z.string().min(1).max(255),
  csv_content: z.string().min(1, 'Report content is required'),
  report_type: z.string().min(1).max(100).default('tracking_summary'),
  period_start: z.string().optional().nullable(),
  period_end: z.string().optional().nullable(),
});

export const updateSheetSyncConfigSchema = z.object({
  sheet_url: z.string().url().optional().nullable(),
  sheet_tab_name: z.string().min(1).max(200).optional().nullable(),
  default_marketplace: z.enum(MARKETPLACES).default('US'),
  is_active: z.boolean().default(false),
});
