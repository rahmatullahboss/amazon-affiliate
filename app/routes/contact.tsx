import type { Route } from "./+types/contact";
import { buildSeoMeta } from "../utils/seo";

export function meta({}: Route.MetaArgs) {
  return buildSeoMeta({
    title: "Contact | DealsRky",
    description: "Contact information and support guidance for DealsRky visitors.",
    path: "/contact",
  });
}

export default function Contact() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8f8_0%,#ffffff_24%,#f4f6f6_100%)] py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-12 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">
            Contact
          </p>
          <h1 className="mt-3 text-3xl font-black text-gray-950 md:text-5xl">
            Contact DealsRky
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600">
            Use this page for site questions, product page issues, or affiliate-link
            concerns. Amazon order support should be handled directly through Amazon.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <section className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="border-b border-gray-100 pb-4 text-2xl font-bold text-gray-900">
              Contact information
            </h2>

            <div className="mt-8 space-y-8">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-gray-500">
                  General support
                </h3>
                <p className="mt-2 text-base font-semibold text-primary">
                  support@dealsrky.com
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Use email for site issues, broken pages, or policy questions.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-gray-500">
                  Business hours
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Responses are typically handled during standard business hours. Timing may
                  vary based on the request type.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
                <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-amber-800">
                  Amazon order notice
                </h3>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  DealsRky does not fulfill Amazon orders and cannot modify shipping,
                  returns, cancellations, or payment details. For order-specific help,
                  contact Amazon support directly.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="border-b border-gray-100 pb-4 text-2xl font-bold text-gray-900">
              Send a message
            </h2>

            <form
              className="mt-8 space-y-5"
              action="mailto:support@dealsrky.com"
              method="POST"
              encType="text/plain"
            >
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-bold text-gray-700">
                  Full name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-bold text-gray-700">
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label htmlFor="message" className="mb-1.5 block text-sm font-bold text-gray-700">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={6}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Tell us how we can help."
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-primary py-3.5 font-bold text-white transition-colors hover:bg-primary-hover"
              >
                Send message
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
