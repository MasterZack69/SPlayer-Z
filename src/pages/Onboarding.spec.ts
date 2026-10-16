import { createApp, nextTick, watch } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import persistedState from "pinia-plugin-persistedstate";
import { createRouter, createMemoryHistory } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
  Object.assign(window, { api: { system: { platform: "linux" } } });
});
vi.mock("@/components/settings/custom/StorageManager.vue", () => ({
  default: { name: "StorageManager", template: "<div />" },
}));
vi.mock("@/components/onboarding/StepPreferences.vue", () => ({
  default: { name: "StepPreferences", template: "<div />" },
}));
vi.mock("@/components/onboarding/StepAgreement.vue", () => ({
  default: { name: "StepAgreement", template: "<div />" },
}));
vi.mock("@/components/onboarding/StepLibrary.vue", () => ({
  default: { name: "StepLibrary", template: "<div />" },
}));
vi.mock("@/components/onboarding/StepStreaming.vue", () => ({
  default: { name: "StepStreaming", template: "<div />" },
}));
vi.mock("@/components/onboarding/StepHotkeys.vue", () => ({
  default: { name: "StepHotkeys", template: "<div />" },
}));
vi.mock("@/components/layout/WindowControls.vue", () => ({
  default: { name: "WindowControls", template: "<div />" },
}));
import Onboarding from "./Onboarding.vue";
import StepLanguage from "@/components/onboarding/StepLanguage.vue";
import StepWelcome from "@/components/onboarding/StepWelcome.vue";
import { useSettingsStore } from "@/stores/settings";
import i18n from "@/i18n";
import generalCategory from "@/settings/categories/general";
import { getLocale, setLocale, t as mainText } from "../../electron/main/utils/i18n";

const initialRendererLocale = i18n.global.locale.value;
const initialMainLocale = getLocale();

beforeEach(() => {
  localStorage.clear();
  i18n.global.locale.value = "en-US";
  setLocale("en-US");
  Object.assign(window, {
    api: {
      window: {
        onTaskbarLyricVisibilityChange: () => () => {},
        isTaskbarLyricOpen: async () => false,
      },
      config: { set: vi.fn().mockResolvedValue(undefined) },
    },
  });
});

afterEach(() => localStorage.clear());

/** Create a settings store with the application's real persistence plugin. */
const createSettings = () => {
  const pinia = createPinia();
  pinia.use(persistedState);
  createApp({}).use(pinia);
  setActivePinia(pinia);
  return { pinia, settings: useSettingsStore() };
};

describe("English-first setup", () => {
  it("defaults renderer, settings reset, and main-process labels to English", () => {
    const { settings } = createSettings();
    expect(settings.locale).toBe("en-US");
    expect(initialRendererLocale).toBe("en-US");
    expect(initialMainLocale).toBe("en-US");
    expect(i18n.global.locale.value).toBe("en-US");
    expect(getLocale()).toBe("en-US");
    expect(mainText("quit")).toBe("Quit");
    expect(generalCategory.sections?.[0].items[0].defaultValue).toBe("en-US");
  });

  it("does not overwrite an existing user's saved language", () => {
    localStorage.setItem("settings", JSON.stringify({ locale: "zh-CN" }));
    expect(createSettings().settings.locale).toBe("zh-CN");
  });

  it("shows language selection before welcome and saves the choice immediately", async () => {
    const { pinia, settings } = createSettings();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/", component: Onboarding }],
    });
    await router.push("/");
    await router.isReady();
    const stop = watch(
      () => settings.locale,
      (locale) => {
        i18n.global.locale.value = locale;
      },
    );
    const wrapper = mount(Onboarding, {
      global: {
        plugins: [pinia, router, i18n],
        stubs: {
          WindowControls: true,
          IconLucideLanguages: true,
          IconLucideArrowRight: true,
          StepWelcome: true,
          StepAgreement: true,
          StepPreferences: true,
          StepLibrary: true,
          StepStreaming: true,
          StepHotkeys: true,
          SSelect: true,
          SButton: true,
        },
      },
    });
    expect(wrapper.get("h1").text()).toBe("Choose your language");
    expect(wrapper.text()).toContain("1 / 7");
    expect(wrapper.findComponent(StepWelcome).exists()).toBe(false);
    wrapper.findComponent({ name: "SSelect" }).vm.$emit("update:modelValue", "zh-CN");
    await nextTick();
    expect(settings.locale).toBe("zh-CN");
    expect(wrapper.get("h1").text()).toBe("选择语言");
    expect(JSON.parse(localStorage.getItem("settings")!).locale).toBe("zh-CN");
    wrapper.getComponent(StepLanguage).vm.$emit("next");
    await flushPromises();
    expect(wrapper.findComponent(StepWelcome).exists()).toBe(true);
    expect(wrapper.findComponent(StepLanguage).exists()).toBe(false);
    wrapper.unmount();
    stop();
  });
});
