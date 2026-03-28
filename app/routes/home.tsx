import type { Route } from "./+types/home";
import { Link } from "react-router";
import { ProductCard } from "../components/home/ProductCard";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "DealsRky — Your Trusted Shopping Companion" },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  
  // Minimal query for featured items
  const products = await env.DB.prepare(`
    SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC LIMIT 12
  `).all();

  return { products: products.results || [] };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const data = loaderData as { products: any[] };

  // Split products for different sections visually
  const trending = data.products.slice(0, 6);
  const appliances = data.products.slice(6, 12);
  

  return (
    <div className="bg-white min-h-screen">
      
      {/* 1. Hero Section (Categories + Banner) */}
      <section className="bg-white py-4 md:py-8">
         <div className="container mx-auto px-4 !max-w-[1280px]">
           <div className="flex flex-col md:flex-row gap-6">
             {/* Left Column: Vertical Categories Menu (Hidden on Mobile, Visible on Desktop) */}
             <div className="hidden md:block w-full md:w-[270px] shrink-0">
               <div className="bg-white border-2 border-primary rounded-xl overflow-hidden shadow-sm h-full">
                 <div className="bg-primary text-white font-bold p-4 flex items-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                   All Departments
                 </div>
                 <ul className="flex flex-col py-2">
                   {[
                     { n: 'Value of the Day', i: '⭐', t: '/category/value-of-the-day' },
                     { n: 'Top 100 Offers', i: '🔥', t: '/category/top-offers' },
                     { n: 'New Arrivals', i: '✨', t: '/category/new-arrivals' },
                     { n: 'TV & Audio', i: '📺', t: '/category/tv-audio' },
                     { n: 'Laptops & Computers', i: '💻', t: '/category/laptops' },
                     { n: 'Smartphones & Tablets', i: '📱', t: '/category/smartphones' },
                     { n: 'Cameras & Drones', i: '📷', t: '/category/cameras' },
                     { n: 'Smart Home', i: '🏠', t: '/category/smart-home' },
                     { n: 'Video Games', i: '🎮', t: '/category/gaming' },
                   ].map((cat, i) => (
                     <li key={i}>
                       <Link to={cat.t} className="flex items-center gap-3 px-5 py-2.5 text-sm text-gray-700 hover:text-primary hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 font-medium">
                         <span className="text-gray-400 opacity-80">{cat.i}</span>
                         {cat.n}
                       </Link>
                     </li>
                   ))}
                 </ul>
               </div>
             </div>

             {/* Right Column: Hero Banner Slider */}
             <div className="flex-1 w-full">
               <div className="relative h-[300px] md:h-full min-h-[420px] w-full flex items-center justify-end bg-gradient-to-r from-[#eceeef] to-[#d8dada] overflow-hidden rounded-xl shadow-sm">
                 {/* Background Image Placeholder */}
                 <div className="absolute inset-0 z-0 flex items-center pl-[10%]">
                   <div className="w-full md:w-2/3 h-full bg-[url('https://images.unsplash.com/photo-1593305841991-05c297ba4575?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center mix-blend-multiply opacity-50"></div>
                 </div>
                 
                 {/* Text Box Overlay */}
                 <div className="relative z-10 bg-white/95 p-6 md:p-10 m-4 md:mr-10 xl:mr-16 max-w-sm rounded-xl shadow-lg backdrop-blur-sm transform transition-transform hover:-translate-y-1">
                    <span className="text-primary text-sm uppercase font-extrabold tracking-widest block mb-2">HOT TRENDING</span>
                    <h2 className="text-3xl md:text-5xl font-light text-gray-800 leading-tight mb-4">
                      The best home <br/> <strong className="font-extrabold text-gray-800">entertainment</strong> <br/> system
                    </h2>
                    <p className="text-gray-500 text-sm mb-6 max-w-xs leading-relaxed">
                      Upgrade your living room with premium 4k displays and immersive surround sound systems today.
                    </p>
                    <Link to="/category/tv-audio" className="text-white bg-primary font-bold px-8 py-3.5 rounded-full text-sm inline-block hover:bg-primary-hover shadow-md hover:shadow-lg transition-all">
                      Start Buying
                    </Link>
                 </div>
                 
                 {/* Mock Slider Pagination Dots */}
                 <div className="absolute bottom-4 left-0 w-full flex justify-center gap-2 z-10">
                   <span className="w-2.5 h-2.5 rounded-full bg-primary cursor-pointer"></span>
                   <span className="w-2.5 h-2.5 rounded-full bg-gray-400 bg-opacity-50 cursor-pointer hover:bg-opacity-100 transition-colors"></span>
                   <span className="w-2.5 h-2.5 rounded-full bg-gray-400 bg-opacity-50 cursor-pointer hover:bg-opacity-100 transition-colors"></span>
                 </div>
               </div>
             </div>
           </div>
         </div>
      </section>

      {/* 2. Features Bar (Free Delivery etc) */}
      <section className="border-b border-gray-100">
         <div className="container mx-auto px-4 !max-w-[1280px]">
           <div className="flex flex-wrap justify-between items-center py-6 gap-4">
             {[
               { icon: "🚐", title: "Free Delivery", desc: "from $50" },
               { icon: "🛡️", title: "99% Customer", desc: "Feedbacks" },
               { icon: "↩️", title: "365 Days", desc: "for free return" },
               { icon: "💳", title: "Payment", desc: "Secure System" },
               { icon: "🏆", title: "Only Best", desc: "Brands" },
             ].map((feat, i) => (
                <div key={i} className="flex items-center gap-3">
                   <span className="text-3xl grayscale opacity-70">{feat.icon}</span>
                   <div>
                     <strong className="block text-sm text-gray-800 leading-none mb-1">{feat.title}</strong>
                     <span className="text-xs text-gray-500">{feat.desc}</span>
                   </div>
                </div>
             ))}
           </div>
         </div>
      </section>

      {/* 3. Most Popular Categories */}
      <section className="py-12 border-b border-gray-100 bg-[#f9f9f9]/50">
        <div className="container mx-auto px-4 !max-w-[1280px]">
          <h2 className="text-xl font-bold text-gray-800 mb-8 border-b border-gray-200 pb-3">Popular Categories</h2>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {[
              { n: 'TV & Audio', i: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=200&h=200&fit=crop' },
              { n: 'Laptops', i: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=200&h=200&fit=crop' },
              { n: 'Smartphones', i: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200&h=200&fit=crop' },
              { n: 'Cameras', i: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200&h=200&fit=crop' },
              { n: 'Accessories', i: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=200&h=200&fit=crop' },
              { n: 'Video Games', i: 'https://images.unsplash.com/photo-1486401899868-0e435ed85128?w=200&h=200&fit=crop' },
              { n: 'Smart Home', i: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=200&h=200&fit=crop' },
              { n: 'Tablets', i: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=200&h=200&fit=crop' },
            ].map((cat, i) => (
               <Link to={`/category/${cat.n.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`} key={i} className="flex flex-col items-center group cursor-pointer block">
                  <div className="w-28 h-28 rounded-full overflow-hidden bg-white shadow-sm border border-gray-100 flex items-center justify-center p-2 mb-3 group-hover:shadow-md transition-shadow">
                    <img src={cat.i} alt={cat.n} className="w-full h-full object-cover rounded-full group-hover:scale-110 transition-transform duration-500"/>
                  </div>
                  <span className="text-sm font-semibold text-gray-800 group-hover:text-primary transition-colors">{cat.n}</span>
               </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Two Promo Banners */}
      <section className="py-10">
         <div className="container mx-auto px-4 !max-w-[1280px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-[#121212] aspect-[21/9] rounded flex items-center justify-between p-8 relative overflow-hidden group cursor-pointer">
                  <div className="z-10 relative">
                     <span className="text-primary block mb-2 text-sm font-bold uppercase tracking-wider">Catch the sound</span>
                     <h3 className="text-white text-3xl font-extrabold mb-4 leading-none">MacBook <br/><span className="font-light">Air</span></h3>
                     <span className="text-white underline text-sm font-semibold hover:text-primary">Shop now</span>
                  </div>
                  <div className="absolute right-0 top-0 h-full w-1/2 bg-[url('https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80')] bg-cover bg-center mix-blend-luminosity opacity-40 group-hover:opacity-60 transition-opacity"></div>
               </div>
               <div className="bg-[#0b1b36] aspect-[21/9] rounded flex items-center justify-between p-8 relative overflow-hidden group cursor-pointer">
                  <div className="z-10 relative">
                     <span className="text-[#e74c3c] block mb-2 text-sm font-bold uppercase tracking-wider">Accessories</span>
                     <h3 className="text-white text-3xl font-extrabold mb-4 leading-none">Gaming <br/><span className="font-light">Gear</span></h3>
                     <span className="text-white underline text-sm font-semibold hover:text-[#e74c3c]">Shop now</span>
                  </div>
                  <div className="absolute right-0 top-0 h-full w-1/2 bg-[url('https://images.unsplash.com/photo-1605810230434-7631ac76ec81?auto=format&fit=crop&w=600&q=80')] bg-cover bg-center mix-blend-luminosity opacity-40 group-hover:opacity-60 transition-opacity"></div>
               </div>
            </div>
         </div>
      </section>

      {/* 5. Trending Deals Row */}
      <section className="py-8">
        <div className="container mx-auto px-4 !max-w-[1280px]">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-6">
             <h2 className="text-xl font-bold text-gray-800">Trending deals</h2>
             <ul className="hidden md:flex gap-6 text-sm font-bold text-gray-500">
                <li className="text-primary cursor-pointer">TV & Audio</li>
                <li className="hover:text-primary cursor-pointer">Cameras</li>
                <li className="hover:text-primary cursor-pointer">Audio</li>
                <li className="hover:text-primary cursor-pointer">Smartphones</li>
             </ul>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 border-l border-t border-gray-100">
            {trending.length > 0 ? (
               trending.map((p: any) => (
                  <div className="border-r border-b border-gray-100" key={p.id}>
                    <ProductCard item={p} />
                  </div>
               ))
            ) : (
               [...Array(6)].map((_, i) => (
                 <div key={i} className="border-r border-b border-gray-100 p-4 min-h-[300px] flex flex-col justify-center items-center bg-gray-50/50">
                    <span className="text-gray-300 text-3xl mb-2">📦</span>
                    <span className="text-xs text-gray-400">Empty</span>
                 </div>
               ))
            )}
          </div>
        </div>
      </section>

      {/* 6. Blue Promo Banner Row (Get 15% back) */}
      <section className="py-4">
        <div className="container mx-auto px-4 !max-w-[1280px]">
          <div className="w-full bg-blue-600 rounded-lg p-6 flex flex-col md:flex-row items-center justify-between text-white shadow-sm overflow-hidden relative">
             <div className="flex items-center gap-6 z-10">
                <div className="w-16 h-16 bg-white/20 rounded-full flex justify-center items-center">
                   <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div>
                   <h3 className="text-2xl font-bold">Get 15% back</h3>
                   <p className="text-blue-100">on select cameras to build your ideal system</p>
                </div>
             </div>
             <button className="bg-white text-blue-600 font-bold px-8 py-3 rounded-full mt-4 md:mt-0 z-10 hover:bg-gray-50 transition-colors">
                Shop now
             </button>
             {/* Abstract background shapes */}
             <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-blue-500 to-transparent"></div>
          </div>
        </div>
      </section>

      {/* 7. Home Appliances Row */}
      <section className="py-8">
        <div className="container mx-auto px-4 !max-w-[1280px]">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-6">
             <h2 className="text-xl font-bold text-gray-800">Home Appliances</h2>
             <Link to="/category/home-appliances" className="text-sm font-bold text-primary hover:underline">View all</Link>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 border-l border-t border-gray-100">
            {appliances.length > 0 ? (
               appliances.map((p: any) => (
                  <div className="border-r border-b border-gray-100" key={p.id}>
                    <ProductCard item={p} />
                  </div>
               ))
            ) : (
               [...Array(6)].map((_, i) => (
                 <div key={i} className="border-r border-b border-gray-100 p-4 min-h-[300px] flex flex-col justify-center items-center bg-gray-50/50">
                    <span className="text-gray-300 text-3xl mb-2">📦</span>
                    <span className="text-xs text-gray-400">Empty</span>
                 </div>
               ))
            )}
          </div>
        </div>
      </section>

    </div>
  );
}
