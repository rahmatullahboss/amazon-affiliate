-- Update blog posts with the newly generated WebP cover images

UPDATE blog_posts 
SET cover_image_key = 'blog-covers/smart_home_2026.webp' 
WHERE slug = 'building-a-smart-home-2026-guide';

UPDATE blog_posts 
SET cover_image_key = 'blog-covers/wfh_cable_management.webp' 
WHERE slug = 'ultimate-wfh-setup-cable-management';

UPDATE blog_posts 
SET cover_image_key = 'blog-covers/portable_ac.webp' 
WHERE slug = 'how-to-choose-a-portable-air-conditioner';

UPDATE blog_posts 
SET cover_image_key = 'blog-covers/usbc_hub.webp' 
WHERE slug = 'usb-c-hub-buying-guide-work-desk';

UPDATE blog_posts 
SET cover_image_key = 'blog-covers/smart_speaker.webp' 
WHERE slug = 'smart-speaker-routines-that-save-time';

UPDATE blog_posts 
SET cover_image_key = 'blog-covers/kitchen_upgrades.webp' 
WHERE slug = 'small-kitchen-upgrades-meal-prep';

UPDATE blog_posts 
SET cover_image_key = 'blog-covers/surge_protector.webp' 
WHERE slug = 'surge-protector-guide-for-expensive-electronics';

UPDATE blog_posts 
SET cover_image_key = 'blog-covers/fridge_org.webp' 
WHERE slug = 'refrigerator-organization-tools-that-help';

UPDATE blog_posts 
SET cover_image_key = 'blog-covers/home_audio.webp' 
WHERE slug = 'clean-home-audio-setup-guide';

UPDATE blog_posts 
SET cover_image_key = 'blog-covers/wfh_accessories.webp' 
WHERE slug = 'wfh-accessories-that-reduce-friction';
