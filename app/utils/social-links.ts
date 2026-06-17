export interface PublicSocialLink {
  url: string;
  enabled: boolean;
}

export interface PublicSocialLinks {
  telegram: PublicSocialLink | null;
  whatsapp: PublicSocialLink | null;
  messenger: PublicSocialLink | null;
}

export interface PublicLayoutLoaderData {
  socialLinks: PublicSocialLinks | null;
}

export const EMPTY_PUBLIC_SOCIAL_LINKS: PublicSocialLinks = {
  telegram: null,
  whatsapp: null,
  messenger: null,
};
