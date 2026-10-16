import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import "./custom.css";
import DownloadPage from "../components/DownloadPage.vue";

const theme: Theme = {
  extends: DefaultTheme,
  /** Register the shared documentation download component.
   * @param context - VitePress application context.
   */
  enhanceApp({ app }) {
    app.component("DownloadPage", DownloadPage);
  },
};

export default theme;
