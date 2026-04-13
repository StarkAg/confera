import { useQuery } from "convex/react";
import { Activity, ExternalLink, MousePointerClick, Search } from "lucide-react";
import { api } from "../../convex/_generated/api";

function formatRelativeTime(timestamp: number) {
  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));

  if (diffMinutes < 1) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function eventLabel(eventType: string) {
  if (eventType === "page_view") {
    return "Page view";
  }
  if (eventType === "search") {
    return "Search";
  }
  if (eventType === "filters_changed") {
    return "Filters";
  }
  if (eventType === "clear_filters") {
    return "Cleared";
  }
  if (eventType === "conference_link_click") {
    return "IEEE click";
  }
  return eventType;
}

export function UsageOverview() {
  const analytics = useQuery(api.analytics.overview);

  if (!analytics) {
    return (
      <section className="rounded-[24px] border border-white/10 bg-white/5 p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Live Usage</p>
        <p className="mt-2 text-sm text-white/65">Connecting to Convex...</p>
      </section>
    );
  }

  const cards = [
    {
      label: "Unique Sessions",
      value: analytics.totals.sessions,
      icon: Activity,
    },
    {
      label: "Page Views",
      value: analytics.totals.pageViews,
      icon: MousePointerClick,
    },
    {
      label: "Searches",
      value: analytics.totals.searches,
      icon: Search,
    },
    {
      label: "IEEE Clicks",
      value: analytics.totals.outboundClicks,
      icon: ExternalLink,
    },
  ] as const;

  return (
    <section className="rounded-[24px] border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Live Usage</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Convex Analytics</h2>
        </div>
        <p className="text-sm text-white/60">
          {analytics.active.last24h} active in 24h · {analytics.active.last7d} active in 7d
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</p>
              <Icon className="h-4 w-4 text-emerald-200/80" />
            </div>
            <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_1.4fr]">
        <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Top Searches</p>
          <div className="mt-3 flex flex-col gap-2">
            {analytics.topSearches.length === 0 && (
              <p className="text-sm text-white/55">No search traffic saved yet.</p>
            )}
            {analytics.topSearches.map((item) => (
              <div
                key={item.query}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2"
              >
                <span className="truncate text-sm text-white/75">{item.query}</span>
                <span className="text-sm font-semibold text-emerald-100">{item.count}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Recent Events</p>
          <div className="mt-3 flex flex-col gap-2">
            {analytics.recentEvents.length === 0 && (
              <p className="text-sm text-white/55">No events recorded yet.</p>
            )}
            {analytics.recentEvents.map((event, index) => (
              <div
                key={`${event.eventType}-${event.createdAt}-${index}`}
                className="rounded-xl border border-white/8 bg-white/5 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-white/85">{eventLabel(event.eventType)}</span>
                  <span className="text-xs text-white/45">{formatRelativeTime(event.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-white/60">
                  {event.searchQuery
                    ? `Query: ${event.searchQuery}`
                    : event.conferenceName
                      ? `Conference: ${event.conferenceName}`
                      : event.selectedFieldCount > 0
                        ? `${event.selectedFieldCount} field filter${event.selectedFieldCount > 1 ? "s" : ""} active`
                        : event.cfpFilter || event.yearFilter
                          ? `CFP: ${event.cfpFilter ?? "all"} · Year: ${event.yearFilter ?? "all"}`
                          : "General usage event"}
                </p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
