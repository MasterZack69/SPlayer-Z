import { useSettingsStore } from "@/stores/settings";

/** Viewport threshold for compact content */
const COMPACT_QUERY = "(max-width: 1023.98px)";
/** Viewport threshold for automatic sidebar collapse */
const SIDEBAR_QUERY = "(max-width: 1199.98px)";

/**
 * Shared responsive layout state
 * @returns Compact layout and effective sidebar state
 */
export const useResponsiveLayout = () => {
  const settings = useSettingsStore();
  const isCompact = useMediaQuery(COMPACT_QUERY);
  const isNarrow = useMediaQuery(SIDEBAR_QUERY);

  /** Collapse the sidebar in narrow windows without changing the saved preference */
  const sidebarCollapsed = computed(() => settings.appearance.sidebarCollapsed || isNarrow.value);

  return { isCompact, isNarrow, sidebarCollapsed };
};
