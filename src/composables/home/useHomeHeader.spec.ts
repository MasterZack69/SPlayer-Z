import { defineComponent } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/locales/en-US.json";
import { useHomeHeader } from "./useHomeHeader";

afterEach(() => vi.useRealTimers());

describe("Home greeting", () => {
  it("keeps the greeting and summary without random subtitles or history requests", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 16, 15, 0));
    const summary = vi
      .fn()
      .mockResolvedValue({ weekListenedMs: 3600000, weekFavoriteAdds: 2, streakDays: 3 });
    Object.assign(window, { api: { stats: { getStatsSummary: summary } } });
    let header: ReturnType<typeof useHomeHeader>;
    const wrapper = mount(
      defineComponent({
        setup() {
          header = useHomeHeader();
          void header.load();
          return () => header.greetingTitle.value;
        },
      }),
      {
        global: {
          plugins: [createI18n({ legacy: false, locale: "en-US", messages: { "en-US": en } })],
        },
      },
    );
    await flushPromises();
    expect(wrapper.text()).toBe("Good afternoon");
    expect(header!).not.toHaveProperty("greetingSub");
    expect(header!.headerStats.value.map(({ value }) => value)).toEqual(["1.0", "2", "3"]);
    expect(summary).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
});
