import type { Route } from "./+types/about";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "About Us | DealsRky" },
    { name: "description", content: "Learn more about DealsRky and our mission to find you the best deals." },
  ];
}

export default function About() {
  return (
    <div className="bg-gray-50 min-h-screen py-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-8 md:p-12">
          
          <div className="text-center mb-12 border-b border-gray-100 pb-8">
             <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">🛒</div>
             <h1 className="text-3xl md:text-5xl font-black text-gray-800 mb-4">About <span className="text-primary">DealsRKY</span></h1>
             <p className="text-lg text-gray-600 max-w-2xl mx-auto">
               Your trusted destination for navigating the vast landscape of online shopping and discovering the most valuable deals available on Amazon.
             </p>
          </div>
          
          <div className="prose prose-blue max-w-none text-gray-600 text-sm md:text-base leading-relaxed">
            <h2 className="text-2xl font-bold text-gray-800 mt-0 mb-4 tracking-tight">Our Mission</h2>
            <p className="mb-8">
              In today's fast-paced digital marketplace, finding genuine quality and true value can be overwhelming. 
              Our mission is simple: to sift through the noise and highlight products that offer reliable performance and excellent value for your money.
            </p>

            <h2 className="text-2xl font-bold text-gray-800 mt-10 mb-4 tracking-tight">What We Do</h2>
            <p className="mb-8">
              Our team constantly monitors market trends, uncovers top-rated products, and curates selections that meet our standards. 
              Whether you are looking to upgrade your home theater, find the latest kitchen appliance, or snag a deal on wireless audio, 
              DealsRky is here to point you in the right direction. We do the heavy lifting of price tracking and review aggregate analysis so you don't have to.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12 not-prose">
              <div className="bg-gray-50 border border-gray-100 p-6 rounded-lg text-center shadow-sm">
                <div className="w-12 h-12 bg-white border border-gray-200 text-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <h3 className="text-gray-800 font-bold mb-2 text-sm">Curated Selection</h3>
                <p className="text-gray-500 text-xs leading-relaxed">We handpick deals across various categories so you don't have to wade through questionable brands.</p>
              </div>
              
              <div className="bg-gray-50 border border-gray-100 p-6 rounded-lg text-center shadow-sm">
                <div className="w-12 h-12 bg-white border border-gray-200 text-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                </div>
                <h3 className="text-gray-800 font-bold mb-2 text-sm">Trusted Links</h3>
                <p className="text-gray-500 text-xs leading-relaxed">We direct you safely to verified Amazon product listings, bypassing scam sites and fake sellers.</p>
              </div>
              
              <div className="bg-gray-50 border border-gray-100 p-6 rounded-lg text-center shadow-sm">
                <div className="w-12 h-12 bg-white border border-gray-200 text-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                </div>
                <h3 className="text-gray-800 font-bold mb-2 text-sm">Full Transparency</h3>
                <p className="text-gray-500 text-xs leading-relaxed">We are upfront about our <Link to="/disclosure" className="text-primary hover:underline font-medium">affiliate relationships</Link> and data practices.</p>
              </div>
            </div>

            <p className="mt-8 font-medium text-gray-800 text-center text-lg bg-primary/5 py-6 px-4 rounded-lg">
              Thank you for trusting DealsRky. We continually strive to be your go-to resource for honest recommendations and great finds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
