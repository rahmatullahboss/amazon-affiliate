export function HeroBanner() {
  return (
    <section className="bg-white border-b border-gray-200 overflow-hidden relative">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row items-center py-12 md:py-20 px-4 md:px-10 gap-10">
          
          {/* Text Content */}
          <div className="w-full md:w-1/2 text-center md:text-left z-10">
            <div className="inline-block bg-[#2c9cb4]/10 text-[#2c9cb4] font-semibold px-3 py-1 rounded mb-6 text-sm">
              Today's Featured Deals
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-[#333333] mb-6 leading-tight">
              Upgrade Your Home With The Best <span className="text-[#2c9cb4]">Amazon Deals</span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto md:mx-0 leading-relaxed">
              We hunt down the biggest discounts on top-rated electronics, gadgets, and home appliances so you never pay full price again.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start">
              <a 
                href="/deals" 
                className="bg-[#2c9cb4] hover:bg-[#248196] text-white font-bold py-4 px-10 rounded-full shadow-lg shadow-[#2c9cb4]/30 transition-all text-lg w-full sm:w-auto text-center"
              >
                Shop Now Collection
              </a>
              <a 
                href="/about" 
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-4 px-10 rounded-full transition-all text-lg w-full sm:w-auto text-center"
              >
                Learn More
              </a>
            </div>
          </div>

          {/* Right Image/Graphic area */}
          <div className="w-full md:w-1/2 relative">
             <div className="aspect-[4/3] bg-gray-50 rounded-2xl border border-gray-100 shadow-xl overflow-hidden relative flex items-center justify-center">
                 {/* Placeholder for a lifestyle/product collage image that DealsRky uses */}
                 <div className="absolute inset-0 bg-gradient-to-tr from-[#2c9cb4]/20 to-transparent"></div>
                 <div className="text-center p-8 bg-white/80 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm z-10">
                    <span className="text-5xl mb-4 block">📦</span>
                    <h3 className="text-xl font-bold text-gray-800">Fresh Deals Uploaded Daily</h3>
                    <p className="text-gray-600 text-sm mt-2">Check back often for flash sales</p>
                 </div>
             </div>
          </div>

        </div>
      </div>
    </section>
  );
}
