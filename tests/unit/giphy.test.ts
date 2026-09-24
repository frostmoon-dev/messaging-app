import { describe, expect, it } from "vitest";
import { cleanMediaUrl, normalizeGif } from "@/lib/giphy";

const raw = {
  id: "abc",
  title: "Cat waving GIF",
  alt_text: "",
  images: {
    fixed_width: {
      url: "https://media2.giphy.com/media/abc/200w.gif?cid=1&rid=200w.gif",
      webp: "https://media2.giphy.com/media/abc/200w.webp?cid=1",
      mp4: "https://media2.giphy.com/media/abc/200w.mp4?cid=1",
      width: "200",
      height: "150",
    },
    fixed_width_small: { url: "https://media2.giphy.com/media/abc/100w.gif", webp: "https://media2.giphy.com/media/abc/100w.webp", width: "100", height: "75" },
    fixed_width_small_still: { url: "https://media2.giphy.com/media/abc/100w_s.gif", width: "100", height: "75" },
  },
};

describe("GIPHY results", () => {
  it("sends an MP4 for GIFs and a WebP for stickers, without tracking parameters", () => {
    expect(normalizeGif(raw, "gifs")).toEqual({
      id: "abc",
      title: "Cat waving GIF",
      preview: "https://media2.giphy.com/media/abc/100w.webp",
      still: "https://media2.giphy.com/media/abc/100w_s.gif",
      send: "https://media2.giphy.com/media/abc/200w.mp4",
      width: 200,
      height: 150,
    });
    expect(normalizeGif(raw, "stickers")?.send).toBe("https://media2.giphy.com/media/abc/200w.webp");
  });

  it("drops anything not hosted on GIPHY's media servers", () => {
    expect(cleanMediaUrl("https://evil.example/a.mp4")).toBeNull();
    expect(cleanMediaUrl("https://media.giphy.com.evil.example/a.mp4")).toBeNull();
    expect(cleanMediaUrl("http://media.giphy.com/a.mp4")).toBeNull();
    expect(cleanMediaUrl("https://i.giphy.com/media/x/giphy.webp")).toBe("https://i.giphy.com/media/x/giphy.webp");
    expect(normalizeGif({ ...raw, images: { fixed_width: { ...raw.images.fixed_width, mp4: "https://evil.example/x.mp4" } } }, "gifs")).toBeNull();
  });
});
