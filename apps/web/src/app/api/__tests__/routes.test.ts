/**
 * Phase 2 — API Routes
 *
 * Tests for:
 *   GET /api/health
 *   GET /api/turn-credentials
 *   POST /api/share-target
 *
 * Uses Next.js route handler testing pattern — import the handler directly
 * and call it with mocked NextRequest objects.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "test-user" } }, error: null })),
    },
  })),
}));

// ─── Health endpoint ────────────────────────────────────────────────────

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const { GET } = await import("../health/route");
    const request = new Request("http://localhost/api/health");
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(request);

    const response = await GET(nextReq);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("HyperLink Web");
    expect(body.timestamp).toBeTruthy();
  });

  it("returns a valid ISO timestamp", async () => {
    const { GET } = await import("../health/route");
    const request = new Request("http://localhost/api/health");
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(request);

    const response = await GET(nextReq);
    const body = await response.json();

    const date = new Date(body.timestamp);
    expect(date.toISOString()).toBe(body.timestamp);
  });

  it("performs deep health check when deep=true", async () => {
    const { GET } = await import("../health/route");
    const request = new Request("http://localhost/api/health?deep=true");
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(request);

    const response = await GET(nextReq);
    const body = await response.json();

    expect(body.checks).toBeDefined();
    expect(body.checks.supabase).toBeDefined();
  });
});

// ─── TURN credentials endpoint ──────────────────────────────────────────

describe("GET /api/turn-credentials", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.METERED_APP_NAME;
    delete process.env.METERED_TURN_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns STUN servers and public TURN fallback when no TURN_URL env", async () => {
    delete process.env.TURN_URL;
    delete process.env.NEXT_PUBLIC_TURN_URL;
    const { GET } = await import("../turn-credentials/route");
    const response = await GET(new Request("http://localhost/api/turn-credentials"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.iceServers).toBeDefined();
    expect(body.iceServers.length).toBeGreaterThanOrEqual(2);

    // Must include STUN servers
    const stunServers = body.iceServers.filter((s: RTCIceServer) =>
      typeof s.urls === "string" ? s.urls.startsWith("stun:") : false
    );
    expect(stunServers.length).toBeGreaterThanOrEqual(1);

    // Must include OpenRelay TURN servers
    const turnServers = body.iceServers.filter((s: RTCIceServer) =>
      typeof s.urls === "string" ? s.urls.startsWith("turn:") : false
    );
    expect(turnServers.length).toBeGreaterThanOrEqual(1);
    expect(body.turnSource).toBe("public-fallback");
  });

  it("uses private TURN server when TURN_URL env is set", async () => {
    process.env.TURN_URL = "turn:private.example.com:3478";
    process.env.TURN_USERNAME = "user";
    process.env.TURN_CREDENTIAL = "secret";

    const { GET } = await import("../turn-credentials/route");
    const response = await GET(new Request("http://localhost/api/turn-credentials"));
    const body = await response.json();

    const privateTurn = body.iceServers.find(
      (s: RTCIceServer) => s.urls === "turn:private.example.com:3478"
    );
    expect(privateTurn).toBeDefined();
    expect(privateTurn.username).toBe("user");
    expect(privateTurn.credential).toBe("secret");
    expect(body.turnSource).toBe("configured");
  });

  it("fetches dynamic TURN credentials from Metered server-side", async () => {
    process.env.METERED_APP_NAME = "hyperlink-p2p";
    process.env.METERED_TURN_API_KEY = "private-api-key";
    const meteredServers = [
      { urls: "stun:stun.relay.metered.ca:80" },
      {
        urls: "turn:global.relay.metered.ca:443?transport=tcp",
        username: "metered-user",
        credential: "metered-password",
      },
    ];
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(meteredServers), { status: 200 }));

    const { GET } = await import("../turn-credentials/route");
    const response = await GET(new Request("http://localhost/api/turn-credentials"));
    const body = await response.json();

    expect(fetchMock).toHaveBeenCalledOnce();
    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestedUrl.origin).toBe("https://hyperlink-p2p.metered.live");
    expect(requestedUrl.pathname).toBe("/api/v1/turn/credentials");
    expect(requestedUrl.searchParams.get("apiKey")).toBe("private-api-key");
    expect(body).toEqual({ iceServers: meteredServers, turnSource: "metered" });
  });

  it("supports legacy NEXT_PUBLIC_TURN variables from existing deployments", async () => {
    delete process.env.TURN_URL;
    delete process.env.TURN_USERNAME;
    delete process.env.TURN_CREDENTIAL;
    process.env.NEXT_PUBLIC_TURN_URL = "turn:legacy.example.com:3478";
    process.env.NEXT_PUBLIC_TURN_USERNAME = "legacy-user";
    process.env.NEXT_PUBLIC_TURN_CREDENTIAL = "legacy-secret";

    const { GET } = await import("../turn-credentials/route");
    const response = await GET(new Request("http://localhost/api/turn-credentials"));
    const body = await response.json();

    const legacyTurn = body.iceServers.find(
      (server: RTCIceServer) => server.urls === "turn:legacy.example.com:3478"
    );
    expect(legacyTurn).toMatchObject({
      username: "legacy-user",
      credential: "legacy-secret",
    });
    expect(body.turnSource).toBe("configured");
  });

  it("Task #4: supports multiple TURN providers", async () => {
    process.env.TURN_URL = "turn:provider1.com:3478";
    process.env.TURN_USERNAME = "user1";
    process.env.TURN_CREDENTIAL = "pass1";
    process.env.TURN_URL_2 = "turn:provider2.com:3478";
    process.env.TURN_USERNAME_2 = "user2";
    process.env.TURN_CREDENTIAL_2 = "pass2";

    const { GET } = await import("../turn-credentials/route");
    const response = await GET(new Request("http://localhost/api/turn-credentials"));
    const body = await response.json();

    const p1 = body.iceServers.find((s: RTCIceServer) => s.urls === "turn:provider1.com:3478");
    const p2 = body.iceServers.find((s: RTCIceServer) => s.urls === "turn:provider2.com:3478");

    expect(p1).toBeDefined();
    expect(p1.username).toBe("user1");
    expect(p2).toBeDefined();
    expect(p2.username).toBe("user2");
  });

  it("sets proper Cache-Control header", async () => {
    const { GET } = await import("../turn-credentials/route");
    const response = await GET(new Request("http://localhost/api/turn-credentials"));

    expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
  });
});

// ─── Share Target endpoint ──────────────────────────────────────────────

describe("POST /api/share-target", () => {
  it("redirects to /send with fallback flag for valid request", async () => {
    const { POST } = await import("../share-target/route");

    const request = new Request("https://app.example.com/api/share-target", {
      method: "POST",
      headers: {
        origin: "https://app.example.com",
        "content-length": "1024",
      },
    });

    // NextRequest wrapper
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(request);

    const response = await POST(nextReq);
    expect(response.status).toBe(303);
    const location = response.headers.get("location");
    expect(location).toContain("/send?shared=failed_sw_bypass");
  });

  it("rejects mismatched origin with 403", async () => {
    const { POST } = await import("../share-target/route");

    const request = new Request("https://app.example.com/api/share-target", {
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
        "content-length": "100",
      },
    });

    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(request);

    const response = await POST(nextReq);
    expect(response.status).toBe(403);
  });

  it("rejects oversized payloads with 413", async () => {
    const { POST } = await import("../share-target/route");

    const request = new Request("https://app.example.com/api/share-target", {
      method: "POST",
      headers: {
        origin: "https://app.example.com",
        "content-length": String(200 * 1024 * 1024), // 200MB > 100MB limit
      },
    });

    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(request);

    const response = await POST(nextReq);
    expect(response.status).toBe(413);
  });

  it("allows requests without origin header", async () => {
    const { POST } = await import("../share-target/route");

    const request = new Request("https://app.example.com/api/share-target", {
      method: "POST",
      headers: {
        "content-length": "1024",
      },
    });

    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(request);

    const response = await POST(nextReq);
    expect(response.status).toBe(303); // Should redirect, not reject
  });
});
