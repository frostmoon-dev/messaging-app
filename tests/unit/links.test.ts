import { describe, expect, it } from "vitest";
import { appLinkFor } from "@/lib/links";

describe("appLinkFor", () => {
  it("opens YouTube videos and Shorts in the YouTube app", () => {
    expect(appLinkFor("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toEqual({ app: "YouTube", url: "vnd.youtube://dQw4w9WgXcQ" });
    expect(appLinkFor("https://youtu.be/dQw4w9WgXcQ?si=abc")?.url).toBe("vnd.youtube://dQw4w9WgXcQ");
    expect(appLinkFor("https://youtube.com/shorts/dQw4w9WgXcQ")?.url).toBe("vnd.youtube://dQw4w9WgXcQ");
    expect(appLinkFor("https://m.youtube.com/watch?v=dQw4w9WgXcQ")?.url).toBe("vnd.youtube://dQw4w9WgXcQ");
  });

  it("leaves other YouTube pages as web pages", () => {
    expect(appLinkFor("https://www.youtube.com/@channel")).toBeNull();
    expect(appLinkFor("https://www.youtube.com/watch?v=bad")).toBeNull();
  });

  it("opens Spotify items in Spotify", () => {
    expect(appLinkFor("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=x")).toEqual({ app: "Spotify", url: "spotify://track/4uLU6hMCjMI75M1A2tKUQC" });
    expect(appLinkFor("https://open.spotify.com/intl-en/playlist/37i9dQZF1DXcBWIGoYBM5M")?.url).toBe("spotify://playlist/37i9dQZF1DXcBWIGoYBM5M");
    expect(appLinkFor("https://spotify.link/abc")?.url).toBe("x-safari-https://spotify.link/abc");
  });

  it("hands Instagram, TikTok and others to Safari", () => {
    expect(appLinkFor("https://www.instagram.com/reel/C8abc/?igsh=1")).toEqual({ app: "Instagram", url: "x-safari-https://www.instagram.com/reel/C8abc/?igsh=1" });
    expect(appLinkFor("https://vm.tiktok.com/ZMabc/")?.app).toBe("TikTok");
    expect(appLinkFor("https://x.com/user/status/1")?.app).toBe("X");
    expect(appLinkFor("https://www.google.com/maps/place/Sydney")?.url).toBe("x-safari-https://www.google.com/maps/place/Sydney");
  });

  it("leaves ordinary sites and look-alike domains alone", () => {
    expect(appLinkFor("https://example.com/instagram.com")).toBeNull();
    expect(appLinkFor("https://notinstagram.com/p/1")).toBeNull();
    expect(appLinkFor("https://www.google.com/search?q=maps")).toBeNull();
    expect(appLinkFor("not a url")).toBeNull();
  });
});
