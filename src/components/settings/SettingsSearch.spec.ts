import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createI18n } from "vue-i18n";
import { nextTick } from "vue";
import type { SettingCategory } from "@/types/settings-schema";
import zhCN from "@/i18n/locales/zh-CN.json";
import enUS from "@/i18n/locales/en-US.json";
import SInput from "@/components/ui/SInput.vue";
import SettingsSearch from "./SettingsSearch.vue";

const fixtures = vi.hoisted(() => ({ schema: [] as SettingCategory[] }));
vi.mock("@/settings/schema", () => ({ settingsSchema: fixtures.schema }));
let wrapper: VueWrapper;

/** Mount search with the application's actual translations.
 * @param locale - Language used for labels and matching.
 * @returns Reactive i18n instance for language-switch tests.
 */
const mountSearch = (locale: "zh-CN" | "en-US" = "en-US") => {
  const i18n = createI18n({ legacy: false, locale, messages: { "zh-CN": zhCN, "en-US": enUS } });
  wrapper = mount(SettingsSearch, {
    attachTo: document.body,
    global: {
      plugins: [i18n],
      components: { SInput },
      stubs: { IconLucideSearch: true, IconLucideX: true },
    },
  });
  return i18n;
};

/** Focus the input and enter a search phrase.
 * @param query - User-entered phrase.
 */
const search = async (query: string) => {
  await wrapper.get("input").trigger("focus");
  await wrapper.get("input").setValue(query);
};

beforeEach(() => {
  fixtures.schema.splice(0, fixtures.schema.length, {
    id: "general",
    icon: {},
    sections: [
      {
        id: "cache",
        items: [
          {
            key: "fileCacheManager",
            type: "custom",
            descriptionKey: "settings.cacheDir.hint",
            keywords: ["settings.cacheDir.label"],
          },
          { key: "lastfmAccount", type: "custom" },
          { key: "streamingServerList", type: "custom" },
        ],
      },
    ],
  });
});
afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
});

describe("translated settings search", () => {
  it.each(["zh-CN", "en-US"] as const)("uses the custom description in %s", async (locale) => {
    mountSearch(locale);
    const messages = locale === "zh-CN" ? zhCN : enUS;
    await search(messages.settings.cacheDir.label);
    expect(wrapper.text()).toContain(messages.settings.fileCacheManager.label);
    expect(wrapper.text()).toContain(messages.settings.cacheDir.hint);
    expect(wrapper.text()).not.toContain("settings.");
  });

  it.each(["zh-CN", "en-US"] as const)(
    "finds retained custom settings without descriptions in %s",
    async (locale) => {
      mountSearch(locale);
      const messages = locale === "zh-CN" ? zhCN : enUS;
      for (const key of ["lastfmAccount", "streamingServerList"] as const) {
        await search(messages.settings[key].label);
        expect(wrapper.findAll(".font-medium").map((item) => item.text())).toEqual([
          messages.settings[key].label,
        ]);
        expect(wrapper.find(".truncate").exists()).toBe(false);
      }
    },
  );

  it("does not display or match missing translation keys", async () => {
    fixtures.schema[0].sections![0].items.push(
      { key: "missingTitle", type: "custom", keywords: ["settings.lastfmAccount.label"] },
      { key: "language", type: "select", keywords: ["settings.missingKeyword"] },
    );
    mountSearch();
    await search("Last.fm");
    expect(wrapper.findAll(".font-medium")).toHaveLength(1);
    await search("settings");
    expect(wrapper.findAll(".font-medium")).toHaveLength(0);
    expect(wrapper.text()).toContain(enUS.common.noData);
  });

  it("does not search descriptions marked as hidden", async () => {
    fixtures.schema[0].sections![0].items[0].hideDescription = true;
    mountSearch();
    await search(enUS.settings.cacheDir.hint);
    expect(wrapper.findAll(".font-medium")).toHaveLength(0);
  });

  it("updates existing results when the language changes", async () => {
    const i18n = mountSearch();
    await search("Last.fm");
    expect(wrapper.text()).toContain(enUS.settings.lastfmAccount.label);
    i18n.global.locale.value = "zh-CN";
    await nextTick();
    expect(wrapper.text()).toContain(zhCN.settings.lastfmAccount.label);
    expect(wrapper.text()).not.toContain(enUS.settings.lastfmAccount.label);
  });

  it("searches multiple nesting levels under non-searchable parents and returns the ancestor path", async () => {
    fixtures.schema[0].sections![0].items = [
      {
        key: "appearanceStyle",
        type: "select",
        searchable: false,
        hideChildren: true,
        children: [
          {
            key: "lastfmEnabled",
            type: "switch",
            searchable: false,
            children: [{ key: "lastfmAccount", type: "custom" }],
          },
        ],
      },
    ];
    mountSearch();
    await search("Last.fm");
    await wrapper.get(".top-full .cursor-pointer").trigger("mousedown");
    expect(wrapper.emitted("select")).toEqual([
      ["general", "lastfmAccount", ["appearanceStyle", "lastfmEnabled"]],
    ]);
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("");
    expect(wrapper.find(".top-full").exists()).toBe(false);
  });

  it("excludes hidden sections and hidden items together with their descendants", async () => {
    fixtures.schema[0].sections![0].items = [
      {
        key: "lastfmEnabled",
        type: "switch",
        visible: () => false,
        children: [{ key: "lastfmAccount", type: "custom" }],
      },
    ];
    fixtures.schema[0].sections!.push({
      id: "lastfm",
      visible: () => false,
      items: [{ key: "lastfmAccount", type: "custom" }],
    });
    mountSearch();
    await search("Last.fm");
    expect(wrapper.findAll(".font-medium")).toHaveLength(0);
  });

  it("does not obscure navigation for whitespace-only input", async () => {
    mountSearch();
    await search("   ");
    expect(wrapper.emitted("active-change")).toBeUndefined();
    expect(wrapper.find(".top-full").exists()).toBe(false);
  });

  it("dismisses results with Escape without changing the query", async () => {
    vi.useFakeTimers();
    mountSearch();
    await search("Last.fm");
    (wrapper.get("input").element as HTMLInputElement).focus();
    expect(wrapper.find(".top-full").exists()).toBe(true);
    await wrapper.get("input").trigger("keydown", { key: "Escape" });
    await vi.advanceTimersByTimeAsync(150);
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("Last.fm");
    expect(wrapper.find(".top-full").exists()).toBe(false);
    expect(wrapper.emitted("active-change")?.at(-1)).toEqual([false]);
  });

  it("clears results with the pointer clear action", async () => {
    mountSearch();
    await search("Last.fm");
    await wrapper.get("icon-lucide-x-stub").trigger("mousedown");
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("");
    expect(wrapper.find(".top-full").exists()).toBe(false);
  });
});
