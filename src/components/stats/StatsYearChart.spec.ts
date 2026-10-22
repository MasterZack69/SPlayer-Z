import { mount, flushPromises } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ShallowRef } from "vue";
import type { Track } from "@shared/types/player";
import en from "@/i18n/locales/en-US.json";
const layout = vi.hoisted(() => ({ width: null as unknown as ShallowRef<number> }));
vi.mock("@vueuse/core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@vueuse/core")>();
  const { shallowRef } = await import("vue");
  layout.width = shallowRef(0);
  return { ...original, useElementSize: () => ({ width: layout.width, height: shallowRef(188) }) };
});
import StatsYearChart from "./StatsYearChart.vue";
/** Mount the chart with real year aggregation and no layout-dependent card wrapper. */
const chart = (tracks: Track[]) =>
  mount(StatsYearChart, {
    props: { tracks },
    global: {
      plugins: [createI18n({ legacy: false, locale: "en-US", messages: { "en-US": en } })],
      stubs: { SCard: { template: "<section><slot /></section>" } },
    },
  });
const song = (id: string, year?: number): Track => ({
  id,
  source: "local",
  title: id,
  artists: [],
  duration: 1000,
  year,
});
afterEach(() => {
  layout.width.value = 0;
  vi.restoreAllMocks();
});

describe("year chart", () => {
  it("renders true counts, chronological points, and missing-year coverage", () => {
    const wrapper = chart([song("a", 2024), song("b", 1999), song("c", 2024), song("d")]);
    expect(wrapper.findAll("circle title").map((title) => title.text())).toEqual([
      "1999: 1",
      "2024: 2",
    ]);
    expect(wrapper.text()).toContain("1 track without a year");
    expect(wrapper.findAll("tbody tr").map((row) => row.text())).toEqual(["19991", "20242"]);
    wrapper.unmount();
  });
  it("starts at the newest years after layout and does not reset earlier browsing", async () => {
    const wrapper = chart([song("old", 1900), song("new", 2024)]);
    layout.width.value = 400;
    await flushPromises();
    const viewport = wrapper.get("[tabindex='0']").element as HTMLElement;
    const initialEnd = Number(wrapper.get("svg").attributes("width")) - 400;
    expect(viewport.scrollLeft).toBe(initialEnd);
    await wrapper.setProps({ tracks: [song("old", 1900), song("new", 2026)] });
    expect(viewport.scrollLeft).toBe(Number(wrapper.get("svg").attributes("width")) - 400);
    viewport.scrollLeft = 120;
    await wrapper.setProps({ tracks: [song("old", 1900), song("new", 2027)] });
    expect(viewport.scrollLeft).toBe(120);
    wrapper.unmount();
  });
  it("aligns asynchronous library data to the latest edge", async () => {
    const wrapper = chart([]);
    layout.width.value = 400;
    await flushPromises();
    await wrapper.setProps({ tracks: [song("old", 1990), song("new", 2026)] });
    const viewport = wrapper.get("[tabindex='0']").element as HTMLElement;
    expect(viewport.scrollLeft).toBe(Number(wrapper.get("svg").attributes("width")) - 400);
    wrapper.unmount();
  });
  it("keeps long histories scrollable and never invents points for absent years", () => {
    const wrapper = chart(Array.from({ length: 100 }, (_, i) => song(String(i), 1900 + i)));
    expect(wrapper.findAll("circle")).toHaveLength(100);
    expect(Number(wrapper.get("svg").attributes("width"))).toBe(6400);
    expect(wrapper.get("[tabindex='0']").classes()).toContain("overflow-x-auto");
    expect(wrapper.get("[tabindex='0']").classes()).toContain("overflow-y-hidden");
    expect(wrapper.get("[tabindex='0']").classes()).toContain("scrollbar-hidden");
    expect(wrapper.get("svg").classes()).toContain("block");
    wrapper.unmount();
    const empty = chart([song("unknown")]);
    expect(empty.find("svg").exists()).toBe(false);
    empty.unmount();
  });
});

describe("year-chart wheel navigation", () => {
  it("scrolls horizontally with a mouse wheel and releases page scroll at the ends", () => {
    const wrapper = chart([song("old", 1900), song("new", 2024)]);
    const viewport = wrapper.get("[tabindex='0']").element as HTMLElement;
    Object.defineProperties(viewport, {
      clientWidth: { value: 400 },
      scrollWidth: { value: 1200 },
    });
    const wheel = (deltaY: number, ctrlKey = false) => {
      const event = new WheelEvent("wheel", { deltaY, ctrlKey, cancelable: true, bubbles: true });
      Object.defineProperty(event, "ctrlKey", { value: ctrlKey });
      viewport.dispatchEvent(event);
      return event;
    };
    expect(wheel(80).defaultPrevented).toBe(true);
    expect(viewport.scrollLeft).toBe(80);
    viewport.scrollLeft = 800;
    expect(wheel(80).defaultPrevented).toBe(false);
    expect(viewport.scrollLeft).toBe(800);
    viewport.scrollLeft = 0;
    expect(wheel(-80).defaultPrevented).toBe(false);
    expect(wheel(80, true).defaultPrevented).toBe(false);
    wrapper.unmount();
  });
});
