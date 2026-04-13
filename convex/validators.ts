import { v } from "convex/values";

export const usageEventType = v.union(
  v.literal("page_view"),
  v.literal("search"),
  v.literal("filters_changed"),
  v.literal("clear_filters"),
  v.literal("conference_link_click"),
);

export const usageEventArgs = {
  clientEventId: v.string(),
  sessionId: v.string(),
  eventType: usageEventType,
  path: v.string(),
  referrer: v.optional(v.string()),
  userAgent: v.optional(v.string()),
  searchQuery: v.optional(v.string()),
  cfpFilter: v.optional(v.string()),
  yearFilter: v.optional(v.string()),
  selectedFields: v.optional(v.array(v.string())),
  conferenceNo: v.optional(v.number()),
  conferenceName: v.optional(v.string()),
  targetUrl: v.optional(v.string()),
};
