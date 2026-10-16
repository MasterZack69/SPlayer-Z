# Queue

**Queue** is the current playback order, not a saved playlist. Open it from the player controls as a compact popover or inside Now Playing. Both views operate on the same queue.

## Reorder songs

- **Mouse:** Drag the handle on the right of a row to its new position.
- **Touch:** Drag the same handle with your finger.
- **Keyboard:** Focus a row's drag handle and press **Up** or **Down** to move it one position.

The full row lifts under your pointer, including its cover and artist. Nearby rows slide aside to open the destination slot, and the lifted row settles into place when released. Reduced-motion preferences disable the decorative lift and settling animation. Drag near the top or bottom of the list to scroll. Press **Escape** to cancel; losing window focus or cancelling a touch gesture also cancels the drag.

Dropping or using the arrow keys changes the order without playing the dragged song, restarting the current song, or resetting its playback position. The playing entry remains the same even when moved. Duplicate songs are separate queue entries and can be moved independently.

## Next and previous

With only one song in the queue, manually pressing Next or Previous shows **No other songs in queue** and leaves playback and its position unchanged. A paused song stays paused. Automatic end-of-track repeat still follows the selected repeat mode.

Queue thumbnails load eagerly within the virtualized row window and do not fade in again when scrolling. Track metadata updates preserve existing row identity rather than refreshing every cover when the playing song changes.

## Other actions

Click a song to start that queue entry. Use the row's remove action to remove an entry, the locate control to reveal the current entry, and the clear control to clear the queue after confirmation. Closing the panel does not clear the queue.

The updated order is persisted. Queue restoration still depends on the underlying local files or server media remaining accessible; it is not a backup of the audio files.

## For contributors

`src/composables/useQueuePanel.ts` shares actions and ordering between the popover and Now Playing. `useDragSort` handles pointer geometry, auto-scroll, cancellation, and release-click suppression. Reordering goes through `src/core/player` so queue identity, persistence, and the active index remain consistent.

Do not key queue rows by track ID alone: the same track may appear more than once. Preserve stable entry identity and focused-handle keyboard behavior when changing virtualization.
