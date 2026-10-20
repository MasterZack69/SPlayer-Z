import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it, vi } from "vitest";
import CoverCard from "./CoverCard.vue";
import SImg from "../ui/SImg.vue";
import { captureCover } from "@/services/coverTransition";

vi.mock("@/services/coverTransition", () => ({ captureCover: vi.fn() }));

/** Render a playable genre/album card with the fork's original play action intact. */
const mountCard = () =>
  mount(CoverCard, {
    props: {
      item: { id: "genre-1", title: "Pop", cover: "thumb.jpg", trackCount: 3 },
      playable: true,
    },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: "en-US",
          messages: { "en-US": { songList: { context: { play: "Play" } } } },
        }),
      ],
      components: { SImg },
      stubs: { IconLucidePlay: true, IconLucideUser: true },
    },
  });

describe("shared cover card actions", () => {
  it("plays the card without navigating or capturing a transition", async () => {
    const wrapper = mountCard();
    await wrapper.get('[role="button"]').trigger("click");
    expect(wrapper.emitted("play")).toHaveLength(1);
    expect(wrapper.emitted("click")).toBeUndefined();
    expect(captureCover).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("captures a stable cover identity before navigating", async () => {
    const wrapper = mountCard();
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
    expect(captureCover).toHaveBeenCalledWith(wrapper.props("item"), "default:genre-1");
    expect(wrapper.find('[data-cover-key="default:genre-1"]').exists()).toBe(true);
    wrapper.unmount();
  });
});
