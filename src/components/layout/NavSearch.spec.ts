/* eslint-disable vue/one-component-per-file -- Small renderer fixtures share the same router. */
import { defineComponent, h } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { createI18n } from "vue-i18n";
import { describe, expect, it } from "vitest";
import en from "@/i18n/locales/en-US.json";
import { PAGE_SEARCH_SCOPES } from "@/utils/search/match";
import { usePageSearch } from "@/composables/usePageSearch";
import NavSearch from "./NavSearch.vue";

const Input = defineComponent({
  props: { modelValue: String, placeholder: String },
  emits: ["update:modelValue", "search"],
  setup:
    (props, { emit }) =>
    () =>
      h("div", [
        h("input", {
          value: props.modelValue,
          placeholder: props.placeholder,
          onInput: (event: Event) =>
            emit("update:modelValue", (event.target as HTMLInputElement).value),
        }),
        h(
          "button",
          { type: "button", "data-clear": "", onClick: () => emit("update:modelValue", "") },
          "Clear",
        ),
        h(
          "button",
          { type: "button", "data-paste": "", onClick: () => emit("search", "Pasted Song") },
          "Paste and Search",
        ),
      ]),
});
const Page = defineComponent({
  setup() {
    const filter = usePageSearch();
    return () => h("output", filter.value);
  },
});

/**
 * Mount the actual navigation search against an in-memory router.
 * @param path - Initial route including query text.
 * @returns The search wrapper, router, and mounted scoped filter consumer.
 */
const setup = async (path = "/") => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "home", component: Page },
      { path: "/search", name: "search", component: Page },
      ...Object.keys(PAGE_SEARCH_SCOPES).map((name) => ({
        path: `/${name}`,
        name,
        component: Page,
      })),
    ],
  });
  await router.push(path);
  const Host = defineComponent({ setup: () => () => h("div", [h(NavSearch), h(Page)]) });
  const wrapper = mount(Host, {
    global: {
      plugins: [router, createI18n({ legacy: false, locale: "en-US", messages: { "en-US": en } })],
      stubs: { NavSearchInput: Input },
    },
  });
  const page = wrapper.findComponent(Page);
  await flushPromises();
  return { wrapper, router, page };
};

describe("navigation search", () => {
  it("submits global search from Home without selecting Home as the result route", async () => {
    const { wrapper, router } = await setup();
    expect(wrapper.get("input").attributes("placeholder")).toBe("Search all music…");
    await wrapper.get("input").setValue(" Night ");
    expect(router.currentRoute.value.name).toBe("home");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(router.currentRoute.value).toMatchObject({ name: "search", query: { q: "Night" } });
    wrapper.unmount();
  });
  it("clears the query and category immediately when X is clicked", async () => {
    const { wrapper, router } = await setup("/search?q=Night&category=songs&genre=Pop");
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("Night");
    await wrapper.get("[data-clear]").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("search");
    expect(router.currentRoute.value.query).toEqual({});
    wrapper.unmount();
  });
  it("uses the submitted paste value instead of the previous model value", async () => {
    const { wrapper, router } = await setup("/search?q=Old");
    await wrapper.get("[data-paste]").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query.q).toBe("Pasted Song");
    wrapper.unmount();
  });
  it.each(Object.keys(PAGE_SEARCH_SCOPES))(
    "filters %s in place and clears its scoped results",
    async (name) => {
      const { wrapper, router, page } = await setup(`/${name}?tab=albums`);
      await wrapper.get("input").setValue("Artist");
      await flushPromises();
      expect(router.currentRoute.value).toMatchObject({
        name,
        query: { tab: "albums", filter: "Artist" },
      });
      expect(page.text()).toBe("Artist");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe(name);
      await wrapper.get("[data-clear]").trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.query).toEqual({ tab: "albums" });
      expect(page.text()).toBe("");
      wrapper.unmount();
    },
  );
  it.each(["year-list", "year"])(
    "uses song search on %s without changing the selected year",
    async (name) => {
      const { wrapper, router } = await setup(`/${name}`);
      expect(wrapper.get("input").attributes("placeholder")).toBe("Search songs in this year…");
      await wrapper.get("input").setValue("newer");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe(name);
      expect(router.currentRoute.value.query.filter).toBe("newer");
      wrapper.unmount();
    },
  );
  it("restores query text through back/forward navigation and resets it when changing pages", async () => {
    const { wrapper, router } = await setup("/search?q=First");
    await router.push("/search?q=Second");
    await flushPromises();
    router.back();
    await flushPromises();
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("First");
    router.forward();
    await flushPromises();
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("Second");
    await router.push("/album-list");
    await flushPromises();
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("");
    expect(wrapper.get("input").attributes("placeholder")).toBe("Search albums…");
    wrapper.unmount();
  });
});
