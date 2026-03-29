import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";

export const meta: Route.MetaFunction = () => [
  { title: "DealsRky | Curated Amazon Affiliate Storefront" },
  {
    name: "description",
    content:
      "Curated Amazon product pages, fast bridge links, and transparent affiliate disclosures built for direct Amazon checkout.",
  },
  { name: "viewport", content: "width=device-width, initial-scale=1" },
  { name: "theme-color", content: "#0a0a0f" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "Page Not Found" : "Error";
    details =
      error.status === 404
        ? "The page you're looking for doesn't exist."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-5xl font-extrabold bg-gradient-to-br from-[#ff9900] to-[#ffad33] bg-clip-text text-transparent mb-4">
        {message}
      </h1>
      <p className="text-[#a0a0b8] text-lg">
        {details}
      </p>
      {stack && (
        <pre className="mt-4 p-4 bg-[#1a1a28] rounded-lg overflow-auto max-w-full text-sm text-[#6b6b85] text-left">
          {stack}
        </pre>
      )}
    </main>
  );
}
