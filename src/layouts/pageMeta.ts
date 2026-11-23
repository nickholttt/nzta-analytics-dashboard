// What Layout.astro writes into a page's head besides the title: the description and the social card tags, from config/site.json (meta).
// Pure, so tests/site/page-meta.test.ts can hold it to its rules without building a page.
//
// A card image must be named by an absolute address, and the site's address is the user's to decide (config/site.json, about.site_address).
// Until it is set, no image, no canonical address and no page address are written; filling the address in config is the only step left.
import siteDoc from "../../config/site.json";
import { PLACEHOLDER_MARK } from "../lib/siteCopy";

export type PageId = keyof typeof siteDoc.meta.pages;
export type MetaTag = { attribute: "name" | "property"; key: string; content: string };
export type PageMeta = { title: string; description: string; tags: MetaTag[]; canonical?: string; needsScript: boolean };

const { meta } = siteDoc;

// A title with the site's suffix, for a page that has no entry of its own (the internal pages).
export const withSuffix = (title: string) => `${title} · ${meta.title_suffix}`;

// The site's own origin, or undefined while the address is still a gap or is not a web address.
export function siteOrigin(address: string): string | undefined {
  const text = address.trim();
  if (!text || text.includes(PLACEHOLDER_MARK)) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return url.hostname.includes(".") ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

export function pageMeta(
  id: PageId,
  { pathname, noindex = false, address = siteDoc.about.site_address, siteName = siteDoc.about.site_name }: { pathname: string; noindex?: boolean; address?: string; siteName?: string },
): PageMeta {
  const page = meta.pages[id];
  const title = withSuffix(page.title);
  const origin = siteOrigin(address);
  const tags: MetaTag[] = [{ attribute: "name", key: "description", content: page.description }];
  let canonical: string | undefined;
  // A page kept out of search engines is not one a visitor shares, so it carries no card.
  if (!noindex) {
    const url = origin ? new URL(pathname, origin).href : undefined;
    const image = origin ? `${origin}${meta.card_folder}/${id}.png` : undefined;
    canonical = url;
    tags.push(
      { attribute: "property", key: "og:type", content: "website" },
      { attribute: "property", key: "og:title", content: title },
      { attribute: "property", key: "og:description", content: page.description },
      { attribute: "property", key: "og:locale", content: meta.locale },
      { attribute: "name", key: "twitter:card", content: image ? "summary_large_image" : "summary" },
      { attribute: "name", key: "twitter:title", content: title },
      { attribute: "name", key: "twitter:description", content: page.description },
    );
    if (!siteName.includes(PLACEHOLDER_MARK)) tags.push({ attribute: "property", key: "og:site_name", content: siteName });
    if (url) tags.push({ attribute: "property", key: "og:url", content: url });
    if (image) {
      tags.push(
        { attribute: "property", key: "og:image", content: image },
        { attribute: "property", key: "og:image:width", content: String(meta.card_width) },
        { attribute: "property", key: "og:image:height", content: String(meta.card_height) },
        { attribute: "property", key: "og:image:alt", content: page.title },
        { attribute: "name", key: "twitter:image", content: image },
        { attribute: "name", key: "twitter:image:alt", content: page.title },
      );
    }
  }
  return { title, description: page.description, tags, canonical, needsScript: "needs_script" in page && page.needs_script === true };
}
