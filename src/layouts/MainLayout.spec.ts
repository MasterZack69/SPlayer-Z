import { defineComponent, h, onMounted } from "vue";
import { createPinia } from "pinia";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { mount, flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/stores/status", async () => {
  const { defineStore } = await import("pinia");
  return {
    useStatusStore: defineStore("layout-test-status", {
      state: () => ({ isPlayerExpanded: false }),
    }),
  };
});
vi.mock("@/stores/media", () => ({ useMediaStore: () => ({ track: null }) }));
vi.mock("@/stores/settings", () => ({
  useSettingsStore: () => ({
    reducedMotion: true,
    appearance: {
      routeTransition: "none",
      seamlessTransition: false,
      layoutMode: "default",
      sidebarCollapsed: false,
    },
  }),
}));
vi.mock("@/composables/useExternalFileHandler", () => ({ useExternalFileHandler: vi.fn() }));
vi.mock("@/services/coverTransition", async () => {
  const { ref } = await import("vue");
  return { coverTransitionActive: ref(false), installCoverTransitions: vi.fn() };
});
vi.mock("@/services/playerTransition", async () => {
  const { ref } = await import("vue");
  return {
    fullPlayerReady: ref(false),
    playerTransitionActive: ref(false),
    cancelPlayerTransition: vi.fn(),
  };
});
import MainLayout from "./MainLayout.vue";

describe("year route identity", () => {
  it("retains the mounted year browser across selection and history, but not unrelated detail routes", async () => {
    const mounted = vi.fn();
    const view = defineComponent({
      setup: () => {
        onMounted(mounted);
        return () => h("div", { "data-test-view": "" });
      },
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: "/",
          component: MainLayout,
          children: [
            { path: "years/local", name: "year-list", component: view },
            { path: "years/local/:year", name: "year", component: view },
            { path: "album/:id", name: "album", component: view },
          ],
        },
      ],
    });
    await router.push("/years/local");
    const wrapper = mount(RouterView, {
      global: {
        plugins: [createPinia(), router],
        stubs: {
          PlayerBar: true,
          SPerformanceMonitor: true,
          SideBar: true,
          NavHeader: true,
          SToast: true,
          SDialogProvider: true,
          SettingsDialog: true,
          AudioInfoDialog: true,
        },
      },
    });
    await flushPromises();
    const initial = wrapper.get("[data-test-view]").element;
    await router.push("/years/local/2022");
    await flushPromises();
    await router.push("/years/local/2021");
    await flushPromises();
    router.back();
    await flushPromises();
    expect(wrapper.get("[data-test-view]").element).toBe(initial);
    expect(mounted).toHaveBeenCalledTimes(1);
    await router.push("/album/one");
    await flushPromises();
    await router.push("/album/two");
    await flushPromises();
    expect(mounted).toHaveBeenCalledTimes(3);
    wrapper.unmount();
  });
});
