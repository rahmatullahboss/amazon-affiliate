#!/bin/bash
BRAIN_DIR="$HOME/.gemini/antigravity/brain/34ae9952-4df1-4e00-be66-2060fc105a85"
BUCKET="dealsrky-blog-images"

for file in "$BRAIN_DIR"/*.webp; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    echo "Uploading $filename to $BUCKET/blog-covers/$filename..."
    npx wrangler r2 object put "$BUCKET/blog-covers/$filename" --file="$file" --content-type="image/webp" --remote
  fi
done
