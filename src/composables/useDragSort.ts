import type { ComputedRef, Ref } from "vue";
import { useDragRowMotion } from "./useDragRowMotion";
import type { SVirtualListExposed } from "@/components/ui/SVirtualList.vue";

export interface DragSortOptions {
  /** SVirtualList 组件实例引用 */
  virtualListRef: Ref<SVirtualListExposed | null>;
  /** 列表项总数 */
  itemCount: ComputedRef<number>;
  /** 排序完成回调 */
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** 滚动区域顶部内边距 */
  paddingTop?: number;
  /** 触发模式: handle（手柄点击立即触发）| longpress（长按触发） */
  triggerMode?: "handle" | "longpress";
  /** 长按延迟毫秒数，默认 300 */
  longPressDelay?: number;
}

/**
 * Reorder a virtual list with lifted rows, edge scrolling and cancellable input.
 * @param options - List geometry, activation mode and reorder callback.
 */
export const useDragSort = (options: DragSortOptions) => {
  const {
    virtualListRef,
    itemCount,
    onReorder,
    paddingTop = 0,
    triggerMode = "handle",
    longPressDelay = 300,
  } = options;

  const rowMotion = useDragRowMotion(virtualListRef);
  const isDragging = ref(false);
  const draggedIndex = ref(-1);
  const targetIndex = ref(-1);
  const dropIndicator = reactive({ index: -1, position: "none" as string });
  const dragLabelData = ref<{ name: string } | null>(null);
  const dragLabelPosition = reactive({ top: 0, left: 0 });
  const suppressClick = ref(false);
  let clickResetTimer: ReturnType<typeof setTimeout> | null = null;
  let listRect: DOMRect | null = null;
  let scrollElement: HTMLElement | null = null;
  let autoScrollRafId: number | null = null;
  let autoScrollAmount = 0;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingIndex = -1;
  let pendingLabelText = "";
  let pointerStartX = 0;
  let pointerStartY = 0;
  const MOVE_THRESHOLD = 5;

  /** 从鼠标或触摸事件中提取坐标 */
  const getPointerPos = (event: MouseEvent | TouchEvent) => {
    if ("touches" in event && event.touches.length > 0) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    return { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
  };

  /**
   * Capture the selected row and attach drag listeners while the pointer is held.
   * @param event - Mouse or touch input from the handle.
   * @param index - Source queue position.
   * @param labelText - Title associated with the dragged track.
   */
  const activateDrag = (event: MouseEvent | TouchEvent, index: number, labelText: string) => {
    if (event.cancelable) event.preventDefault();
    suppressClick.value = true;
    isDragging.value = true;
    draggedIndex.value = index;
    targetIndex.value = index;
    dragLabelData.value = { name: labelText };
    const wrapper = virtualListRef.value?.wrapperRef;
    if (wrapper) listRect = wrapper.getBoundingClientRect();
    updateDragLabelPosition(event);
    rowMotion.start(index, dragLabelPosition.left, dragLabelPosition.top);
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("touchmove", handleDragMove, { passive: false });
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchend", handleDragEnd);
    window.addEventListener("touchcancel", cleanupDragState);
    window.addEventListener("blur", cleanupDragState);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportResize);
    scrollElement = virtualListRef.value?.scrollRef ?? null;
    scrollElement?.addEventListener("scroll", handleListScroll);
  };

  /** 处理拖拽移动，更新标签位置并计算目标索引 */
  const handleDragMove = (event: MouseEvent | TouchEvent) => {
    if (!isDragging.value) return;
    if (event.cancelable) event.preventDefault();
    updateDragLabelPosition(event);
    const wrapper = virtualListRef.value?.wrapperRef;
    if (wrapper) listRect = wrapper.getBoundingClientRect();
    if (!listRect) return;
    const { y: clientY } = getPointerPos(event);
    handleAutoScroll(clientY, listRect);
    calculateTargetIndex(clientY);
  };

  /** Commit the drop before releasing listeners and the drag label. */
  const handleDragEnd = () => {
    const from = draggedIndex.value;
    const to = targetIndex.value;
    rowMotion.finish(to);
    cleanupDragState();
    if (from !== to && to !== -1) onReorder(from, to);
  };

  /** Cancel a drag without changing the queue when Escape is pressed.
   * @param event - Keyboard event received while dragging.
   */
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") cleanupDragState();
  };

  /** Block the synthetic click following a drag from starting a song.
   * @param event - Click captured by the queue list.
   */
  const guardDragClick = (event: MouseEvent): void => {
    if (!suppressClick.value) return;
    event.preventDefault();
    event.stopPropagation();
  };

  /** Remove drag listeners, timers, and scrolling while suppressing the release click. */
  const cleanupDragState = () => {
    rowMotion.cancel();
    stopAutoScroll();
    cancelLongPress();
    if (clickResetTimer !== null) clearTimeout(clickResetTimer);
    if (suppressClick.value) {
      clickResetTimer = setTimeout(() => {
        suppressClick.value = false;
        clickResetTimer = null;
      }, 0);
    }
    isDragging.value = false;
    draggedIndex.value = -1;
    targetIndex.value = -1;
    dropIndicator.index = -1;
    dropIndicator.position = "none";
    dragLabelData.value = null;
    window.removeEventListener("mousemove", handleDragMove);
    window.removeEventListener("touchmove", handleDragMove);
    window.removeEventListener("mouseup", handleDragEnd);
    window.removeEventListener("touchend", handleDragEnd);
    window.removeEventListener("touchcancel", cleanupDragState);
    window.removeEventListener("blur", cleanupDragState);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("resize", handleViewportResize);
    scrollElement?.removeEventListener("scroll", handleListScroll);
    scrollElement = null;
    window.removeEventListener("mousemove", handleLongPressMove);
    window.removeEventListener("touchmove", handleLongPressMove);
    window.removeEventListener("mouseup", handleLongPressCancel);
    window.removeEventListener("touchend", handleLongPressCancel);
  };

  /** Resolve the insertion slot and refresh lifted-row motion.
   * @param clientY - Viewport pointer Y.
   * @param overrideScrollTop - Scroll position read during an auto-scroll frame.
   */
  const calculateTargetIndex = (clientY: number, overrideScrollTop?: number) => {
    if (!listRect || !virtualListRef.value) return;
    const currentScrollTop = overrideScrollTop ?? virtualListRef.value.getScrollTop();
    const relativeY = clientY - listRect.top + currentScrollTop - paddingTop;
    const dropInfo = virtualListRef.value.getDropInfoByOffset(relativeY);
    let gapIndex = dropInfo.index;
    if (dropInfo.position === "bottom") gapIndex += 1;
    const maxGap = itemCount.value;
    gapIndex = Math.max(0, Math.min(gapIndex, maxGap));
    if (gapIndex === maxGap) {
      dropIndicator.index = maxGap - 1;
      dropIndicator.position = "bottom";
    } else {
      dropIndicator.index = gapIndex;
      dropIndicator.position = "top";
    }
    let insertIndex = draggedIndex.value;
    if (draggedIndex.value < gapIndex) {
      insertIndex = gapIndex - 1;
    } else if (draggedIndex.value > gapIndex) {
      insertIndex = gapIndex;
    }
    targetIndex.value = Math.max(0, Math.min(insertIndex, maxGap - 1));
    rowMotion.move(dragLabelPosition.left, clientY, targetIndex.value);
  };

  /** Keep the insertion gap in sync with wheel scrolling while holding a row. */
  const handleListScroll = (): void => {
    if (isDragging.value) calculateTargetIndex(dragLabelPosition.top);
  };

  /** Cancel stale grab geometry after a window layout change. */
  const handleViewportResize = (): void => {
    cleanupDragState();
    rowMotion.dispose();
  };

  /** 更新拖拽标签跟随指针位置 */
  const updateDragLabelPosition = (event: MouseEvent | TouchEvent) => {
    const { x, y } = getPointerPos(event);
    dragLabelPosition.left = x;
    dragLabelPosition.top = y;
  };

  /** 检测指针是否靠近列表边缘，触发或停止自动滚动 */
  const handleAutoScroll = (clientY: number, rect: DOMRect) => {
    const edgeThreshold = 40;
    const scrollSpeed = 12;
    if (clientY < rect.top + edgeThreshold) {
      startAutoScroll(-scrollSpeed);
    } else if (clientY > rect.bottom - edgeThreshold) {
      startAutoScroll(scrollSpeed);
    } else {
      stopAutoScroll();
    }
  };

  /**
   * Scroll towards the active edge and recalculate the destination each frame.
   * @param amount - Signed pixels to scroll per animation frame.
   */
  const startAutoScroll = (amount: number) => {
    autoScrollAmount = amount;
    if (autoScrollRafId !== null) return;
    const scrollStep = () => {
      if (!isDragging.value) return stopAutoScroll();
      const list = virtualListRef.value;
      if (list?.scrollRef) {
        const scroll = list.scrollRef;
        const next = Math.max(
          0,
          Math.min(scroll.scrollTop + autoScrollAmount, scroll.scrollHeight - scroll.clientHeight),
        );
        list.scrollTo(next, "auto");
        listRect = list.wrapperRef?.getBoundingClientRect() ?? null;
        calculateTargetIndex(dragLabelPosition.top, scroll.scrollTop);
      }
      autoScrollRafId = requestAnimationFrame(scrollStep);
    };
    autoScrollRafId = requestAnimationFrame(scrollStep);
  };

  /** 停止自动滚动 */
  const stopAutoScroll = () => {
    if (autoScrollRafId !== null) {
      cancelAnimationFrame(autoScrollRafId);
      autoScrollRafId = null;
    }
  };

  /** 取消长按计时器 */
  const cancelLongPress = () => {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  /** 长按等待期间检测手指移动，超过阈值则取消 */
  const handleLongPressMove = (event: MouseEvent | TouchEvent) => {
    const { x, y } = getPointerPos(event);
    if (Math.sqrt((x - pointerStartX) ** 2 + (y - pointerStartY) ** 2) > MOVE_THRESHOLD) {
      cancelLongPress();
      window.removeEventListener("mousemove", handleLongPressMove);
      window.removeEventListener("touchmove", handleLongPressMove);
      window.removeEventListener("mouseup", handleLongPressCancel);
      window.removeEventListener("touchend", handleLongPressCancel);
    }
  };

  /** 长按等待期间释放指针，取消长按 */
  const handleLongPressCancel = () => {
    cancelLongPress();
    window.removeEventListener("mousemove", handleLongPressMove);
    window.removeEventListener("touchmove", handleLongPressMove);
    window.removeEventListener("mouseup", handleLongPressCancel);
    window.removeEventListener("touchend", handleLongPressCancel);
  };

  /**
   * Begin dragging from a primary mouse button or a single touch.
   * @param event - Input event from the drag handle.
   * @param index - Queue position being moved.
   * @param labelText - Title associated with the dragged track.
   */
  const handlePointerDown = (event: MouseEvent | TouchEvent, index: number, labelText: string) => {
    if (itemCount.value < 2 || index < 0 || index >= itemCount.value || isDragging.value) return;
    if ("button" in event && event.button !== 0) return;
    if ("touches" in event && event.touches.length !== 1) return;
    if (triggerMode === "handle") {
      activateDrag(event, index, labelText);
      return;
    }
    const { x, y } = getPointerPos(event);
    pointerStartX = x;
    pointerStartY = y;
    pendingIndex = index;
    pendingLabelText = labelText;
    cancelLongPress();
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      navigator.vibrate?.(50);
      activateDrag(event, pendingIndex, pendingLabelText);
      window.removeEventListener("mousemove", handleLongPressMove);
      window.removeEventListener("touchmove", handleLongPressMove);
      window.removeEventListener("mouseup", handleLongPressCancel);
      window.removeEventListener("touchend", handleLongPressCancel);
    }, longPressDelay);
    window.addEventListener("mousemove", handleLongPressMove);
    window.addEventListener("touchmove", handleLongPressMove, { passive: false });
    window.addEventListener("mouseup", handleLongPressCancel);
    window.addEventListener("touchend", handleLongPressCancel);
  };

  /** Cancel and release visual state when the queue leaves the visible document. */
  const handleVisibilityChange = (): void => {
    if (!document.hidden) return;
    cleanupDragState();
    rowMotion.dispose();
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);

  onUnmounted(() => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    cleanupDragState();
    rowMotion.dispose();
    if (clickResetTimer !== null) clearTimeout(clickResetTimer);
  });

  return {
    isDragging,
    guardDragClick,
    draggedIndex,
    dropIndicator,
    dragLabelData,
    dragLabelPosition,
    handlePointerDown,
    cleanupDragState,
  };
};
