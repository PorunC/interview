import fs from "node:fs";
import path from "node:path";
import { defineConfig, type DefaultTheme } from "vitepress";

const root = process.cwd();
const base = process.env.DOCS_BASE
  ? `/${process.env.DOCS_BASE.replace(/^\/+|\/+$/g, "")}/`
  : "/";

const problemLabels: Record<string, string> = {
  "00-总览": "00 · 总览",
  "01-AI周报系统": "01 · AI 周报系统",
  "02-CodeWiki": "02 · CodeWiki",
  "03-Agent-Memory": "03 · Agent Memory",
  "04-AI-Agent通用": "04 · AI Agent 通用",
  "05-英文面试": "05 · 英文面试",
  "06-Pi": "06 · Pi Coding Agent",
  "07-Java后端": "07 · Java 后端",
  "08-算法与现场编码": "08 · 算法与现场编码",
  "09-Python与FastAPI": "09 · Python 与 FastAPI",
  "10-LLM推理与RAG生产化": "10 · LLM 推理与 RAG",
  "10-后端基础设施": "10 · 后端基础设施",
  "11-金融AI": "11 · 金融 AI",
  "12-TypeScript与React": "12 · TypeScript 与 React",
  "13-系统设计": "13 · 系统设计"
};

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/\[(.*?)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

function getDocumentTitle(file: string): string {
  const source = fs.readFileSync(file, "utf8");
  const frontmatterTitle = source.match(/^---[\s\S]*?^title:\s*["']?(.+?)["']?\s*$[\s\S]*?^---/m)?.[1];
  const heading = source.match(/^#\s+(.+)$/m)?.[1];
  const fallback = path.basename(file, ".md").replace(/^README$/i, "索引");

  return stripInlineMarkdown(frontmatterTitle || heading || fallback);
}

function toLink(file: string): string {
  const relative = path.relative(root, file).split(path.sep).join("/");
  return `/${relative.replace(/README\.md$/i, "").replace(/\.md$/i, "")}`;
}

function markdownFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(directory, entry.name))
    .sort((left, right) => {
      const leftReadme = path.basename(left).toLowerCase() === "readme.md";
      const rightReadme = path.basename(right).toLowerCase() === "readme.md";
      if (leftReadme !== rightReadme) return leftReadme ? -1 : 1;
      return getDocumentTitle(left).localeCompare(getDocumentTitle(right), "zh-CN");
    });
}

function toItems(files: string[]): DefaultTheme.SidebarItem[] {
  return files.map((file) => ({
    text: getDocumentTitle(file),
    link: toLink(file)
  }));
}

function problemSidebar(): DefaultTheme.SidebarItem[] {
  const directory = path.join(root, "问题");
  const rootItems = toItems(markdownFiles(directory));
  const groups = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN", { numeric: true }))
    .map((entry) => ({
      text: problemLabels[entry.name] || entry.name,
      collapsed: entry.name !== "00-总览",
      items: toItems(markdownFiles(path.join(directory, entry.name)))
    }));

  return [
    {
      text: "面试问题",
      collapsed: false,
      items: rootItems
    },
    ...groups
  ];
}

function interviewSidebar(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: "面试复盘",
      collapsed: false,
      items: toItems(markdownFiles(path.join(root, "面试分析")))
    }
  ];
}

function companySidebar(): DefaultTheme.SidebarItem[] {
  const groups: Record<string, string[]> = {
    "A-F": [],
    "G-M": [],
    "N-Z": [],
    "中文公司": []
  };

  for (const file of markdownFiles(path.join(root, "公司"))) {
    if (path.basename(file).toLowerCase() === "readme.md") {
      groups["A-F"].unshift(file);
      continue;
    }

    const first = path.basename(file)[0]?.toUpperCase() || "";
    if (first >= "A" && first <= "F") groups["A-F"].push(file);
    else if (first >= "G" && first <= "M") groups["G-M"].push(file);
    else if (first >= "N" && first <= "Z") groups["N-Z"].push(file);
    else groups["中文公司"].push(file);
  }

  return Object.entries(groups)
    .filter(([, files]) => files.length > 0)
    .map(([text, files], index) => ({
      text,
      collapsed: index > 0,
      items: toItems(files)
    }));
}

export default defineConfig({
  base,
  lang: "zh-CN",
  title: "面试资料库",
  description: "AI 应用、Java 后端、系统设计、真实面试复盘与公司调研",
  rewrites: {
    "问题/README.md": "问题/index.md",
    "问题/03-Agent-Memory/README.md": "问题/03-Agent-Memory/index.md",
    "问题/05-英文面试/README.md": "问题/05-英文面试/index.md",
    "面试分析/README.md": "面试分析/index.md",
    "公司/README.md": "公司/index.md"
  },
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: [
    "项目/**",
    "tmp/**",
    ".agents/**",
    ".codex/**",
    "node_modules/**"
  ],
  ignoreDeadLinks: [
    /^\.\.\/\.\.\/项目\//,
    /^\.\.\/项目\//,
    /^项目\//
  ],
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: `${base}mark.svg` }],
    ["meta", { name: "theme-color", content: "#0f766e" }],
    ["meta", { name: "robots", content: "noindex,nofollow" }]
  ],
  markdown: {
    lineNumbers: true,
    headers: {
      level: [2, 3]
    },
    config(md) {
      const defaultFence = md.renderer.rules.fence;
      md.renderer.rules.fence = (tokens, index, options, env, self) => {
        const token = tokens[index];
        const language = token.info.trim().split(/\s+/)[0];
        if (language === "mermaid") {
          const source = encodeURIComponent(token.content);
          return `<div class="mermaid" data-mermaid-source="${source}">${md.utils.escapeHtml(token.content)}</div>`;
        }
        return defaultFence ? defaultFence(tokens, index, options, env, self) : self.renderToken(tokens, index, options);
      };
    }
  },
  themeConfig: {
    logo: {
      light: "/mark.svg",
      dark: "/mark-dark.svg",
      alt: "面试资料库"
    },
    siteTitle: "面试资料库",
    nav: [
      { text: "总览", link: "/" },
      { text: "面试题", link: "/问题/" },
      { text: "面试复盘", link: "/面试分析/" },
      { text: "公司调研", link: "/公司/" }
    ],
    sidebar: {
      "/问题/": problemSidebar(),
      "/面试分析/": interviewSidebar(),
      "/公司/": companySidebar()
    },
    outline: {
      level: [2, 3],
      label: "本页目录"
    },
    search: {
      provider: "local",
      options: {
        translations: {
          button: {
            buttonText: "搜索文档",
            buttonAriaLabel: "搜索文档"
          },
          modal: {
            noResultsText: "未找到相关内容",
            resetButtonTitle: "清除查询",
            footer: {
              selectText: "选择",
              navigateText: "切换",
              closeText: "关闭"
            }
          }
        }
      }
    },
    docFooter: {
      prev: "上一篇",
      next: "下一篇"
    },
    lastUpdated: {
      text: "最后更新",
      formatOptions: {
        dateStyle: "medium",
        timeStyle: "short"
      }
    },
    returnToTopLabel: "回到顶部",
    sidebarMenuLabel: "文档导航",
    darkModeSwitchLabel: "外观",
    lightModeSwitchTitle: "切换到浅色模式",
    darkModeSwitchTitle: "切换到深色模式",
    notFound: {
      title: "页面不存在",
      quote: "该文档可能已移动或未纳入发布范围。",
      linkLabel: "返回总览",
      linkText: "返回总览"
    }
  }
});
