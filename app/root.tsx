import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from "react-router";
import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import type { Route } from "./+types/root";
import { clearAuthSession, persistAuthSession } from "./utils/auth-session";
import {
  isNativeCapacitorApp,
  parseNativeAuthCallbackUrl,
} from "./utils/native-auth";
import { captureZarazAttribution, flushQueuedZarazCalls, setZarazContext } from "./utils/zaraz";
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

function NativeAuthListener() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeCapacitorApp()) {
      return;
    }

    let listenerHandle: PluginListenerHandle | null = null;

    const handleAuthUrl = async (value?: string | null) => {
      if (!value) {
        return;
      }

      const payload = parseNativeAuthCallbackUrl(value);

      if (!payload) {
        return;
      }

      if (payload.token && payload.user) {
        persistAuthSession(payload.token, payload.user);
      } else if (payload.token || payload.user) {
        clearAuthSession();
      }

      navigate(payload.next || "/portal/products", { replace: true });
    };

    const bindListener = async () => {
      const launchUrl = await CapacitorApp.getLaunchUrl();

      if (launchUrl?.url) {
        await handleAuthUrl(launchUrl.url);
      }

      listenerHandle = await CapacitorApp.addListener("appUrlOpen", ({ url }) => {
        void handleAuthUrl(url);
      });
    };

    void bindListener();

    return () => {
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, [navigate]);

  return null;
}

function ZarazBootstrap() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const attribution = captureZarazAttribution();
    setZarazContext({
      route_path: location.pathname,
      route_search: location.search || "",
      ...attribution,
    });

    if (flushQueuedZarazCalls()) {
      return;
    }

    const timerId = window.setTimeout(() => {
      flushQueuedZarazCalls();
    }, 500);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [location.pathname, location.search]);

  return null;
}

export default function App() {
  return (
    <>
      <NativeAuthListener />
      <ZarazBootstrap />
      <Outlet />
    </>
  );
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
