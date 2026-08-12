const CANONICAL_HOST = "www.dongnegogo.com";
const APEX_HOST = "dongnegogo.com";

export default {
  async fetch(request) {
    const destination = new URL(request.url);

    if (destination.hostname !== APEX_HOST) {
      return new Response("Not Found", { status: 404 });
    }

    destination.protocol = "https:";
    destination.hostname = CANONICAL_HOST;
    destination.port = "";

    return new Response(null, {
      status: 308,
      headers: {
        location: destination.toString(),
        "cache-control": "public, max-age=300",
      },
    });
  },
};
