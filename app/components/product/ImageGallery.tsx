import { useState } from "react";

interface ImageGalleryProps {
  mainImage: string;
  galleryImages: string[];
  title: string;
}

export function ImageGallery({ mainImage, galleryImages, title }: ImageGalleryProps) {
  const allImages = galleryImages.length > 0 ? galleryImages : [mainImage];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const currentImage = allImages[selectedIndex] || mainImage;

  return (
    <div>
      <div className="rounded-[1.75rem] bg-[#f5f8f8] p-6">
        <img
          src={currentImage}
          alt={title}
          className="mx-auto max-h-[520px] w-full object-contain transition-all duration-300"
          loading="eager"
        />
      </div>

      {allImages.length > 1 ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {allImages.map((img, i) => (
            <button
              key={`thumb-${i}`}
              onClick={() => setSelectedIndex(i)}
              className={`flex-shrink-0 rounded-xl border-2 p-1.5 transition-all duration-200 ${
                i === selectedIndex
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <img
                src={img}
                alt={`${title} - ${i + 1}`}
                className="h-16 w-16 rounded-lg object-contain"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
