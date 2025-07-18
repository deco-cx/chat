import { useEffect } from "react";

/**
 * Shared hook to synchronise browser document metadata (title, favicon and
 * common social meta-tags) with the current UI context.
 *
 * All updates are reversible – when the calling component unmounts, the
 * previous values are restored exactly as they were before the hook ran.
 */
export interface DocumentMetadataOptions {
  /** Full document title (e.g. "Foo | deco.chat"). */
  title?: string;
  /** Plain description, used for SEO + social previews. */
  description?: string;
  /** Absolute or relative URL to the favicon. */
  favicon?: string;
  /** Image URL used for Open Graph / Twitter cards. */
  socialImage?: string;
}

export function useDocumentMetadata({
  title,
  description,
  favicon,
  socialImage,
}: DocumentMetadataOptions): void {
  useEffect(() => {
    // Early-exit if nothing to update – avoids touching DOM unnecessarily.
    if (!title && !description && !favicon && !socialImage) return;

    /* ----------------- Title ----------------- */
    const previousTitle = document.title;
    if (title) {
      document.title = title;
    }

    /* ----------------- FavIcon ---------------- */
    const faviconSelector = 'link[rel="icon"]';
    let faviconEl = document.querySelector<HTMLLinkElement>(faviconSelector);
    if (!faviconEl) {
      faviconEl = document.createElement("link");
      faviconEl.setAttribute("rel", "icon");
      document.head.appendChild(faviconEl);
    }
    const prevFaviconHref = faviconEl.getAttribute("href");
    if (favicon) {
      faviconEl.setAttribute("href", favicon);
    }

    /* ----------------- Meta tags -------------- */
    const trackedMeta: Array<{ el: HTMLMetaElement; prev: string | null }> = [];

    function setMeta(
      attr: "name" | "property",
      value: string,
      content: string | undefined,
    ) {
      if (!content) return;
      const selector = `meta[${attr}="${value}"]`;
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, value);
        document.head.appendChild(el);
      }
      // Track original value once per element.
      if (!trackedMeta.find((m) => m.el === el)) {
        trackedMeta.push({ el, prev: el.getAttribute("content") });
      }
      el.setAttribute("content", content);
    }

    if (title) {
      setMeta("property", "og:title", title);
      setMeta("name", "twitter:title", title);
    }
    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
      setMeta("name", "twitter:description", description);
    }
    if (socialImage) {
      setMeta("property", "og:image", socialImage);
      setMeta("name", "twitter:image", socialImage);
    }

    /* ------------- Cleanup on unmount --------- */
    return () => {
      // Title
      document.title = previousTitle;
      // Favicon
      if (prevFaviconHref) {
        faviconEl.setAttribute("href", prevFaviconHref);
      } else {
        // If there was no favicon before, remove the tag to leave DOM clean.
        faviconEl.remove();
      }
      // Meta tags
      trackedMeta.forEach(({ el, prev }) => {
        if (prev === null) {
          el.remove();
        } else {
          el.setAttribute("content", prev);
        }
      });
    };
  }, [title, description, favicon, socialImage]);
}
