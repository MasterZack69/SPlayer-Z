import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it } from "vitest";
import type { Track } from "@shared/types/player";
import en from "@/i18n/locales/en-US.json";
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
  it("keeps long histories scrollable and never invents points for absent years", () => {
    const wrapper = chart(Array.from({ length: 100 }, (_, i) => song(String(i), 1900 + i)));
    expect(wrapper.findAll("circle")).toHaveLength(100);
    expect(Number(wrapper.get("svg").attributes("width"))).toBe(6400);
    expect(wrapper.get("[tabindex='0']").classes()).toContain("overflow-x-auto");
    wrapper.unmount();
    const empty = chart([song("unknown")]);
    expect(empty.find("svg").exists()).toBe(false);
    empty.unmount();
  });
});
