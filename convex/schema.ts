import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { usageEventType } from "./validators";

export default defineSchema({
  analytics: defineTable({
    key: v.string(),
    totalSessions: v.number(),
    totalPageViews: v.number(),
    totalSearches: v.number(),
    totalFilterChanges: v.number(),
    totalClearFilterActions: v.number(),
    totalOutboundClicks: v.number(),
    lastEventAt: v.number(),
  }).index("by_key", ["key"]),

  sessions: defineTable({
    sessionId: v.string(),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    firstPath: v.string(),
    lastPath: v.string(),
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  })
    .index("by_session_id", ["sessionId"])
    .index("by_last_seen_at", ["lastSeenAt"]),

  searchTerms: defineTable({
    query: v.string(),
    normalizedQuery: v.string(),
    count: v.number(),
    lastSearchedAt: v.number(),
  })
    .index("by_normalized_query", ["normalizedQuery"])
    .index("by_count", ["count"]),

  usageEvents: defineTable({
    clientEventId: v.string(),
    sessionId: v.string(),
    eventType: usageEventType,
    path: v.string(),
    createdAt: v.number(),
    referrer: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
    cfpFilter: v.optional(v.string()),
    yearFilter: v.optional(v.string()),
    selectedFields: v.optional(v.array(v.string())),
    conferenceNo: v.optional(v.number()),
    conferenceName: v.optional(v.string()),
    targetUrl: v.optional(v.string()),
  })
    .index("by_client_event_id", ["clientEventId"])
    .index("by_created_at", ["createdAt"])
    .index("by_session_created_at", ["sessionId", "createdAt"])
    .index("by_event_type", ["eventType"]),
});
