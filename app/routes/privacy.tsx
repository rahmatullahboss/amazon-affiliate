import type { Route } from "./+types/privacy";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Privacy Policy | DealsRky" },
    { name: "description", content: "Privacy Policy for DealsRky" },
  ];
}

export default function PrivacyPolicy() {
  return (
    <div className="bg-gray-50 min-h-screen py-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-8 text-gray-800 border-b border-gray-100 pb-4">Privacy Policy</h1>
          
          <div className="prose prose-blue max-w-none text-gray-600 text-sm leading-relaxed">
            <p className="mb-6 font-medium text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>
            
            <h2 className="text-xl font-bold mt-8 mb-4 text-gray-800">1. Information We Collect</h2>
            <p className="mb-4">
              DealsRky is committed to protecting your privacy. We collect minimal information necessary to provide our services. 
              When you visit our site, we may automatically collect certain technical information, such as your IP address, 
              browser type, and basic analytics data to understand how users interact with our site.
            </p>

            <h2 className="text-xl font-bold mt-8 mb-4 text-gray-800">2. Cookies and Tracking</h2>
            <p className="mb-4">
              We use cookies and similar tracking technologies to track the activity on our Service.
              This may include third-party cookies from our analytics providers or affiliate partners (like Amazon).
              These cookies help us understand user behavior and properly attribute affiliate sales.
            </p>

            <h2 className="text-xl font-bold mt-8 mb-4 text-gray-800">3. Third-Party Links</h2>
            <p className="mb-4">
              Our website contains links to other sites, specifically Amazon.com. If you click on a third-party link, 
              you will be directed to that site. We strongly advise you to review the Privacy Policy of every site you visit. 
              We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party sites or services.
            </p>

            <h2 className="text-xl font-bold mt-8 mb-4 text-gray-800">4. Amazon Associate Program</h2>
            <p className="mb-4">
               As an Amazon Associate, DealsRky earns from qualifying purchases. Amazon may use cookies to track your clicks and purchases 
               originating from our site in order to credit us with a commission.
            </p>
            
            <h2 className="text-xl font-bold mt-8 mb-4 text-gray-800">5. Contact Us</h2>
            <p className="mb-4">
              If you have any questions about this Privacy Policy, please contact us at support@dealsrky.com.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
