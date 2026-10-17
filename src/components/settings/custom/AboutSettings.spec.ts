import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { defineComponent, h } from "vue";
import { describe, expect, it, vi } from "vitest";
import english from "@/i18n/locales/en-US.json";

vi.mock("@/utils/config", () => ({
  APP_VERSION: "1.0.0",
  REPO_URL: "https://github.com/MasterZack69/SPlayer-Z",
  REPO_NAME: "SPlayer-Z",
  COMMIT_HASH: "",
  COMMIT_DATE: "",
}));
vi.mock("@/utils/url", () => ({ openExternal: vi.fn() }));
vi.mock("@/composables/useCopyText", () => ({ useCopyText: () => ({ copy: vi.fn() }) }));

/** Render UI wrapper slots without pulling in unrelated application stores. */
const wrapper = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h("div", slots.default?.()),
});

describe("About settings", () => {
  it("shows the maintainer and source details without update or community controls", async () => {
    window.electron = {
      process: { versions: { electron: "43", chrome: "150", node: "24", v8: "15" } },
    } as never;
    window.api = {
      system: { osInfo: { type: "Linux", arch: "x64", release: "test" }, openLogsDir: vi.fn() },
    } as never;
    const component = (await import("./AboutSettings.vue")).default;
    const view = mount(component, {
      global: {
        plugins: [createI18n({ legacy: false, locale: "en-US", messages: { "en-US": english } })],
        stubs: {
          SCard: wrapper,
          STag: wrapper,
          SButton: wrapper,
          SLogo: true,
          SImg: true,
          IconLucideCopy: true,
          IconLucideArrowUpRight: true,
        },
      },
    });
    expect(view.text()).toContain("SPlayer-Z");
    expect(view.text()).toContain("V1.0.0");
    expect(view.text()).toContain("MasterZack69");
    expect(view.text()).toContain("Maintainer");
    expect(view.text()).toContain(
      "special thanks to everyone who contributes to the upstream SPlayer-Next",
    );
    expect(view.text()).not.toMatch(
      /Check for Updates|Update Channel|Community|Invalid Date|unknown/,
    );
    expect(view.findAll('a[href*="/commit/"]')).toHaveLength(0);
    view.unmount();
  });
});
