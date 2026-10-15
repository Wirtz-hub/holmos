"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";

/**
 * Content shown inside an iframe on another website. Tells the host page how
 * tall it is, so the embed script can size the frame to fit (grow or shrink).
 */
export function EmbedFrame({ children, className, style, lang }: { children: ReactNode; className?: string; style?: CSSProperties; lang?: string }) {
  useEffect(() => {
    if (window.parent === window) return;
    const content = document.getElementById("holmos-embed");
    if (!content) return;
    const report = () => window.parent.postMessage({ type: "holmos:height", height: Math.ceil(content.getBoundingClientRect().height) }, "*");
    const observer = new ResizeObserver(report);
    observer.observe(content);
    report();
    return () => observer.disconnect();
  }, []);

  return (
    <div id="holmos-embed" lang={lang} style={style} className={className}>
      <style>{"body{background:transparent;min-height:0}"}</style>
      {children}
    </div>
  );
}
