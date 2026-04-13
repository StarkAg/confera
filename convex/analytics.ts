import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { usageEventArgs } from "./validators";

const GLOBAL_ANALYTICS_KEY = "global";
const DAY_MS = 1000 * 60 * 60 * 24;

export const track = mutation({
  args: usageEventArgs,
  returns: v.object({
    recorded: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existingEvent = await ctx.db
      .query("usageEvents")
      .withIndex("by_client_event_id", (q) => q.eq("clientEventId", args.clientEventId))
      .unique();

    if (existingEvent) {
      return { recorded: false };
    }

    const now = Date.now();
    const trimmedSearch = args.searchQuery?.trim();
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    let createdNewSession = false;

    if (session) {
      const sessionPatch: {
        lastSeenAt: number;
        lastPath: string;
        referrer?: string;
        userAgent?: string;
      } = {
        lastSeenAt: now,
        lastPath: args.path,
      };

      if (args.referrer) {
        sessionPatch.referrer = args.referrer;
      }
      if (args.userAgent) {
        sessionPatch.userAgent = args.userAgent;
      }

      await ctx.db.patch(session._id, sessionPatch);
    } else {
      createdNewSession = true;
      await ctx.db.insert("sessions", {
        sessionId: args.sessionId,
        firstSeenAt: now,
        lastSeenAt: now,
        firstPath: args.path,
        lastPath: args.path,
        ...(args.referrer ? { referrer: args.referrer } : {}),
        ...(args.userAgent ? { userAgent: args.userAgent } : {}),
      });
    }

    const analytics = await ctx.db
      .query("analytics")
      .withIndex("by_key", (q) => q.eq("key", GLOBAL_ANALYTICS_KEY))
      .unique();

    const nextTotals = {
      key: GLOBAL_ANALYTICS_KEY,
      totalSessions: analytics?.totalSessions ?? 0,
      totalPageViews: analytics?.totalPageViews ?? 0,
      totalSearches: analytics?.totalSearches ?? 0,
      totalFilterChanges: analytics?.totalFilterChanges ?? 0,
      totalClearFilterActions: analytics?.totalClearFilterActions ?? 0,
      totalOutboundClicks: analytics?.totalOutboundClicks ?? 0,
      lastEventAt: now,
    };

    if (createdNewSession) {
      nextTotals.totalSessions += 1;
    }

    if (args.eventType === "page_view") {
      nextTotals.totalPageViews += 1;
    }
    if (args.eventType === "search") {
      nextTotals.totalSearches += 1;
    }
    if (args.eventType === "filters_changed") {
      nextTotals.totalFilterChanges += 1;
    }
    if (args.eventType === "clear_filters") {
      nextTotals.totalClearFilterActions += 1;
    }
    if (args.eventType === "conference_link_click") {
      nextTotals.totalOutboundClicks += 1;
    }

    if (analytics) {
      await ctx.db.patch(analytics._id, nextTotals);
    } else {
      await ctx.db.insert("analytics", nextTotals);
    }

    if (trimmedSearch) {
      const normalizedQuery = trimmedSearch.toLowerCase();
      const existingSearch = await ctx.db
        .query("searchTerms")
        .withIndex("by_normalized_query", (q) => q.eq("normalizedQuery", normalizedQuery))
        .unique();

      if (existingSearch) {
        await ctx.db.patch(existingSearch._id, {
          count: existingSearch.count + 1,
          lastSearchedAt: now,
          query: trimmedSearch,
        });
      } else {
        await ctx.db.insert("searchTerms", {
          query: trimmedSearch,
          normalizedQuery,
          count: 1,
          lastSearchedAt: now,
        });
      }
    }

    await ctx.db.insert("usageEvents", {
      clientEventId: args.clientEventId,
      sessionId: args.sessionId,
      eventType: args.eventType,
      path: args.path,
      createdAt: now,
      ...(args.referrer ? { referrer: args.referrer } : {}),
      ...(trimmedSearch ? { searchQuery: trimmedSearch } : {}),
      ...(args.cfpFilter ? { cfpFilter: args.cfpFilter } : {}),
      ...(args.yearFilter ? { yearFilter: args.yearFilter } : {}),
      ...(args.selectedFields ? { selectedFields: args.selectedFields } : {}),
      ...(typeof args.conferenceNo === "number" ? { conferenceNo: args.conferenceNo } : {}),
      ...(args.conferenceName ? { conferenceName: args.conferenceName } : {}),
      ...(args.targetUrl ? { targetUrl: args.targetUrl } : {}),
    });

    return { recorded: true };
  },
});

export const overview = query({
  args: {},
  returns: v.object({
    totals: v.object({
      sessions: v.number(),
      pageViews: v.number(),
      searches: v.number(),
      filterChanges: v.number(),
      clearFilterActions: v.number(),
      outboundClicks: v.number(),
    }),
    active: v.object({
      last24h: v.number(),
      last7d: v.number(),
    }),
    topSearches: v.array(
      v.object({
        query: v.string(),
        count: v.number(),
      }),
    ),
    recentEvents: v.array(
      v.object({
        eventType: v.string(),
        createdAt: v.number(),
        searchQuery: v.optional(v.string()),
        conferenceName: v.optional(v.string()),
        cfpFilter: v.optional(v.string()),
        yearFilter: v.optional(v.string()),
        selectedFieldCount: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const analytics = await ctx.db
      .query("analytics")
      .withIndex("by_key", (q) => q.eq("key", GLOBAL_ANALYTICS_KEY))
      .unique();

    const activeLast24h = await ctx.db
      .query("sessions")
      .withIndex("by_last_seen_at", (q) => q.gte("lastSeenAt", now - DAY_MS))
      .collect();

    const activeLast7d = await ctx.db
      .query("sessions")
      .withIndex("by_last_seen_at", (q) => q.gte("lastSeenAt", now - DAY_MS * 7))
      .collect();

    const topSearches = await ctx.db
      .query("searchTerms")
      .withIndex("by_count")
      .order("desc")
      .take(5);

    const recentEvents = await ctx.db
      .query("usageEvents")
      .withIndex("by_created_at")
      .order("desc")
      .take(8);

    return {
      totals: {
        sessions: analytics?.totalSessions ?? 0,
        pageViews: analytics?.totalPageViews ?? 0,
        searches: analytics?.totalSearches ?? 0,
        filterChanges: analytics?.totalFilterChanges ?? 0,
        clearFilterActions: analytics?.totalClearFilterActions ?? 0,
        outboundClicks: analytics?.totalOutboundClicks ?? 0,
      },
      active: {
        last24h: activeLast24h.length,
        last7d: activeLast7d.length,
      },
      topSearches: topSearches.map((item) => ({
        query: item.query,
        count: item.count,
      })),
      recentEvents: recentEvents.map((event) => ({
        eventType: event.eventType,
        createdAt: event.createdAt,
        searchQuery: event.searchQuery,
        conferenceName: event.conferenceName,
        cfpFilter: event.cfpFilter,
        yearFilter: event.yearFilter,
        selectedFieldCount: event.selectedFields?.length ?? 0,
      })),
    };
  },
});
