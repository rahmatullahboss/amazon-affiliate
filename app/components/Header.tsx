import { Form, Link, useLocation } from "react-router";

export function Header() {
  const location = useLocation();

  return (
    <header className="w-full">
      {/* 1. Top Bar - Darker Teal */}
      <div className="bg-[#086666] text-white py-2 text-xs">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex gap-4 items-center">
            <span>Contact us 24/7 : <strong>+120 7425 2109</strong></span>
          </div>
          <div className="flex gap-4 items-center text-white/80">
            <Link to="/about" className="hover:text-white transition-colors">FAQ</Link>
            <Link to="/contact" className="hover:text-white transition-colors">Help</Link>
            <div className="flex items-center gap-1 cursor-pointer hover:text-white">
              <span className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 text-[10px] font-bold">€</span>
              EN
            </div>
            <div className="cursor-pointer hover:text-white">USD</div>
          </div>
        </div>
      </div>

      {/* 2. Main Search Bar - Primary Teal */}
      <div className="bg-primary py-5">
        <div className="container mx-auto px-4 flex justify-between items-center gap-6">
          {/* Logo */}
          <Link to="/" className="shrink-0 flex items-center gap-2">
            <img src="/dealsrky-logo.png" alt="DealsRky" className="h-9" onError={(e) => {
              (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 30'%3E%3Ctext y='20' fill='white' font-family='sans-serif' font-weight='bold' font-size='20'%3EDealsRky%3C/text%3E%3C/svg%3E";
            }} />
          </Link>

          {/* Centered Search Box */}
          <div className="flex-1 max-w-2xl hidden md:flex">
             <Form action="/deals" method="GET" className="flex w-full bg-white rounded-md overflow-hidden h-11 shadow-sm border border-transparent focus-within:border-accent">
                <div className="flex items-center px-4 bg-gray-50 border-r border-gray-200 text-gray-700 text-sm cursor-pointer whitespace-nowrap hidden sm:flex font-semibold">
                  All <svg className="w-3 h-3 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
                <input 
                  type="text" 
                  name="q"
                  placeholder="I'm shopping for..." 
                  className="w-full px-4 text-sm text-gray-800 focus:outline-none"
                />
                <button type="submit" className="bg-[#1a1a1a] text-white px-8 font-semibold hover:bg-black transition-colors">
                  Search
                </button>
             </Form>
          </div>

          {/* Right Icons */}
          <div className="flex items-center gap-7 text-white">
             {/* Compare */}
             <div className="hidden lg:flex flex-col items-center gap-1 cursor-pointer">
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12H3"/><path d="M12 21V3"/></svg>
                  <span className="absolute -top-1.5 -right-1.5 bg-accent text-black text-[10px] w-[18px] h-[18px] flex items-center justify-center rounded-full font-bold">0</span>
                </div>
             </div>
             {/* Heart/Wishlist */}
             <div className="hidden lg:flex flex-col items-center gap-1 cursor-pointer">
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                  <span className="absolute -top-1.5 -right-1.5 bg-accent text-black text-[10px] w-[18px] h-[18px] flex items-center justify-center rounded-full font-bold">0</span>
                </div>
             </div>
             {/* Account */}
             <div className="flex flex-col items-center gap-1 cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
             </div>
             {/* Cart - Total */}
             <div className="flex items-center gap-3 bg-primary-hover px-4 py-2 rounded-full cursor-pointer hover:bg-black/20 transition-colors">
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                  <span className="absolute -top-1.5 -right-1.5 bg-accent text-black text-[10px] w-[18px] h-[18px] flex items-center justify-center rounded-full font-bold">0</span>
                </div>
                <div className="flex flex-col text-[15px] font-extrabold leading-none hidden sm:flex">
                   <span>$0.00</span>
                </div>
             </div>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="container mx-auto px-4 mt-3 md:hidden">
            <Form action="/deals" method="GET" className="flex w-full bg-white rounded overflow-hidden shadow h-11">
                <input 
                  type="text" 
                  name="q"
                  placeholder="I'm shopping for..." 
                  className="w-full px-4 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button type="submit" className="bg-[#1a1a1a] text-white px-5 hover:bg-black">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </button>
             </Form>
        </div>
      </div>

      {/* 3. Navigation Bar (White Background with Teal block for Categories) */}
      <div className="bg-white border-b border-gray-200 hidden lg:block shadow-sm">
        <div className="container mx-auto px-4 flex justify-between items-center h-14">
          
          <div className="flex items-center h-full gap-8">
            {/* Depts Box */}
            <div className="bg-primary text-white h-full flex items-center px-5 cursor-pointer gap-3 font-extrabold uppercase tracking-wide text-sm w-[240px] hover:bg-primary-hover transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
               Browse Categories
            </div>

            {/* Nav Links */}
            <nav className="flex gap-7 h-full items-center">
              {[
                { name: 'Home', path: '/' },
                { name: 'Deals', path: '/deals' },
                { name: 'Products', path: '/#products' },
                { name: 'Pages', path: '/about' },
                { name: 'Blog', path: '/category/blog' },
              ].map((link) => (
                <Link 
                  key={link.name} 
                  to={link.path} 
                  className={`font-bold text-gray-800 hover:text-primary text-[15px] flex items-center gap-1 transition-colors ${location.pathname === link.path ? 'text-primary' : ''}`}
                >
                  {link.name}
                  {['Pages', 'Blog'].includes(link.name) && (
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="m6 9 6 6 6-6"/></svg>
                  )}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 font-bold text-[15px] text-gray-800">
             <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" className="text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
             Free Shipping on Orders $50+
          </div>
        </div>
      </div>
    </header>
  );
}
