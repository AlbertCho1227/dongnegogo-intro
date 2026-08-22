const CANONICAL_HOST = "www.dongnegogo.com";
const APEX_HOST = "dongnegogo.com";

function withSecurityHeaders(request, response) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'");
  headers.set("Permissions-Policy", "browsing-topics=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
  if (new URL(request.url).protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request) {
    const destination = new URL(request.url);

    if (destination.hostname !== APEX_HOST) {
      return withSecurityHeaders(request, new Response("Not Found", { status: 404 }));
    }

    destination.protocol = "https:";
    destination.hostname = CANONICAL_HOST;
    destination.port = "";

    return withSecurityHeaders(request, new Response(null, {
      status: 308,
      headers: {
        location: destination.toString(),
        "cache-control": "public, max-age=300",
      },
    }));
  },
};
