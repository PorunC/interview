<script setup lang="ts">
import { RotateCcw, X, ZoomIn, ZoomOut } from "@lucide/vue";
import DefaultTheme from "vitepress/theme";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useData, useRoute } from "vitepress";
import SitePasswordGate from "./SitePasswordGate.vue";

const { isDark } = useData();
const route = useRoute();
const viewerOpen = ref(false);
const viewerSvg = ref("");
const viewerWidth = ref(800);
const viewerScale = ref(1);
const viewerInitialScale = ref(1);
const viewerDialog = ref<HTMLElement>();
const zoomPercent = computed(() => Math.round(viewerScale.value * 100));

const minScale = 0.25;
const maxScale = 3;
const scaleStep = 0.25;
let activeDiagram: HTMLElement | null = null;
let previousBodyOverflow = "";
let previousHtmlOverflow = "";

function decorateDiagram(node: HTMLElement) {
  node.classList.add("mermaid-interactive");
  node.tabIndex = 0;
  node.setAttribute("role", "button");
  node.setAttribute("aria-label", "全屏查看图表");
}

function removeDiagramInteraction(node: HTMLElement) {
  node.classList.remove("mermaid-interactive");
  node.removeAttribute("tabindex");
  node.removeAttribute("role");
  node.removeAttribute("aria-label");
}

async function renderMermaid(force = false) {
  if (typeof window === "undefined") return;

  const nodes = Array.from(document.querySelectorAll<HTMLElement>(".mermaid"));
  if (!nodes.length) return;

  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: isDark.value ? "dark" : "neutral",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    flowchart: {
      curve: "basis",
      htmlLabels: true,
      useMaxWidth: true
    }
  });

  for (const node of nodes) {
    const source = node.dataset.mermaidSource;
    if (!source) continue;
    if (node.dataset.processed && !force) continue;

    node.removeAttribute("data-processed");
    node.classList.remove("mermaid-error");
    node.textContent = decodeURIComponent(source);

    try {
      await mermaid.run({ nodes: [node] });
      decorateDiagram(node);
    } catch (error) {
      removeDiagramInteraction(node);
      node.classList.add("mermaid-error");
      node.textContent = decodeURIComponent(source);
      console.warn("Mermaid diagram could not be rendered", error);
    }
  }
}

function openViewer(node: HTMLElement) {
  const svg = node.querySelector<SVGSVGElement>("svg");
  if (!svg) return;

  const width = svg.viewBox.baseVal.width || svg.getBoundingClientRect().width || 800;
  const availableWidth = Math.max(280, window.innerWidth - (window.innerWidth < 640 ? 32 : 96));
  const fittedScale = Math.min(1.5, availableWidth / width);
  const viewerId = svg.id ? `${svg.id}-viewer` : "";

  viewerWidth.value = width;
  viewerInitialScale.value = Math.max(minScale, fittedScale);
  viewerScale.value = viewerInitialScale.value;
  viewerSvg.value = svg.id ? svg.outerHTML.replaceAll(svg.id, viewerId) : svg.outerHTML;
  activeDiagram = node;
  previousBodyOverflow = document.body.style.overflow;
  previousHtmlOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  viewerOpen.value = true;
  nextTick(() => viewerDialog.value?.focus());
}

function closeViewer() {
  if (!viewerOpen.value) return;

  viewerOpen.value = false;
  document.body.style.overflow = previousBodyOverflow;
  document.documentElement.style.overflow = previousHtmlOverflow;
  nextTick(() => activeDiagram?.focus());
}

function zoomBy(delta: number) {
  viewerScale.value = Math.min(maxScale, Math.max(minScale, viewerScale.value + delta));
}

function resetZoom() {
  viewerScale.value = viewerInitialScale.value;
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null;
  const diagram = target?.closest<HTMLElement>(".mermaid-interactive");
  if (diagram) openViewer(diagram);
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (viewerOpen.value) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeViewer();
    }
    return;
  }

  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target instanceof Element ? event.target : null;
  const diagram = target?.closest<HTMLElement>(".mermaid-interactive");
  if (!diagram) return;

  event.preventDefault();
  openViewer(diagram);
}

onMounted(() => {
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);
  nextTick(() => renderMermaid());
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleDocumentClick);
  document.removeEventListener("keydown", handleDocumentKeydown);
  if (viewerOpen.value) {
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
  }
});

watch(
  () => route.path,
  () => {
    closeViewer();
    nextTick(() => renderMermaid());
  }
);

watch(isDark, () => nextTick(() => renderMermaid(true)));
</script>

<template>
  <SitePasswordGate>
    <DefaultTheme.Layout />
  </SitePasswordGate>
  <Teleport to="body">
    <div v-if="viewerOpen" class="mermaid-viewer" role="dialog" aria-modal="true" aria-label="图表全屏查看器">
      <div class="mermaid-viewer__toolbar" role="toolbar" aria-label="图表缩放工具">
        <button
          type="button"
          title="缩小"
          aria-label="缩小图表"
          :disabled="viewerScale <= minScale"
          @click="zoomBy(-scaleStep)"
        >
          <ZoomOut :size="19" aria-hidden="true" />
        </button>
        <output aria-live="polite">{{ zoomPercent }}%</output>
        <button type="button" title="重置缩放" aria-label="重置图表缩放" @click="resetZoom">
          <RotateCcw :size="18" aria-hidden="true" />
        </button>
        <button
          type="button"
          title="放大"
          aria-label="放大图表"
          :disabled="viewerScale >= maxScale"
          @click="zoomBy(scaleStep)"
        >
          <ZoomIn :size="19" aria-hidden="true" />
        </button>
        <span class="mermaid-viewer__divider" aria-hidden="true" />
        <button type="button" title="关闭" aria-label="关闭图表查看器" @click="closeViewer">
          <X :size="20" aria-hidden="true" />
        </button>
      </div>
      <div
        ref="viewerDialog"
        class="mermaid-viewer__canvas"
        tabindex="-1"
        @click.self="closeViewer"
      >
        <div
          class="mermaid-viewer__diagram"
          :style="{ width: `${viewerWidth * viewerScale}px` }"
          v-html="viewerSvg"
        />
      </div>
    </div>
  </Teleport>
</template>
