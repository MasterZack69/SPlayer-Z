<script setup lang="ts">
import type { Component, VNode, ComponentPublicInstance } from "vue";

export interface SMenuItem {
  /** 菜单项类型 */
  type?: "item" | "divider" | "group";
  key: string;
  label?: string;
  icon?: Component;
  /** 封面 URL */
  cover?: string;
  /** 是否以封面形式展示 */
  showCover?: boolean;
  disabled?: boolean;
  /** group 类型的自定义渲染内容 */
  render?: () => VNode;
  /** item 类型的行尾自定义内容 */
  trailing?: () => VNode;
}

const props = withDefaults(
  defineProps<{
    items: SMenuItem[];
    modelValue?: string;
    /** 尺寸：small（紧凑）| medium（默认）| large（宽松） */
    size?: "small" | "medium" | "large";
    /** 折叠模式 */
    collapsed?: boolean;
    /** 挂载时把选中项滚动到可视区中间 */
    centerActiveOnMount?: boolean;
  }>(),
  { size: "medium", collapsed: false, centerActiveOnMount: false },
);

const emit = defineEmits<{
  "update:modelValue": [key: string];
  select: [key: string];
}>();

/** 各菜单项行元素，按 key 收集，用于定位选中项 */
const itemEls = new Map<string, HTMLElement>();
const setItemEl = (key: string, el: Element | ComponentPublicInstance | null): void => {
  if (el instanceof HTMLElement) itemEls.set(key, el);
  else itemEls.delete(key);
};

/** Navigation root, used as the coordinate space for the active indicator. */
const navRef = shallowRef<HTMLElement | null>(null);
/** Inline geometry of the sliding active indicator. */
const indicatorStyle = ref<Record<string, string>>({});
/** Whether the indicator has been placed once, so the first render does not slide. */
const indicatorReady = ref(false);
/** Items the indicator passes over, mapped to their shake animation delay. */
const shakingItems = ref<Record<string, string>>({});

const INDICATOR_SLIDE_MS = 320;
const SHAKE_MS = 180;
let shakeTimer: ReturnType<typeof setTimeout> | undefined;

/** Places the active indicator over the current menu item. */
const measureIndicator = (): void => {
  const active = itemEls.get(props.modelValue ?? "");
  if (!active) {
    indicatorStyle.value = {};
    return;
  }
  indicatorStyle.value = {
    transform: `translateY(${active.offsetTop + 8}px)`,
    height: `${Math.max(0, active.offsetHeight - 16)}px`,
  };
  indicatorReady.value = true;
};

/** Cancels the pass-through shake state and its cleanup timer. */
const clearShake = (): void => {
  if (shakeTimer) clearTimeout(shakeTimer);
  shakeTimer = undefined;
  shakingItems.value = {};
};

/**
 * Shakes the items between the previous and next active entries as the indicator slides.
 * @param previousKey - Previously active menu item key
 * @param nextKey - Newly active menu item key
 */
const shakePassedItems = (previousKey: string | undefined, nextKey: string | undefined): void => {
  clearShake();
  if (!previousKey || !nextKey || previousKey === nextKey) return;
  const keys = props.items
    .filter((item) => !item.type || item.type === "item")
    .map((item) => item.key);
  const from = keys.indexOf(previousKey);
  const to = keys.indexOf(nextKey);
  if (from < 0 || to < 0) return;
  const span = Math.abs(to - from);
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const delays: Record<string, string> = {};
  for (let index = start + 1; index < end; index++) {
    const ratio = Math.abs(index - from) / span;
    delays[keys[index]] = `${Math.round(ratio * (INDICATOR_SLIDE_MS - SHAKE_MS))}ms`;
  }
  if (Object.keys(delays).length === 0) return;
  // Apply after the clear has been rendered so repeated navigation restarts the animation.
  nextTick(() => {
    shakingItems.value = delays;
    shakeTimer = setTimeout(clearShake, INDICATOR_SLIDE_MS + 40);
  });
};

watch(
  () => [props.modelValue, props.items, props.collapsed, props.size],
  () => nextTick(measureIndicator),
  { immediate: true },
);

watch(
  () => props.modelValue,
  (next, previous) => {
    nextTick(() => {
      measureIndicator();
      shakePassedItems(previous, next);
    });
  },
);

onMounted(() => {
  nextTick(measureIndicator);
  useResizeObserver(navRef, () => nextTick(measureIndicator));
  if (!props.centerActiveOnMount) return;
  const key = props.modelValue;
  if (!key) return;
  nextTick(() => itemEls.get(key)?.scrollIntoView({ block: "center" }));
});

onUnmounted(clearShake);

const sizeClass = computed(() => {
  const collapsed = props.collapsed;
  switch (props.size) {
    case "small":
      return {
        item: "h-9 px-2.5 text-sm gap-2.5",
        coverItem: "h-11 px-2.5 text-sm gap-2.5",
        icon: collapsed ? "size-5" : "size-4.5",
        cover: collapsed ? "size-6" : "size-8",
      };
    case "large":
      return {
        item: "h-11 px-3.5 text-[15px] gap-3.5",
        coverItem: collapsed
          ? "h-14 px-2.5 text-[15px] gap-3.5"
          : "h-14 px-3.5 text-[15px] gap-3.5",
        icon: collapsed ? "size-6" : "size-5.5",
        cover: collapsed ? "size-7" : "size-10",
      };
    default:
      return {
        item: "h-10.5 px-3 text-sm gap-3",
        coverItem: collapsed ? "h-13 px-2.5 text-sm gap-3" : "h-13 px-3 text-sm gap-3",
        icon: collapsed ? "size-5.5" : "size-5",
        cover: collapsed ? "size-7" : "size-9",
      };
  }
});

const handleSelect = (item: SMenuItem) => {
  if (item.disabled) return;
  emit("update:modelValue", item.key);
  emit("select", item.key);
};
</script>

<template>
  <nav
    ref="navRef"
    class="relative flex flex-col gap-1"
    :style="{ '--s-menu-shake-ms': `${SHAKE_MS}ms` }"
  >
    <div
      v-if="indicatorStyle.height"
      aria-hidden="true"
      class="pointer-events-none absolute left-0 top-0 z-1 w-0.75 rounded-full bg-primary"
      :class="
        indicatorReady && 'transition-[transform,height] duration-320 ease-[cubic-bezier(0.4,0,0.2,1)]'
      "
      :style="indicatorStyle"
    />
    <template v-for="item in items" :key="item.key">
      <!-- 分隔线 -->
      <SDivider v-if="item.type === 'divider'" class="mx-1" />
      <!-- 分类标题 -->
      <div
        v-else-if="item.type === 'group' && item.render"
        class="overflow-hidden transition-[max-height,opacity] duration-300"
        :class="collapsed ? 'max-h-0 opacity-0' : 'max-h-11 opacity-100'"
      >
        <component :is="item.render" />
      </div>
      <!-- 菜单项 -->
      <STooltip
        v-else-if="!item.type || item.type === 'item'"
        :content="item.label ?? ''"
        :disabled="!collapsed"
        :side-offset="12"
        side="right"
      >
        <div
          :ref="(el) => setItemEl(item.key, el)"
          :data-menu-key="item.key"
          class="relative flex items-center rounded-lg cursor-pointer select-none overflow-hidden whitespace-nowrap transition-[background-color,color,height,padding] duration-250"
          :class="[
            item.showCover ? sizeClass.coverItem : sizeClass.item,
            modelValue === item.key
              ? 'bg-primary/10 text-primary'
              : 'text-on-surface/80 hover:bg-on-surface/5',
            item.disabled ? 'opacity-40 pointer-events-none' : '',
            shakingItems[item.key] ? 's-menu-shake' : '',
          ]"
          :style="shakingItems[item.key] ? { animationDelay: shakingItems[item.key] } : undefined"
          @click="handleSelect(item)"
        >
          <SImg
            v-if="item.showCover"
            :src="item.cover"
            :class="[
              sizeClass.cover,
              'shrink-0 rounded-md object-cover transition-[width,height] duration-300',
            ]"
          />
          <component
            :is="item.icon"
            v-else-if="item.icon"
            :class="[sizeClass.icon, 'shrink-0 transition-[width,height] duration-300']"
          />
          <span
            class="flex-1 min-w-0 truncate transition-opacity duration-300"
            :class="collapsed ? 'opacity-0' : 'opacity-100'"
          >
            {{ item.label }}
          </span>
          <!-- 行尾自定义 -->
          <div
            v-if="!collapsed && item.trailing"
            class="shrink-0 transition-opacity duration-300"
            @click.stop
          >
            <component :is="item.trailing" />
          </div>
        </div>
      </STooltip>
    </template>
  </nav>
</template>

<style scoped>
.s-menu-shake {
  animation: s-menu-shake var(--s-menu-shake-ms, 180ms) cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes s-menu-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  40% {
    transform: translateX(3px);
  }
}

:global(html[data-reduced-motion]) .s-menu-shake {
  animation: none;
}
</style>
