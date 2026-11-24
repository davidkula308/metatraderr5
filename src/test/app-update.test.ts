import { describe, expect, it } from "vitest";
import { assetSignature } from "@/lib/app-update";

describe("fetch latest updates", () => {
  it("sees a new version when the published files change", () => {
    const v1 = '<link rel="stylesheet" href="/assets/styles-a1.css"><script type="module" src="/assets/index-a1.js"></script>';
    const v2 = '<link rel="stylesheet" href="/assets/styles-a1.css"><script type="module" src="/assets/index-b2.js"></script>';
    expect(assetSignature(v1)).not.toBe(assetSignature(v2));
  });
  it("reports up to date when the files are the same", () => {
    const html = '<script src="/assets/index-a1.js"></script><link href="/assets/s.css" rel="stylesheet">';
    expect(assetSignature(html)).toBe(assetSignature(html + "<p>other text</p>"));
  });
});
