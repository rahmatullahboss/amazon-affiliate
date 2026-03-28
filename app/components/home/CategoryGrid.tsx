const categoryEmojis: Record<string, string> = {
  'Air Conditioner': '❄️',
  'Audio & Video': '🎧',
  'Gadgets': '📱',
  'Home Appliances': '🏠',
  'Kitchen': '🍳',
  'Refrigerator': '🧊',
  'PCs & Laptop': '💻',
};

export function CategoryGrid({ categories }: { categories: any[] }) {
  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <section className="py-16 md:py-20">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Shop By Category</h2>
          <p className="text-gray-400 max-w-lg mx-auto">Browse our curated categories to find exactly what you need.</p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <a
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="group relative bg-gray-900/80 border border-gray-800 rounded-2xl p-6 text-center transition-all duration-300 hover:border-orange-500/40 hover:bg-gray-800/60 hover:-translate-y-1 hover:shadow-lg hover:shadow-orange-500/5"
            >
              <span className="text-4xl block mb-3 group-hover:scale-110 transition-transform duration-300">
                {categoryEmojis[cat.name] || '🛍️'}
              </span>
              <h3 className="text-white font-semibold text-sm md:text-base">{cat.name}</h3>
              {cat.product_count > 0 && (
                <span className="text-xs text-gray-500 mt-1 block">{cat.product_count} products</span>
              )}
            </a>
          ))}

          {/* Browse All card */}
          <a
            href="/deals"
            className="group bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-2xl p-6 text-center transition-all duration-300 hover:border-orange-500/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-orange-500/10"
          >
            <span className="text-4xl block mb-3 group-hover:scale-110 transition-transform duration-300">🔥</span>
            <h3 className="text-orange-400 font-semibold text-sm md:text-base">View All Deals</h3>
            <span className="text-xs text-gray-500 mt-1 block">Browse everything</span>
          </a>
        </div>
      </div>
    </section>
  );
}
