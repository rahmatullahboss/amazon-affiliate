import type { Route } from "./+types/help";
import { useState } from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Help Center | DealsRky Admin" },
    { name: "description", content: "Admin Help Center and Documentation" },
  ];
}

export default function AdminHelpCenter() {
  const [activeSection, setActiveSection] = useState("dashboard");

  const sections = [
    { id: "dashboard", title: "ড্যাশবোর্ড (Dashboard)", icon: "📊" },
    { id: "users", title: "ইউজার ম্যানেজমেন্ট", icon: "🧑‍💼" },
    { id: "agents", title: "এজেন্ট (AI Config)", icon: "👥" },
    { id: "products", title: "প্রোডাক্টস (Products)", icon: "📦" },
    { id: "sheet-control", title: "শীট কন্ট্রোল (Sheet Sync)", icon: "🗂️" },
    { id: "reviews", title: "রিভিউ ও সাবমিশন", icon: "🛂" },
    { id: "tracking", title: "ট্র্যাকিং আইডি", icon: "🏷️" },
    { id: "mappings", title: "ক্যাটাগরি ম্যাপিং", icon: "🔗" },
    { id: "blogs", title: "ব্লগ ও এডিটোরিয়াল", icon: "📝" },
    { id: "analytics", title: "অ্যানালিটিক্স ও রিপোর্ট", icon: "📈" },
    { id: "audit-logs", title: "অডিট লগস", icon: "🧾" },
  ];

  return (
    <div className="flex h-[calc(100vh-6rem)] overflow-hidden rounded-xl border border-white/5 bg-[#12121a]">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-white/5 bg-[#0a0a0f] flex flex-col h-full overflow-y-auto">
        <div className="p-4 border-b border-white/5 sticky top-0 bg-[#0a0a0f] z-10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>❓</span> হেল্প সেন্টার
          </h2>
          <p className="text-xs text-gray-400 mt-1">গাইডলাইন এবং ডকুমেন্টেশন</p>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {sections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left w-full
                ${
                  activeSection === sec.id
                    ? "bg-[#ff9900]/10 text-[#ff9900]"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }
              `}
            >
              <span className="text-base">{sec.icon}</span>
              <span className="flex-1 truncate">{sec.title}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto bg-[#12121a]">
        <div className="max-w-3xl mx-auto space-y-8 pb-12">
          
          {/* Dashboard */}
          {activeSection === "dashboard" && (
            <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="text-3xl font-bold text-white mb-4">ড্যাশবোর্ড (Dashboard)</h1>
              <div className="prose prose-invert prose-orange max-w-none">
                <p className="text-gray-300">
                  ড্যাশবোর্ড হল সিস্টেমের মূল পাতা। এখানে আপনি আপনার প্রজেক্টের বর্তমান অবস্থা, মোট ভিজিটর, মোট ক্লিক, এবং রিসেন্ট কিছু এক্টিভিটি দেখতে পারবেন।
                </p>
                <div className="bg-white/5 border border-white/10 rounded-lg p-5 mt-6">
                  <h3 className="text-white text-lg font-semibold mb-2">মূল ফিচারসমূহ:</h3>
                  <ul className="list-disc pl-5 text-gray-300 space-y-2">
                    <li><strong>Overview Cards:</strong> মোট প্রোডাক্ট, ব্লগ, ট্রাফিক এবং ক্লিকের সংখ্যা।</li>
                    <li><strong>Quick Actions:</strong> নতুন প্রোডাক্ট যুক্ত করা বা ব্লগে যাওয়ার শর্টকাট।</li>
                    <li><strong>Recent Logs:</strong> সম্প্রতি সিস্টেম কে ব্যবহার করেছে বা কী আপডেট হয়েছে তার চার্ট বা লিস্ট।</li>
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* Users */}
          {activeSection === "users" && (
            <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="text-3xl font-bold text-white mb-4">ইউজার ম্যানেজমেন্ট</h1>
              <div className="prose prose-invert prose-orange max-w-none">
                <p className="text-gray-300">
                  সিস্টেমের কারা ব্যবহার করতে পারবে এবং কার কি ধরনের এক্সেস থাকবে, তা এখান থেকে নির্ধারণ করা হয়।
                </p>
                <div className="bg-white/5 border border-white/10 rounded-lg p-5 mt-6 space-y-4">
                  <div>
                    <h3 className="text-white font-semibold">User Role (রোল)</h3>
                    <p className="text-gray-400 text-sm mt-1">
                      <strong>Admin/Super Admin:</strong> সব মেনু এবং সেটিংসে পূর্ণ এক্সেস আছে।<br/>
                      <strong>Editor:</strong> শুধুমাত্র প্রোডাক্ট এবং ব্লগ লেখার এক্সেস পায়। সিস্টেমের অন্যান্য কোর সেটিংসে তারা ঢুকতে পারে না।
                    </p>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">কার্যপ্রণালী</h3>
                    <ul className="list-disc pl-5 text-gray-300 text-sm mt-1 space-y-1">
                      <li>নতুন এডমিন বা এডিটর একাউন্ট তৈরি করতে পারবেন।</li>
                      <li>যেকোনো একাউন্ট ডিএক্টিভেট (Deactivate) করা বা ডিলিট করতে পারবেন।</li>
                      <li>ইউজারের পাসওয়ার্ড পরিবর্তন করে দিতে পারবেন।</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Agents */}
          {activeSection === "agents" && (
            <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="text-3xl font-bold text-white mb-4">এজেন্ট (AI Settings)</h1>
              <div className="prose prose-invert prose-orange max-w-none">
                <p className="text-gray-300">
                  আপনার সিস্টেমে ব্যবহৃত আর্টিফিশিয়াল ইন্টেলিজেন্স (AI) বা LLM মডেলগুলোর কনফিগারেশন এখান থেকে কন্ট্রোল করতে হয়।
                </p>
                <div className="bg-white/5 border border-white/10 rounded-lg p-5 mt-6">
                  <h3 className="text-white text-lg font-semibold mb-2">এখানে যা যা করতে পারবেন:</h3>
                  <ul className="list-disc pl-5 text-gray-300 space-y-2">
                    <li>কোন AI মডেল (যেমন: Kimi/Moonshot, Gemini বা OpenAI) ব্যবহার করা হবে তা নির্বাচন করা।</li>
                    <li>প্রতিটি এজেন্টের জন্য কাস্টম প্রম্পট (Prompt) সেট করা বা ইনস্ট্রাকশন পরিবর্তন করা।</li>
                    <li>ব্লগ রাইটিং এজেন্ট বা রিভিউ জেনারেশন এজেন্টের ডিফল্ট বিহেভিয়ার ঠিক করা।</li>
                  </ul>
                  <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded text-sm text-orange-200">
                    <strong>সতর্কতা:</strong> এজেন্টের বেস প্রম্পট (Base Prompt) পরিবর্তন করলে ব্লগের লেখার ধরনও পরিবর্তন হয়ে যাবে।
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Products */}
          {activeSection === "products" && (
            <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="text-3xl font-bold text-white mb-4">প্রোডাক্টস (Products)</h1>
              <div className="prose prose-invert prose-orange max-w-none">
                <p className="text-gray-300">
                  ওয়েবসাইটে প্রদর্শিত সকল অ্যামাজন প্রোডাক্ট ম্যানেজ করার মূল জায়গা এটি। প্রোডাক্ট এড করা, আপডেট করা বা ডিলিট করা—সব এখান থেকেই হয়।
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                    <h3 className="text-white font-semibold mb-2">নতুন প্রোডাক্ট যুক্ত করা</h3>
                    <p className="text-gray-400 text-sm">
                      Amazon-এর <strong>ASIN (Amazon Standard Identification Number)</strong> দিয়ে আপনি সরাসরি নতুন প্রোডাক্ট ইমপোর্ট করতে পারবেন। সিস্টেম অটোমেটিকলি Amazon থেকে টাইটেল, ছবি এবং প্রাইস ফেচ করে আনবে।
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                    <h3 className="text-white font-semibold mb-2">প্রোডাক্ট এডিটিং</h3>
                    <p className="text-gray-400 text-sm">
                      ইমপোর্ট করা প্রোডাক্টের টাইটেল, ডেসক্রিপশন এবং ছবি আপনি নিজের মত করে এডিট করতে পারবেন। এছাড়া AI বাটন দিয়ে রিভিউ কনটেন্ট জেনারেট করানো যায়।
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Sheet Control */}
          {activeSection === "sheet-control" && (
            <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="text-3xl font-bold text-white mb-4">শীট কন্ট্রোল (Google Sheets Sync)</h1>
              <div className="prose prose-invert prose-orange max-w-none">
                <p className="text-gray-300">
                  আপনি যদি একসাথে অনেক প্রোডাক্ট ইমপোর্ট করতে চান, তবে Google Sheet ব্যবহার করে খুব সহজেই তা করা যায়।
                </p>
                <div className="bg-white/5 border border-white/10 rounded-lg p-5 mt-6">
                  <h3 className="text-white text-lg font-semibold mb-3">কীভাবে কাজ করে?</h3>
                  <ol className="list-decimal pl-5 text-gray-300 space-y-3">
                    <li>প্রথমত আপনার একটি Google Sheet থাকতে হবে, যার এক্সেস সিস্টেমে দেওয়া আছে।</li>
                    <li>শীটে কলাম হিসেবে `ASIN` এবং `Category` থাকতে হবে।</li>
                    <li>অ্যাডমিন প্যানেল থেকে <strong>Sync</strong> বাটনে ক্লিক করলে সিস্টেম ওই শীট থেকে সব ASIN পড়ে নিবে।</li>
                    <li>Amazon API ব্যবহার করে প্রোডাক্টগুলোর ডিটেইলস নিয়ে এসে অটোমেটিক ডাটাবেসে সেভ করবে।</li>
                  </ol>
                  <p className="text-orange-300 text-sm mt-4">
                    নোট: একসাথে অনেক প্রোডাক্ট সিঙ্ক করলে Amazon API-তে রেট লিমিট (Rate Limit) এড়ানোর জন্য সিস্টেম কিছুটা ধীরগতিতে কাজ করতে পারে।
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Submissions (Reviews) */}
          {activeSection === "reviews" && (
            <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="text-3xl font-bold text-white mb-4">রিভিউ ও সাবমিশন</h1>
              <div className="prose prose-invert prose-orange max-w-none">
                <p className="text-gray-300">
                  সাধারণ ব্যবহারকারী বা গেস্টদের পাঠানো প্রোডাক্টের রিকুয়েস্ট বা সাবমিশন এখান থেকে দেখা যায় এবং মডারেশন করা যায়।
                </p>
                <ul className="list-disc pl-5 text-gray-300 mt-4 space-y-2">
                  <li><strong>Pending:</strong> নতুন আসা রিকুয়েস্টগুলো এখানে দেখাবে।</li>
                  <li><strong>Approve:</strong> রিকুয়েস্ট চেক করে আপনি চাইলে তা ডাটাবেসে যুক্ত (অ্যাপ্রুভ) করতে পারেন।</li>
                  <li><strong>Reject:</strong> কোনো স্প্যাম লিংক বা অপ্রাসঙ্গিক প্রোডাক্ট হলে তা ডিলিট বা রিজেক্ট করতে পারবেন।</li>
                </ul>
              </div>
            </section>
          )}

          {/* Tracking */}
          {activeSection === "tracking" && (
            <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="text-3xl font-bold text-white mb-4">অ্যাফিলিয়েট ট্র্যাকিং আইডি</h1>
              <div className="prose prose-invert prose-orange max-w-none">
                <p className="text-gray-300">
                  Amazon Affiliate-এর সবচেয়ে গরুত্বপূর্ণ অংশ এটি। এখান থেকে আপনি স্টোর আইডি (Store ID) এবং ট্র্যাকিং ট্যাগ (Tracking Tag) কন্ট্রোল করতে পারবেন।
                </p>
                <div className="bg-white/5 border border-white/10 rounded-lg p-5 mt-6">
                  <h3 className="text-white text-lg font-semibold mb-2">লোকালাইজেশন এবং ট্যাগ:</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    ইউজার কোন দেশ থেকে ভিজিট করছে তার উপর ভিত্তি করে সঠিক অ্যামাজন স্টোরে রিডাইরেক্ট করানো এবং সঠিক এফিলিয়েট ট্যাগ বসানোর কাজ এখান থেকে কনফিগার করা যায়।
                  </p>
                  <ul className="list-disc pl-5 text-gray-300 text-sm space-y-2">
                    <li>যুক্তরাষ্ট্রের (US) জন্য `tag=your-us-tag-20`</li>
                    <li>যুক্তরাজ্যের (UK) জন্য `tag=your-uk-tag-21`</li>
                    <li>অন্য দেশগুলোর জন্য আলাদা আলাদা ট্যাগ সেটআপ করা।</li>
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* Mappings */}
          {activeSection === "mappings" && (
            <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="text-3xl font-bold text-white mb-4">ক্যাটাগরি ম্যাপিং (Mappings)</h1>
              <div className="prose prose-invert prose-orange max-w-none">
                <p className="text-gray-300">
                  Amazon-এর ক্যাটাগরির সাথে আপনার ওয়েবসাইটের ক্যাটাগরির সম্পর্ক তৈরি করতে এই সেকশন ব্যবহার করা হয়।
                </p>
                <p className="text-gray-400 mt-2 text-sm">
                  মাঝে মাঝে Amazon থেকে আসা ক্যাটাগরির নামগুলো অনেক বড় বা এলোমেলো হয় (যেমন: <i>Electronics {">"} Computers {">"} Accessories</i>)। এখানে আপনি ম্যাপ করে বলে দিতে পারবেন যে এই ধরনের ক্যাটাগরিগুলো ওয়েবসাইটের <strong>"কম্পিউটার একসেসরিজ"</strong> ক্যাটাগরিতে দেখাবে। এর ফলে ওয়েবসাইট পরিষ্কার এবং ইউজার-ফ্রেন্ডলি থাকে।
                </p>
              </div>
            </section>
          )}

          {/* Blogs */}
          {activeSection === "blogs" && (
            <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="text-3xl font-bold text-white mb-4">ব্লগ ও এডিটোরিয়াল</h1>
              <div className="prose prose-invert prose-orange max-w-none">
                <p className="text-gray-300">
                  অ্যাফিলিয়েট মার্কেটিং-এর জন্য এসইও ফ্রেন্ডলি (SEO-friendly) কনটেন্ট লেখা এবং পাবলিশ করার জায়গা এটি।
                </p>
                <div className="bg-white/5 border border-white/10 rounded-lg p-5 mt-4 space-y-4">
                  <div>
                    <h3 className="text-white font-semibold">AI জেনারেশন</h3>
                    <p className="text-gray-400 text-sm mt-1">কয়েকটি প্রোডাক্ট সিলেক্ট করে আপনি এক ক্লিকেই একটি সম্পূর্ণ ব্লগ (যেমন: "Top 5 Laptops in 2026") লিখিয়ে নিতে পারবেন AI দিয়ে।</p>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">এডিটিং এবং থাম্বনেইল</h3>
                    <p className="text-gray-400 text-sm mt-1">পাবলিশ করার আগে ব্লগের টেক্সট কাস্টমাইজ করা, কভার ইমেজ (Cover Image) সেট করা এবং URL স্লাগ (Slug) ঠিক করা যায়।</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Analytics & Reports */}
          {activeSection === "analytics" && (
            <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="text-3xl font-bold text-white mb-4">অ্যানালিটিক্স ও রিপোর্ট</h1>
              <div className="prose prose-invert prose-orange max-w-none">
                <p className="text-gray-300">
                  আপনার ওয়েবসাইটের ট্রাফিক এবং কনভার্শন రేట్ কেমন তা বোঝার জন্য এই ডেটাগুলো খুবই জরুরী।
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="bg-white/5 border border-white/10 p-5 rounded-lg border-l-4 border-l-[#ff9900]">
                    <h3 className="text-white font-semibold mb-1">অ্যানালিটিক্স (Analytics)</h3>
                    <p className="text-gray-400 text-sm">কোন প্রোডাক্ট কতবার দেখা হয়েছে (Views) এবং কতবার ক্লিক করা হয়েছে (Outbound Clicks) তার রিয়েল-টাইম পরিসংখ্যান এখানে পাবেন।</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-5 rounded-lg border-l-4 border-l-blue-500">
                    <h3 className="text-white font-semibold mb-1">রিপোর্টস (Reports)</h3>
                    <p className="text-gray-400 text-sm">মাসিক বা সাপ্তাহিক পারফরম্যান্স দেখা যায় এবং কনভার্শন ভালো করার জন্য সিদ্ধান্ত নিতে সাহায্য করে।</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Audit Logs */}
          {activeSection === "audit-logs" && (
            <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="text-3xl font-bold text-white mb-4">অডিট লগস (Audit Logs)</h1>
              <div className="prose prose-invert prose-orange max-w-none">
                <p className="text-gray-300">
                  অ্যাডমিন প্যানেলে কে, কখন, কী কাজ করেছে—তার একটি পূর্ণাঙ্গ রিপোর্ট এখানে সেভ থাকে।
                </p>
                <p className="text-gray-400 mt-2 text-sm">
                  যেমন ধরুন, কোনো একজন এডিটর একটি প্রোডাক্ট ডিলিট করে দিল। অডিট লগে লেখা থাকবে যে "রহিম সাহেব, ১১ তারিখ দুপুর ২ টায়, প্রোডাক্ট X ডিলিট করেছেন।" এটি সিস্টেমের সিকিউরিটি এবং হিস্ট্রি ট্র্যাকিংয়ের জন্য অত্যন্ত গুরুত্বপূর্ণ।
                </p>
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  );
}
