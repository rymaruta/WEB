import { describe, expect, it } from "vitest";
import { imageVariants } from "@/lib/image-variants";

describe("imageVariants", () => {
  it("ITmedia の OGP 画像は、末尾の幅を変えた媒体自身の縮小版を使う", () => {
    expect(imageVariants("https://www.itmedia.co.jp/news/article/ogp/2609/30/2000001877/10008015/2048")).toEqual([
      { url: "https://www.itmedia.co.jp/news/article/ogp/2609/30/2000001877/10008015/480", width: 480 },
      { url: "https://www.itmedia.co.jp/news/article/ogp/2609/30/2000001877/10008015/800", width: 800 },
    ]);
  });
  it("幅と高さの指定がある画像配信は、比率を保って幅を変える", () => {
    expect(imageVariants("https://cdn.kds.ltd/gendai/abc/_/f_jpg,c_fill,w_1200,h_630")?.[0].url).toBe("https://cdn.kds.ltd/gendai/abc/_/f_jpg,c_fill,w_480,h_252");
  });
  it("対応していない媒体は元の画像のまま", () => {
    expect(imageVariants("https://example.com/a.jpg")).toBeNull();
  });
});
