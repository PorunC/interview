<script setup lang="ts">
import {
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  Code2,
  Landmark,
  MessagesSquare,
  Network,
  ServerCog
} from "@lucide/vue";
import { computed } from "vue";
import { withBase } from "vitepress";
import { data as documents } from "../content.data";

const publishedDocuments = computed(() => documents.filter((document) => !document.isIndex));
const count = (section: string) =>
  publishedDocuments.value.filter((document) => document.section === section).length;

const sections = computed(() => [
  {
    title: "面试问题",
    count: count("问题"),
    unit: "篇专项",
    link: "/问题/",
    description: "AI 应用、后端、系统设计与现场编码",
    icon: BookOpenText,
    tone: "teal"
  },
  {
    title: "面试复盘",
    count: count("面试分析"),
    unit: "场记录",
    link: "/面试分析/",
    description: "真实问题、追问路径与答案整理",
    icon: MessagesSquare,
    tone: "coral"
  },
  {
    title: "公司调研",
    count: count("公司"),
    unit: "家公司",
    link: "/公司/",
    description: "业务、产品、技术栈与招聘风险",
    icon: Building2,
    tone: "blue"
  }
]);

const focusTopics = [
  {
    title: "RAG 核心概念",
    meta: "50 道专项题",
    link: "/问题/10-LLM推理与RAG生产化/RAG核心概念与高频面试题",
    icon: BrainCircuit
  },
  {
    title: "AI Agent",
    meta: "Agent 与框架",
    link: "/问题/04-AI-Agent通用/01-Agent基础与系统设计/AI-Agent-通用面试题",
    icon: Network
  },
  {
    title: "Java 后端",
    meta: "120 道高频题",
    link: "/问题/07-Java后端/Java后端高频面试题",
    icon: Code2
  },
  {
    title: "系统设计",
    meta: "60 道案例题",
    link: "/问题/13-系统设计/大厂系统设计与故障追问题",
    icon: ServerCog
  },
  {
    title: "金融 AI",
    meta: "授信、风控与 AML",
    link: "/问题/11-金融AI/金融AI与自动授信高频面试题",
    icon: Landmark
  },
  {
    title: "全面作战手册",
    meta: "简历与项目主线",
    link: "/问题/00-总览/简历与项目全面面试作战手册",
    icon: BriefcaseBusiness
  }
];

const recentReviews = [
  {
    title: "安克创新",
    role: "AI 应用 / 后端",
    link: "/面试分析/安克创新-面试整理与答案"
  },
  {
    title: "京东海外金融",
    role: "金融 AI",
    link: "/面试分析/京东-海外金融-面试整理与答案"
  },
  {
    title: "丰泊国际",
    role: "Java 后端 / AI 应用",
    link: "/面试分析/丰泊国际-Java后端-AI应用岗-面试整理与答案"
  },
  {
    title: "MemoraX",
    role: "AI 应用开发",
    link: "/面试分析/忆纪元-MemoraX-AI应用开发岗-面试整理与答案"
  }
];
</script>

<template>
  <main class="knowledge-home">
    <section class="home-intro">
      <div class="home-intro__copy">
        <p class="home-eyebrow">INTERVIEW KNOWLEDGE BASE</p>
        <h1>面试资料库</h1>
        <p class="home-summary">{{ publishedDocuments.length }} 篇内容，聚焦 AI 应用、后端工程、系统设计和真实面试复盘。</p>
        <div class="home-actions">
          <a class="primary-action" :href="withBase('/问题/00-总览/简历与项目全面面试作战手册')">
            <BookOpenText :size="18" aria-hidden="true" />
            开始复习
          </a>
          <a class="secondary-action" :href="withBase('/问题/')">
            查看全部题库
            <ArrowRight :size="17" aria-hidden="true" />
          </a>
        </div>
      </div>
      <div class="home-intro__signal" aria-hidden="true">
        <span class="signal-label">当前重点</span>
        <strong>RAG</strong>
        <span>Chunking · Retrieval · GraphRAG · Eval</span>
      </div>
    </section>

    <section class="home-section" aria-labelledby="library-sections">
      <div class="section-heading">
        <div>
          <p class="section-kicker">LIBRARY</p>
          <h2 id="library-sections">资料分区</h2>
        </div>
      </div>
      <div class="section-grid">
        <a
          v-for="section in sections"
          :key="section.title"
          class="section-card"
          :class="`section-card--${section.tone}`"
          :href="withBase(section.link)"
        >
          <component :is="section.icon" :size="22" aria-hidden="true" />
          <div class="section-card__count"><strong>{{ section.count }}</strong> {{ section.unit }}</div>
          <h3>{{ section.title }}</h3>
          <p>{{ section.description }}</p>
          <ArrowRight class="section-card__arrow" :size="18" aria-hidden="true" />
        </a>
      </div>
    </section>

    <section class="home-section home-section--split">
      <div class="topic-panel">
        <div class="section-heading">
          <div>
            <p class="section-kicker">FOCUS</p>
            <h2>核心专题</h2>
          </div>
          <a :href="withBase('/问题/')" class="section-link">全部专题 <ArrowRight :size="16" aria-hidden="true" /></a>
        </div>
        <div class="topic-list">
          <a v-for="topic in focusTopics" :key="topic.title" :href="withBase(topic.link)" class="topic-row">
            <span class="topic-row__icon"><component :is="topic.icon" :size="19" aria-hidden="true" /></span>
            <span class="topic-row__content"><strong>{{ topic.title }}</strong><small>{{ topic.meta }}</small></span>
            <ArrowRight :size="17" aria-hidden="true" />
          </a>
        </div>
      </div>

      <div class="review-panel">
        <div class="section-heading">
          <div>
            <p class="section-kicker">REVIEWS</p>
            <h2>面试复盘</h2>
          </div>
          <a :href="withBase('/面试分析/')" class="section-link">全部记录 <ArrowRight :size="16" aria-hidden="true" /></a>
        </div>
        <div class="review-list">
          <a v-for="review in recentReviews" :key="review.title" :href="withBase(review.link)" class="review-row">
            <span><strong>{{ review.title }}</strong><small>{{ review.role }}</small></span>
            <ArrowRight :size="17" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  </main>
</template>
