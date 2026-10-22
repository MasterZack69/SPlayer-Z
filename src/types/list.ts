import type { CollectionType } from "./collection";

/** Song-list sorting fields. */
export type SortField =
  | "none"
  | "title"
  | "artist"
  | "album"
  | "year"
  | "path"
  | "duration"
  | "size"
  | "mtime"
  | "ctime"
  | "track";

/** Song-list sorting direction. */
export type SortOrder = "asc" | "desc";

/** Sorting state shared only by lists in the same page category. */
export interface SongListSortPreference {
  field: SortField;
  order: SortOrder;
}

/** Finite page categories keep persisted preferences bounded. */
export type SongListSortKey =
  | "library"
  | "years"
  | "folders"
  | "liked.local"
  | "artist"
  | "history"
  | `collection.${CollectionType}`;
