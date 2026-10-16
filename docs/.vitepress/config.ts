import { defineConfig } from "vitepress";

const repository = "https://github.com/MasterZack69/SPlayer-Z";
const guides = [
  { text: "Getting started", link: "/guide" },
  { text: "Downloads and installation", link: "/download" },
  { text: "Library and metadata", link: "/library" },
  { text: "Search", link: "/search" },
  { text: "Queue", link: "/queue" },
  { text: "Lyrics", link: "/lyrics" },
  { text: "Media servers", link: "/streaming" },
];
const development = [
  { text: "Architecture", link: "/architecture" },
  { text: "Native modules", link: "/native" },
  { text: "Internal types", link: "/types" },
  { text: "Contributing", link: "/contributing" },
];
const troubleshooting = [
  { text: "Debugging and logs", link: "/troubleshooting/debug" },
  { text: "Nix and PipeWire", link: "/troubleshooting/nix" },
  { text: "Linux Wayland", link: "/troubleshooting/wayland" },
  { text: "Ubuntu startup", link: "/troubleshooting/ubuntu-sandbox" },
];

export default defineConfig({
  title: "SPlayer-Z",
  description: "An offline-first desktop music player for local files and your own media servers.",
  lang: "en-US",
  srcExclude: ["superpowers/**"],
  head: [["link", { rel: "icon", href: "/favicon.png" }]],
  themeConfig: {
    logo: "/favicon.png",
    siteTitle: "SPlayer-Z",
    socialLinks: [{ icon: "github", link: repository }],
    nav: [
      { text: "Home", link: "/" },
      { text: "Guide", link: "/guide" },
      { text: "Download", link: "/download" },
      { text: "Development", items: development },
      { text: "GitHub", link: repository },
    ],
    sidebar: [
      { text: "Guides", items: guides },
      { text: "Development", items: development },
      { text: "Troubleshooting", items: troubleshooting },
      {
        text: "About",
        items: [
          { text: "User agreement", link: "/agreement" },
          { text: "Privacy policy", link: "/privacy" },
        ],
      },
    ],
    outline: { level: [2, 3], label: "On this page" },
    footer: {
      message:
        'Released under AGPL-3.0 | <a href="/agreement">User agreement</a> | <a href="/privacy">Privacy policy</a>',
      copyright:
        "SPlayer-Z contributors; upstream SPlayer-Next copyright holders retain their rights.",
    },
    editLink: {
      pattern: `${repository}/blob/dev/docs/:path?plain=1`,
      text: "View or edit this page",
    },
    lastUpdated: {
      text: "Last updated",
      formatOptions: { dateStyle: "medium", timeStyle: "short" },
    },
    search: {
      provider: "local",
      options: {
        // Compatibility pages include canonical content but should not duplicate search results.
        _render: (source, env, md) =>
          env.relativePath.startsWith("en/") ? "" : md.render(source, env),
      },
    },
  },
});
