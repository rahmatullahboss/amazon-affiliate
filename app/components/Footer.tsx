import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="w-full">
      {/* Newsletter Bar */}
      <div className="bg-primary py-10 text-white">
         <div className="container mx-auto px-4 !max-w-6xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
               <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
               <div>
                  <h3 className="text-xl font-bold">Sign up to Newsletter</h3>
                  <p className="text-white/80 text-sm">...and receive $20 coupon for first shopping</p>
               </div>
            </div>
            <div className="flex w-full md:max-w-md bg-white rounded overflow-hidden">
               <input type="email" placeholder="Enter your email address" className="w-full px-4 text-black text-sm focus:outline-none" />
               <button className="bg-[#1a1a1a] text-white px-8 font-bold text-sm tracking-wide hover:bg-black transition-colors">Sign Up</button>
            </div>
         </div>
      </div>

      {/* Main Footer Links */}
      <div className="bg-[var(--color-footer-bg)] pt-16 pb-12 text-[#9fa0a1]">
        <div className="container mx-auto px-4 !max-w-6xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Column 1 - Contact */}
          <div>
            <div className="flex items-center gap-2 text-white mb-6">
                 <img src="/dealsrky-logo.png" alt="DealsRky" className="h-8 max-w-full" onError={(e) => {
                   (e.target as HTMLImageElement).style.display = 'none';
                 }} />
            </div>
            <div className="flex items-start gap-4 mb-4 mt-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-primary opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <div>
                <p className="text-xs uppercase tracking-widest text-[#5d6368] mb-1">Got Questions? Call us 24/7!</p>
                <p className="text-[17px] text-white font-bold">(800) 8001-8588, (0600) 874 548</p>
              </div>
            </div>
            <div className="text-sm leading-loose mt-8">
              <p className="font-bold text-white mb-2">Contact Info</p>
              <p>17 Princess Road, London, Greater London NW1 8JR, UK</p>
            </div>
          </div>

          {/* Column 2 - Category */}
          <div>
            <h3 className="text-white text-[15px] uppercase tracking-wider font-bold mb-6">Find In Fast</h3>
            <ul className="space-y-3 text-[14px] flex flex-col">
              <Link to="/category/laptops" className="hover:text-primary transition-colors">Laptops & Computers</Link>
              <Link to="/category/smartphones" className="hover:text-primary transition-colors">Smartphones & Tablets</Link>
              <Link to="/category/tv" className="hover:text-primary transition-colors">TV & Audio</Link>
              <Link to="/category/cameras" className="hover:text-primary transition-colors">Cameras & Photography</Link>
              <Link to="/category/smart-home" className="hover:text-primary transition-colors">Smart Electronics</Link>
              <Link to="/category/gaming" className="hover:text-primary transition-colors">Video Games & Consoles</Link>
            </ul>
          </div>

          {/* Column 3 - Info */}
          <div>
             <h3 className="text-white text-[15px] uppercase tracking-wider font-bold mb-6">Information</h3>
             <ul className="space-y-3 text-[14px] flex flex-col">
              <Link to="/about" className="hover:text-primary transition-colors">About Us</Link>
              <Link to="/disclosure" className="hover:text-primary transition-colors">Affiliate Disclosure</Link>
              <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
              <Link to="/contact" className="hover:text-primary transition-colors">Contact Us</Link>
              <Link to="/" className="hover:text-primary transition-colors">Returns & Exchanges</Link>
            </ul>
          </div>

          {/* Column 4 - Care */}
          <div>
             <h3 className="text-white text-[15px] uppercase tracking-wider font-bold mb-6">Customer Care</h3>
             <ul className="space-y-3 text-[14px] flex flex-col">
              <Link to="/" className="hover:text-primary transition-colors">My Account</Link>
              <Link to="/" className="hover:text-primary transition-colors">Order Tracking</Link>
              <Link to="/" className="hover:text-primary transition-colors">Wish List</Link>
              <Link to="/" className="hover:text-primary transition-colors">Customer Service</Link>
              <Link to="/" className="hover:text-primary transition-colors">FAQs</Link>
            </ul>
          </div>

        </div>
      </div>

      {/* Affiliate Disclosure — REQUIRED by Amazon Associates TOS on EVERY page */}
      <div className="bg-[#151a22] border-t border-gray-800 py-6">
        <div className="container mx-auto px-4 !max-w-6xl">
          <p className="text-[13px] text-[#6d7175] leading-relaxed text-center max-w-4xl mx-auto">
            <strong className="text-[#9fa0a1]">Affiliate Disclosure:</strong> DealsRKY is a participant in the Amazon Services
            LLC Associates Program, an affiliate advertising program designed to provide a means
            for sites to earn advertising fees by advertising and linking to Amazon.com. As an
            Amazon Associate, we earn from qualifying purchases. Product prices and availability
            are subject to change. We encourage you to verify current pricing on Amazon.{" "}
            <Link to="/disclosure" className="text-primary hover:underline font-semibold">Learn more</Link>
          </p>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className="bg-[#12161d] text-[#6d7175] py-6 border-t border-gray-800">
        <div className="container mx-auto px-4 !max-w-6xl flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[13px]">© {new Date().getFullYear()} DealsRKY - All Rights Reserved</p>
          <div className="flex items-center gap-2">
            {/* Fake Payment Icons */}
            <div className="w-10 h-6 bg-white rounded px-1 flex items-center justify-center text-[10px] font-bold text-blue-800">VISA</div>
            <div className="w-10 h-6 bg-white rounded px-1 flex items-center justify-center text-[10px] font-bold text-orange-600">MC</div>
            <div className="w-10 h-6 bg-white rounded px-1 flex items-center justify-center text-[10px] font-bold text-blue-500">PAY</div>
            <div className="w-10 h-6 bg-white rounded px-1 flex items-center justify-center text-[10px] font-bold text-gray-800">APL</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
