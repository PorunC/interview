import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import Layout from "./Layout.vue";
import DocumentDirectory from "./DocumentDirectory.vue";
import HomeDashboard from "./HomeDashboard.vue";
import "./styles.css";

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component("DocumentDirectory", DocumentDirectory);
    app.component("HomeDashboard", HomeDashboard);
  }
} satisfies Theme;
