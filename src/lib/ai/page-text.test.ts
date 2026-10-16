import { describe, expect, it } from "vitest";
import { decodeEntities, htmlToText, isPrivateAddress, readPage, websiteUrl } from "@/lib/ai/page-text";

describe("htmlToText", () => {
  it("keeps the words and drops scripts, styles and comments", () => {
    const html = `<html><head><title>T</title><style>body{color:red}</style></head><body>
      <!-- hidden --><script>alert("x")</script>
      <h1>Velkommen</h1><p>Vi er en <b>lille</b> klinik.</p><ul><li>Rens</li><li>Blegning</li></ul>
      <noscript>Slå JavaScript til</noscript></body></html>`;
    expect(htmlToText(html)).toBe("# Velkommen\nVi er en lille klinik.\nRens\nBlegning");
  });

  it("decodes Danish letters and numbered characters", () => {
    expect(decodeEntities("K&oslash;benhavn &amp; &Aring;rhus &#8211; &#x2764;")).toBe("København & Århus – ❤");
  });
});

describe("readPage", () => {
  const page = new URL("https://www.example.dk/");
  const html = `<html><head>
      <title>Klinik  Hansen</title>
      <meta name="description" content="Tandlæge i Aarhus">
      <meta name="theme-color" content="#0F766E">
      <style>.a{color:#0f766e}.b{color:#ffffff}.c{background:#333333}.d{color:#be123c}.e{color:#be123c}</style>
    </head><body>
      <a href="/om-os">Om os</a><a href="kontakt#form">Kontakt</a><a href="https://example.dk/priser?x=1">Priser</a>
      <a href="https://facebook.com/about">Facebook</a><a href="/blog/nyhed">Blog</a><a href="mailto:a@b.dk">Mail</a>
      <a href="/brochure-priser.pdf">PDF</a>
    </body></html>`;

  it("reads the title, description and the site's own useful pages", () => {
    const info = readPage(html, page);
    expect(info.title).toBe("Klinik Hansen");
    expect(info.description).toBe("Tandlæge i Aarhus");
    expect(info.links).toEqual(["https://www.example.dk/om-os", "https://www.example.dk/kontakt", "https://example.dk/priser"]);
  });

  it("finds brand colours, theme colour first, without white and greys", () => {
    expect(readPage(html, page).colours).toEqual(["#0f766e", "#be123c"]);
  });
});

describe("websiteUrl", () => {
  it("adds https:// and accepts normal addresses", () => {
    expect(websiteUrl("tandlaege-hansen.dk")?.toString()).toBe("https://tandlaege-hansen.dk/");
    expect(websiteUrl("http://example.dk/side")?.toString()).toBe("http://example.dk/side");
  });

  it("refuses things that aren't public websites", () => {
    for (const bad of ["", "localhost", "ftp://example.dk", "https://user:pw@example.dk", "https://example.dk:8080", "file:///etc/passwd"]) {
      expect(websiteUrl(bad), bad).toBeNull();
    }
  });
});

describe("isPrivateAddress", () => {
  it("blocks this computer and private networks", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const ip of ["76.76.21.21", "8.8.8.8", "172.32.0.1", "2a00:1450:4001:80b::200e"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
});
