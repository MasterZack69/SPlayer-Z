import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";
import { getByPath, setByPath } from "@shared/utils/path";
import { virtualBindings } from "./virtualBindings";
import { computed, type WritableComputedRef } from "vue";

/**
 * Bind a settings control to its reactive store or IPC-backed configuration.
 * @param binding - Store and property path displayed by the control.
 * @returns A writable value for the settings component.
 */
export const useSettingModel = (binding: {
  store: "settings" | "theme";
  path: string;
}): WritableComputedRef<any> => {
  if (binding.store === "theme") {
    const store = useThemeStore();
    return computed({
      get: () => getByPath(store, binding.path),
      set: (v) => setByPath(store, binding.path, v),
    });
  }
  // 虚拟 binding
  const virtual = virtualBindings[binding.path];
  if (virtual) {
    return computed({ get: virtual.get, set: virtual.set });
  }

  const store = useSettingsStore();

  // system.* 路径需要走 IPC 持久化
  if (binding.path.startsWith("system.")) {
    const ipcPath = binding.path.slice(7);
    return computed({
      get: () => getByPath(store.system, ipcPath),
      set: (v) => store.setSystem(ipcPath, v),
    });
  }

  return computed({
    get: () => getByPath(store, binding.path),
    set: (v) => {
      setByPath(store, binding.path, v);
    },
  });
};
