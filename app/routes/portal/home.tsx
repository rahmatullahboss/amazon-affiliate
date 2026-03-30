import type { Route } from "./+types/home";

export async function loader({ request }: Route.LoaderArgs) {
  return Response.redirect(new URL("/portal/products", request.url), 302);
}

export default function PortalHomeRedirectPage() {
  return null;
}
