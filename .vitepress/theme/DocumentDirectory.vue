<script setup lang="ts">
import { ArrowRight, FileText } from "@lucide/vue";
import { computed } from "vue";
import { withBase } from "vitepress";
import { data as documents, type ContentDocument } from "../content.data";

const props = defineProps<{
  section: ContentDocument["section"];
}>();

const sectionDocuments = computed(() =>
  documents.filter((document) => document.section === props.section && !document.isIndex)
);

const groupedDocuments = computed(() => {
  if (props.section !== "公司") {
    return [{ title: "全部文档", documents: sectionDocuments.value }];
  }

  const groups: Record<string, ContentDocument[]> = {
    "A-F": [],
    "G-M": [],
    "N-Z": [],
    "中文公司": []
  };

  for (const document of sectionDocuments.value) {
    const first = document.title[0]?.toUpperCase() || "";
    if (first >= "A" && first <= "F") groups["A-F"].push(document);
    else if (first >= "G" && first <= "M") groups["G-M"].push(document);
    else if (first >= "N" && first <= "Z") groups["N-Z"].push(document);
    else groups["中文公司"].push(document);
  }

  return Object.entries(groups)
    .filter(([, entries]) => entries.length > 0)
    .map(([title, entries]) => ({ title, documents: entries }));
});
</script>

<template>
  <div class="document-directory">
    <div class="directory-summary">
      <strong>{{ sectionDocuments.length }}</strong>
      <span>{{ section === "公司" ? "家公司" : "场面试" }}</span>
    </div>

    <section v-for="group in groupedDocuments" :key="group.title" class="directory-group">
      <h2>{{ group.title }}</h2>
      <div class="directory-list">
        <a
          v-for="document in group.documents"
          :key="document.url"
          :href="withBase(document.url)"
          class="directory-row"
        >
          <FileText :size="18" aria-hidden="true" />
          <span>{{ document.title }}</span>
          <ArrowRight :size="16" aria-hidden="true" />
        </a>
      </div>
    </section>
  </div>
</template>
