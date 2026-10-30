import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";
import english from "@/i18n/locales/en-US.json";
import StreamingServerList from "./StreamingServerList.vue";

const calls = vi.hoisted(() => ({
  test: vi.fn(),
  update: vi.fn(),
  add: vi.fn(),
  success: vi.fn(),
}));
vi.mock("@/composables/useToast", () => ({ toast: { success: calls.success, error: vi.fn() } }));
vi.mock("@/stores/streaming", async () => {
  const { defineStore } = await import("pinia");
  const { ref } = await import("vue");
  return {
    useStreamingStore: defineStore("streaming-form-test", () => ({
      servers: ref([
        {
          id: "server",
          name: "Music",
          type: "subsonic",
          url: "https://server",
          username: "user",
          hasPassword: true,
        },
      ]),
      activeServerId: ref(null),
      connectionStatus: ref({ connected: false }),
      testConnection: calls.test,
      updateServer: calls.update,
      addServer: calls.add,
    })),
  };
});

/** Mount the form with accessible controls and a real reactive streaming store. */
const mountForm = () =>
  mount(StreamingServerList, {
    global: {
      plugins: [
        createPinia(),
        createI18n({ legacy: false, locale: "en-US", messages: { "en-US": english } }),
      ],
      stubs: {
        SButton: {
          props: ["disabled", "loading"],
          template: '<button :disabled="disabled || loading"><slot /></button>',
        },
        SDialog: {
          props: ["open"],
          emits: ["update:open"],
          template:
            '<section v-if="open" role="dialog"><slot /><slot name="footer" :close="() => $emit(\'update:open\', false)" /></section>',
        },
        SFormItem: { props: ["label"], template: "<label>{{ label }}<slot /></label>" },
        SInput: {
          props: ["modelValue", "type"],
          emits: ["update:modelValue"],
          template:
            '<input :type="type" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        SSelect: true,
        STag: { template: "<span><slot /></span>" },
        IconLucidePlus: true,
        IconLucideEdit: true,
        IconLucideTrash: true,
        IconLucidePlugZap: true,
        IconLucideUnplug: true,
        IconLucideCheck: true,
        IconLucideServer: true,
      },
    },
  });

/**
 * Locate an action by its visible label.
 * @param view - Mounted settings form.
 * @param name - Visible action label.
 * @returns Matching button wrapper.
 */
const button = (view: ReturnType<typeof mountForm>, name: string) => {
  const result = view.findAll("button").find((item) => item.text() === name);
  if (!result) throw new Error(`Missing button: ${name}`);
  return result;
};
beforeEach(() => vi.resetAllMocks());

describe("media-server credential recovery dialog", () => {
  it("shows storage Test errors, clears stale results and allows retry", async () => {
    const view = mountForm();
    await button(view, "Edit").trigger("click");
    calls.test.mockResolvedValueOnce({
      ok: false,
      code: "storage",
      error: "Unlock your desktop keyring",
    });
    await button(view, "Test connection").trigger("click");
    await flushPromises();
    expect(view.get('[role="alert"]').text()).toContain("Credential storage error");
    expect(view.text()).toContain("Unlock your desktop keyring");
    expect(view.text()).not.toContain("Authentication failed");
    calls.test.mockRejectedValueOnce(new Error("IPC storage failure"));
    await button(view, "Test connection").trigger("click");
    await flushPromises();
    expect(view.get('[role="alert"]').text()).toContain("IPC storage failure");
    expect(view.text()).not.toContain("Unlock your desktop keyring");
    expect(button(view, "Test connection").attributes("disabled")).toBeUndefined();
    calls.test.mockResolvedValueOnce({ ok: true });
    await button(view, "Test connection").trigger("click");
    await flushPromises();
    expect(view.find('[role="alert"]').exists()).toBe(false);
    expect(view.find('[role="status"]').exists()).toBe(true);
    view.unmount();
  });

  it("keeps failed saves open, preserves the entered password and allows correction", async () => {
    const view = mountForm();
    await button(view, "Edit").trigger("click");
    await view.get('input[type="password"]').setValue("replacement");
    calls.update.mockRejectedValueOnce(new Error("Unable to securely save the password"));
    await button(view, "Save").trigger("click");
    await flushPromises();
    expect(view.find('[role="dialog"]').exists()).toBe(true);
    expect(view.get('[role="alert"]').text()).toContain("Unable to securely save");
    expect((view.get('input[type="password"]').element as HTMLInputElement).value).toBe(
      "replacement",
    );
    expect(calls.success).not.toHaveBeenCalled();
    expect(button(view, "Save").attributes("disabled")).toBeUndefined();
    calls.update.mockResolvedValueOnce({ id: "server" });
    await button(view, "Save").trigger("click");
    await flushPromises();
    expect(view.find('[role="dialog"]').exists()).toBe(false);
    expect(calls.success).toHaveBeenCalledOnce();
    view.unmount();
  });

  it("can cancel after a failed save without reporting success", async () => {
    const view = mountForm();
    await button(view, "Edit").trigger("click");
    calls.update.mockRejectedValueOnce(new Error("Keyring locked"));
    await button(view, "Save").trigger("click");
    await flushPromises();
    await button(view, "Cancel").trigger("click");
    expect(view.find('[role="dialog"]').exists()).toBe(false);
    expect(calls.success).not.toHaveBeenCalled();
    view.unmount();
  });
});
