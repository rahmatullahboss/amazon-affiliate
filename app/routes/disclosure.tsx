import type { Route } from "./+types/disclosure";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Affiliate Disclosure | DealsRky" },
    { name: "description", content: "Amazon Affiliate Disclosure for DealsRky" },
  ];
}

export default function AffiliateDisclosure() {
  return (
    <div className="bg-gray-50 min-h-screen py-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-8 text-gray-800 border-b border-gray-100 pb-4">Affiliate Disclosure</h1>
          
          <div className="prose prose-blue max-w-none text-gray-600 text-sm leading-relaxed">
            <div className="p-5 bg-blue-50 border-l-4 border-primary rounded-r mb-8">
              <p className="text-gray-700 italic font-medium m-0">
                "DealsRky is a participant in the Amazon Services LLC Associates Program, an affiliate advertising program designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.com."
              </p>
            </div>

            <h2 className="text-xl font-bold mt-8 mb-4 text-gray-800">Transparency is our priority</h2>
            <p className="mb-4">
              We believe in honest and transparent relationships with our users. When you read our content, 
              product reviews, or deal highlights, you will notice links leading to products on Amazon.
              These are affiliate links.
            </p>

            <h2 className="text-xl font-bold mt-8 mb-4 text-gray-800">What does this mean for you?</h2>
            <p className="mb-4">
              If you click on one of these affiliate links and make a purchase on Amazon within a certain timeframe, 
              we may earn a small commission from that purchase. 
              <strong className="text-gray-800"> This comes at absolutely no additional cost to you.</strong> The price you pay on Amazon is exactly 
              the same whether you use our affiliate link or go directly to Amazon without it.
            </p>

            <h2 className="text-xl font-bold mt-8 mb-4 text-gray-800">Why do we use affiliate links?</h2>
            <p className="mb-4">
              Running and maintaining DealsRky—including our research, content creation, and technical infrastructure—requires resources. 
              The small commissions we earn help support the site and allow us to continue hunting for the best deals for you.
            </p>

            <h2 className="text-xl font-bold mt-8 mb-4 text-gray-800">Our Promise</h2>
            <p className="mb-4">
              While we stand to benefit financially from qualifying purchases, our priority is always to highlight products 
              and deals we believe are genuinely valuable. Our recommendations are not blindly dictated by potential commissions. We select deals based on their merit and value to our audience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
