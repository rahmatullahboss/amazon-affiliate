import type { Route } from "./+types/contact";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Contact Us | DealsRky" },
    { name: "description", content: "Get in touch with the DealsRky team." },
  ];
}

export default function Contact() {
  return (
    <div className="bg-gray-50 min-h-screen py-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
           <h1 className="text-3xl md:text-5xl font-black text-gray-800 mb-4">Contact <span className="text-primary">Us</span></h1>
           <p className="text-lg text-gray-600 max-w-2xl mx-auto">
             Have a question about a deal, need help navigating the site, or want to suggest a product? We'd love to hear from you.
           </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Contact Info */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-8 text-gray-800 border-b border-gray-100 pb-4">Contact Information</h2>
            
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="mt-1 w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </div>
                <div>
                  <h3 className="text-gray-800 font-bold mb-1">Email Support</h3>
                  <a href="mailto:support@dealsrky.com" className="text-primary hover:text-primary-hover transition-colors font-medium">
                    support@dealsrky.com
                  </a>
                  <p className="text-gray-500 text-xs mt-2 leading-relaxed">Our team usually responds within 24 business hours.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="mt-1 w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <div>
                  <h3 className="text-gray-800 font-bold mb-1">Phone Enquiries</h3>
                  <a href="tel:+1234567890" className="text-primary hover:text-primary-hover transition-colors font-medium">
                    +1 (234) 567-890
                  </a>
                  <p className="text-gray-500 text-xs mt-2 leading-relaxed">Available Monday - Friday, 9:00 AM to 5:00 PM EST.</p>
                </div>
              </div>
            </div>
            
            <div className="mt-10 bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r">
               <h3 className="text-orange-800 font-bold mb-1 text-sm">Order Support Notice</h3>
               <p className="text-xs text-orange-700 leading-relaxed">
                 For questions regarding specific orders placed on Amazon, tracking information, or returns, please contact Amazon Customer Service directly, as we do not fulfill or process the orders shown on our site.
               </p>
            </div>
          </div>
          
          {/* Contact Form */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b border-gray-100 pb-4">Send a Message</h2>
            
            <form className="space-y-5" action="mailto:support@dealsrky.com" method="POST" encType="text/plain">
              <div>
                <label htmlFor="name" className="block text-sm font-bold text-gray-700 mb-1.5">Full Name</label>
                <input 
                  type="text" 
                  id="name" 
                  name="name"
                  className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="Your Name"
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-1.5">Email Address</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email"
                  className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="name@company.com"
                />
              </div>
              
              <div>
                <label htmlFor="message" className="block text-sm font-bold text-gray-700 mb-1.5">Message</label>
                <textarea 
                  id="message" 
                  name="message"
                  rows={5}
                  className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                  placeholder="How can we help you today?"
                ></textarea>
              </div>
              
              <button 
                type="submit"
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 rounded-md transition-colors mt-2 shadow-sm"
              >
                Send Message
              </button>
            </form>
          </div>
          
        </div>
      </div>
    </div>
  );
}
