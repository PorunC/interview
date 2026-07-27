import path from "node:path";
import { createContentLoader } from "vitepress";

export interface ContentDocument {
  title: string;
  url: string;
  section: "问题" | "面试分析" | "公司";
  group: string;
  isIndex: boolean;
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/\[(.*?)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

function documentTitle(source: string, url: string, frontmatterTitle?: string): string {
  const heading = source.match(/^#\s+(.+)$/m)?.[1];
  const fallback = decodeURIComponent(url.split("/").filter(Boolean).at(-1) || "索引");
  return stripInlineMarkdown(frontmatterTitle || heading || fallback);
}

export default createContentLoader(
  ["问题/**/*.md", "面试分析/**/*.md", "公司/**/*.md"],
  {
    includeSrc: true,
    transform(rawData): ContentDocument[] {
      return rawData
        .map(({ url, frontmatter, src }) => {
          const segments = decodeURIComponent(url).split("/").filter(Boolean);
          const section = segments[0] as ContentDocument["section"];
          const group = section === "问题" ? segments[1] || "索引" : section;
          const lastSegment = segments.at(-1)?.toLowerCase();
          return {
            title: documentTitle(src || "", url, frontmatter.title),
            url,
            section,
            group,
            isIndex: segments.length === 1 || lastSegment === "readme" || lastSegment === "index"
          };
        })
        .sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));
    }
  }
);
