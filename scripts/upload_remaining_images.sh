#!/bin/bash
set -e

# ID 13
npx wrangler r2 object put "dealsrky-blog-images/blog-covers/period_pants.png" --file="/Users/rahmatullahzisan/.gemini/antigravity/brain/34ae9952-4df1-4e00-be66-2060fc105a85/period_pants_review_1775521798800.png" --remote

# ID 14
npx wrangler r2 object put "dealsrky-blog-images/blog-covers/ipad_privacy.png" --file="/Users/rahmatullahzisan/.gemini/antigravity/brain/34ae9952-4df1-4e00-be66-2060fc105a85/ipad_privacy_protector_1775521816871.png" --remote

# ID 15
npx wrangler r2 object put "dealsrky-blog-images/blog-covers/garmin_strap.png" --file="/Users/rahmatullahzisan/.gemini/antigravity/brain/34ae9952-4df1-4e00-be66-2060fc105a85/garmin_nylon_strap_1775521836066.png" --remote

# ID 16
npx wrangler r2 object put "dealsrky-blog-images/blog-covers/detox_tea.png" --file="/Users/rahmatullahzisan/.gemini/antigravity/brain/34ae9952-4df1-4e00-be66-2060fc105a85/detox_tea_1775521863733.png" --remote

# ID 17
npx wrangler r2 object put "dealsrky-blog-images/blog-covers/infrared_glove.png" --file="/Users/rahmatullahzisan/.gemini/antigravity/brain/34ae9952-4df1-4e00-be66-2060fc105a85/infrared_hand_glove_1775521881111.png" --remote

# ID 18
npx wrangler r2 object put "dealsrky-blog-images/blog-covers/knee_massager.png" --file="/Users/rahmatullahzisan/.gemini/antigravity/brain/34ae9952-4df1-4e00-be66-2060fc105a85/knee_massager_1775521897991.png" --remote

# ID 19
npx wrangler r2 object put "dealsrky-blog-images/blog-covers/garden_deterrent.png" --file="/Users/rahmatullahzisan/.gemini/antigravity/brain/34ae9952-4df1-4e00-be66-2060fc105a85/garden_deterrent_1775521917394.png" --remote

echo "Uploads to R2 complete."
