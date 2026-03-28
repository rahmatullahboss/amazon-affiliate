const badges = [
  { icon: "✅", title: "Amazon Verified", desc: "All products direct from Amazon" },
  { icon: "🔒", title: "Secure Checkout", desc: "Safe Amazon payment protection" },
  { icon: "🚚", title: "Fast Shipping", desc: "Prime & standard delivery options" },
  { icon: "🔄", title: "Easy Returns", desc: "Amazon's hassle-free return policy" },
];

export function TrustBadges() {
  return (
    <section className="bg-gray-900/50 border-y border-gray-800/50 py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {badges.map((badge) => (
            <div key={badge.title} className="flex items-center gap-3 justify-center md:justify-start">
              <span className="text-2xl">{badge.icon}</span>
              <div>
                <div className="text-sm font-semibold text-white">{badge.title}</div>
                <div className="text-xs text-gray-500">{badge.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
