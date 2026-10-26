import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createI18n } from "vue-i18n";
import { nextTick } from "vue";
import type { SettingCategory, SettingItem } from "@/types/settings-schema";
import english from "@/i18n/locales/en-US.json";
import SettingsContent from "./SettingsContent.vue";
import SettingsSection from "./SettingsSection.vue";
import SettingsItemComponent from "./SettingsItem.vue";

const fixtures = vi.hoisted(() => ({ schema: [] as SettingCategory[] }));
vi.mock("@/settings/schema", () => ({ settingsSchema: fixtures.schema }));
vi.mock("@/settings/useSettingsDialog", () => ({
  useSettingsDialog: () => ({
    initialCategory: { value: "general" },
    initialHighlight: { value: undefined },
    rememberCategory: vi.fn(),
  }),
}));
vi.mock("@/stores/settings", () => ({ useSettingsStore: () => ({ syncSystem: vi.fn() }) }));
vi.mock("@/settings/useSettingModel", () => ({ useSettingModel: vi.fn() }));
vi.mock("@/composables/useDialog", () => ({ dialog: { confirm: vi.fn() } }));
vi.mock("@/utils/url", () => ({ openExternal: vi.fn() }));
vi.mock("@/utils/config", () => ({
  REPO_URL: "https://github.com/MasterZack69/SPlayer-Z",
  REPO_NAME: "SPlayer-Z",
  APP_VERSION: "1.1.0",
}));
let wrapper: VueWrapper;
const scrollIntoView = vi.fn();

/** Render the real nested settings components with unrelated controls stubbed.
 * @param items - Controls to render in the search-result category.
 */
const mountContent = (items: SettingItem[]) => {
  fixtures.schema.splice(
    0,
    fixtures.schema.length,
    { id: "general", icon: {}, sections: [] },
    { id: "services", icon: {}, sections: [{ id: "lastfm", items }] },
  );
  const pending = [...items];
  while (pending.length) {
    const item = pending.pop()!;
    item.hideDescription = true;
    pending.push(...(item.children ?? []));
  }
  wrapper = mount(SettingsContent, {
    attachTo: document.body,
    global: {
      plugins: [createI18n({ legacy: false, locale: "en-US", messages: { "en-US": english } })],
      components: { SettingsSection, SettingsItem: SettingsItemComponent },
      stubs: {
        SettingsSearch: true,
        SettingsMenu: true,
        SButton: true,
        STag: true,
        SSwitch: true,
        SSelect: true,
        SSlider: true,
        SColor: true,
        SInput: true,
        SNumberInput: true,
        IconLucideGithub: true,
      },
    },
  });
};

/** Select a nested search result and allow its category to render.
 * @param parents - Ancestor keys from outermost to innermost.
 */
const selectResult = async (parents: string[]) => {
  wrapper
    .findComponent({ name: "SettingsSearch" })
    .vm.$emit("select", "services", "lastfmAccount", parents);
  await nextTick();
  await vi.advanceTimersByTimeAsync(100);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("settings search-result navigation", () => {
  it("switches category, scrolls to the nested child, and highlights only that child", async () => {
    mountContent([
      {
        key: "lastfmEnabled",
        type: "switch",
        children: [{ key: "lastfmAccount", type: "switch" }],
      },
    ]);
    await selectResult(["lastfmEnabled"]);
    const highlighted = wrapper.findAll(".animate-highlight-pulse");
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].element.parentElement?.id).toBe("setting-lastfmAccount");
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: "center", behavior: "smooth" });
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("setting-lastfmAccount"));
    await vi.advanceTimersByTimeAsync(2500);
    expect(wrapper.find(".animate-highlight-pulse").exists()).toBe(false);
  });

  it("highlights the nearest rendered ancestor when a child is collapsed", async () => {
    mountContent([
      {
        key: "appearanceStyle",
        type: "switch",
        children: [
          {
            key: "lastfmEnabled",
            type: "switch",
            hideChildren: true,
            childrenCondition: () => false,
            children: [{ key: "lastfmAccount", type: "switch" }],
          },
        ],
      },
    ]);
    await selectResult(["appearanceStyle", "lastfmEnabled"]);
    expect(document.getElementById("setting-lastfmAccount")).toBeNull();
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("setting-lastfmEnabled"));
    expect(wrapper.find(".animate-highlight-pulse").element.parentElement?.id).toBe(
      "setting-lastfmEnabled",
    );
  });

  it("falls back through multiple collapsed ancestors without changing their values", async () => {
    const condition = vi.fn(() => false);
    mountContent([
      {
        key: "appearanceStyle",
        type: "switch",
        hideChildren: true,
        childrenCondition: condition,
        children: [
          {
            key: "lastfmEnabled",
            type: "switch",
            children: [{ key: "lastfmAccount", type: "switch" }],
          },
        ],
      },
    ]);
    await selectResult(["appearanceStyle", "lastfmEnabled"]);
    expect(document.getElementById("setting-lastfmEnabled")).toBeNull();
    expect(scrollIntoView.mock.contexts[0]).toBe(
      document.getElementById("setting-appearanceStyle"),
    );
    expect(wrapper.find(".animate-highlight-pulse").element.parentElement?.id).toBe(
      "setting-appearanceStyle",
    );
    expect(condition).toHaveReturnedWith(false);
  });
});
