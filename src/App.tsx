import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  GraduationCap,
  MapPin,
  Search,
  Telescope,
} from "lucide-react";
import conferenceMarkdown from "../full.md?raw";
import { api } from "../convex/_generated/api";
import { UsageOverview } from "@/components/usage-overview";
import { Component as EtherealShadow } from "@/components/ui/etheral-shadow";
import { getBrowserContext, getOrCreateSessionId, makeClientEventId, shouldTrackPageView } from "@/lib/usage";

type ConferenceStatus = "open" | "closed" | "missing";
type StudentPreset = "balanced" | "nearby" | "lowTravel" | "deadline";
type UsageEventType = "page_view" | "search" | "filters_changed" | "clear_filters" | "conference_link_click";

interface Conference {
  no: number;
  conference: string;
  dates: string;
  cfpDeadline: string | null;
  cfpDate: Date | null;
  location: string;
  format: string;
  fields: string[];
  sponsors: string[];
  ieeeLink: string | null;
  year: number | null;
}

const TODAY = new Date();
const DAY_MS = 1000 * 60 * 60 * 24;
const DEFAULT_FIELDS = [
  "Computing and Processing",
  "Communication, Networking and Broadcast Technologies",
  "Signal Processing and Analysis",
  "Robotics and Control Systems",
  "Components, Circuits, Devices and Systems",
  "Power, Energy and Industry Applications",
];

const LOCAL_KEYWORDS = [
  "chennai",
  "kattankulathur",
  "chengalpattu",
  "tambaram",
  "sriperumbudur",
  "melmaruvathur",
  "vellore",
  "trichy",
  "salem",
  "coimbatore",
  "erode",
  "namakkal",
  "tirunelveli",
  "madurai",
  "puducherry",
  "pondicherry",
  "tamil nadu",
];

const SOUTH_KEYWORDS = [
  "kerala",
  "karnataka",
  "andhra pradesh",
  "telangana",
  "bengaluru",
  "bangalore",
  "hyderabad",
  "kochi",
  "ernakulam",
  "palakkad",
  "thiruvananthapuram",
  "kollam",
  "guntur",
  "tirupati",
  "mysuru",
];

function parseConferenceTable(text: string): Conference[] {
  const lines = text.split("\n");
  const dataLines = lines.filter((line) => {
    const trimmed = line.trim();
    return trimmed.startsWith("|") && !trimmed.startsWith("| #") && !trimmed.startsWith("| ---") && !trimmed.startsWith("| -");
  });

  return dataLines
    .map((line) => {
      const cells = line
        .split("|")
        .map((cell) => cell.trim())
        .filter((_, index, array) => index > 0 && index < array.length - 1);

      const conference = cells[1] || "";
      const cfpRaw = (cells[3] || "").trim();
      const yearMatch = conference.match(/^(\d{4})/);

      return {
        no: Number(cells[0] || "0"),
        conference,
        dates: cells[2] || "",
        cfpDeadline: cfpRaw || null,
        cfpDate: cfpRaw ? new Date(`${cfpRaw}T00:00:00`) : null,
        location: cells[4] || "",
        format: cells[5] || "",
        fields: (cells[6] || "")
          .split(";")
          .map((field) => field.trim())
          .filter(Boolean),
        sponsors: (cells[7] || "")
          .split(";")
          .map((sponsor) => sponsor.trim())
          .filter(Boolean),
        ieeeLink: (cells[8] || "").match(/\(([^)]+)\)/)?.[1] || null,
        year: yearMatch ? Number(yearMatch[1]) : null,
      };
    })
    .filter((conference) => conference.conference);
}

function getDeadlineStatus(conf: Conference): ConferenceStatus {
  if (!conf.cfpDate || Number.isNaN(conf.cfpDate.getTime())) {
    return "missing";
  }
  return conf.cfpDate >= TODAY ? "open" : "closed";
}

function niceDate(value: string | null) {
  if (!value) {
    return "Not listed";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }
  return Math.ceil((date.getTime() - TODAY.getTime()) / DAY_MS);
}

function locationTier(location: string) {
  const normalized = location.toLowerCase();
  if (LOCAL_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "local";
  }
  if (SOUTH_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "south";
  }
  return "national";
}

function statusClass(status: ConferenceStatus) {
  if (status === "open") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (status === "closed") {
    return "border-rose-400/25 bg-rose-400/10 text-rose-200";
  }
  return "border-slate-300/20 bg-slate-300/10 text-slate-200";
}

function formatLabel(format: string) {
  if (!format) {
    return "Format not listed";
  }
  return format.charAt(0).toUpperCase() + format.slice(1);
}

function getSrmDistanceTag(location: string) {
  const normalized = location.toLowerCase();
  const distanceMap: Array<[string, string]> = [
    ["kattankulathur", "~0 km from SRM"],
    ["tambaram", "~25 km from SRM"],
    ["chengalpattu", "~35 km from SRM"],
    ["chennai", "~45 km from SRM"],
    ["sriperumbudur", "~55 km from SRM"],
    ["melmaruvathur", "~95 km from SRM"],
    ["vellore", "~140 km from SRM"],
    ["puducherry", "~155 km from SRM"],
    ["pondicherry", "~155 km from SRM"],
    ["trichy", "~330 km from SRM"],
    ["salem", "~340 km from SRM"],
    ["namakkal", "~380 km from SRM"],
    ["erode", "~400 km from SRM"],
    ["coimbatore", "~500 km from SRM"],
    ["madurai", "~460 km from SRM"],
    ["tirunelveli", "~620 km from SRM"],
    ["bangalore", "~350 km from SRM"],
    ["bengaluru", "~350 km from SRM"],
    ["hyderabad", "~630 km from SRM"],
    ["guntur", "~450 km from SRM"],
    ["kochi", "~690 km from SRM"],
    ["ernakulam", "~690 km from SRM"],
    ["palakkad", "~560 km from SRM"],
    ["kollam", "~720 km from SRM"],
    ["thiruvananthapuram", "~760 km from SRM"],
  ];

  const exactMatch = distanceMap.find(([keyword]) => normalized.includes(keyword));
  if (exactMatch) {
    return exactMatch[1];
  }

  const tier = locationTier(location);
  if (tier === "local") {
    return "~150 km from SRM";
  }
  if (tier === "south") {
    return "~350-900 km from SRM";
  }
  return "1000+ km from SRM";
}

function getSrmTags(conference: Conference, selectedFields: string[]) {
  const tags: string[] = [];
  const format = conference.format.toLowerCase();
  const daysLeft = daysUntil(conference.cfpDate);

  if (format === "hybrid" || format === "online" || format === "virtual") {
    tags.push("SRM Easy");
  } else {
    tags.push(getSrmDistanceTag(conference.location));
  }
  if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 14) {
    tags.push("Deadline Soon");
  }
  if (conference.sponsors.some((sponsor) => sponsor.toLowerCase().includes("madras section"))) {
    tags.push("IEEE Madras");
  }
  if (selectedFields.length > 0 && conference.fields.some((field) => selectedFields.includes(field))) {
    tags.push("Your Field");
  }

  return tags.slice(0, 3);
}

function buildChatGptExport(conferences: Conference[]) {
  const intro = [
    "Confera conference dataset export",
    "",
    "Prompt template for ChatGPT:",
    'My research topic is: [replace with your topic]. Use the dataset below to shortlist the best conferences for me. Rank the top options, explain why they fit the topic, prioritize open CFPs, and mention any deadline or format constraints.',
    "",
    `Total conferences: ${conferences.length}`,
    "",
    "Dataset:",
  ];

  const entries = conferences.map((conference, index) =>
    [
      `${index + 1}. ${conference.conference}`,
      `Year: ${conference.year ?? "Not listed"}`,
      `Dates: ${conference.dates || "Not listed"}`,
      `CFP Deadline: ${conference.cfpDeadline ?? "Not listed"}`,
      `Location: ${conference.location || "Not listed"}`,
      `Format: ${conference.format || "Not listed"}`,
      `Fields: ${conference.fields.length > 0 ? conference.fields.join("; ") : "Not listed"}`,
      `Sponsors: ${conference.sponsors.length > 0 ? conference.sponsors.join("; ") : "Not listed"}`,
      `IEEE Link: ${conference.ieeeLink ?? "Not listed"}`,
    ].join("\n"),
  );

  return [...intro, ...entries].join("\n\n");
}

function fallbackCopyText(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.72.5.1.68-.22.68-.49 0-.24-.01-1.05-.01-1.91-2.78.62-3.37-1.22-3.37-1.22-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.09 0-1.13.39-2.05 1.03-2.77-.11-.26-.45-1.31.1-2.73 0 0 .84-.28 2.75 1.06A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.91-1.34 2.75-1.06 2.75-1.06.55 1.42.2 2.47.1 2.73.64.72 1.03 1.64 1.03 2.77 0 3.96-2.34 4.83-4.57 5.08.36.32.68.95.68 1.92 0 1.39-.01 2.51-.01 2.85 0 .27.18.59.69.49A10.28 10.28 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
    </svg>
  );
}

function LinkedInMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M19 3A2 2 0 0 1 21 5v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14Zm-9.5 6.5H6.75V18h2.75V9.5ZM8.12 5.88a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24ZM18 12.56c0-2.67-1.42-3.91-3.32-3.91-1.53 0-2.22.84-2.6 1.43V9.5H9.33V18h2.75v-4.73c0-1.24.23-2.44 1.77-2.44 1.52 0 1.54 1.42 1.54 2.52V18H18v-5.44Z" />
    </svg>
  );
}

const CONFERENCES = parseConferenceTable(conferenceMarkdown);

export default function App() {
  const [search, setSearch] = useState("");
  const [cfp, setCfp] = useState<ConferenceStatus | "all">("open");
  const [year, setYear] = useState("all");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [fieldsExpanded, setFieldsExpanded] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const preset: StudentPreset = "balanced";
  const trackUsage = useMutation(api.analytics.track);
  const sessionIdRef = useRef<string | null>(null);
  const lastTrackedSearchRef = useRef("");
  const skipInitialFilterTrackingRef = useRef(true);
  const suppressNextFilterTrackingRef = useRef(false);

  function sendUsageEvent({
    eventType,
    clientEventId,
    searchQuery,
    cfpFilter,
    yearFilter,
    selectedFields: trackedFields,
    conferenceNo,
    conferenceName,
    targetUrl,
  }: {
    eventType: UsageEventType;
    clientEventId?: string;
    searchQuery?: string;
    cfpFilter?: string;
    yearFilter?: string;
    selectedFields?: string[];
    conferenceNo?: number;
    conferenceName?: string;
    targetUrl?: string;
  }) {
    if (typeof window === "undefined") {
      return;
    }

    const sessionId = sessionIdRef.current ?? getOrCreateSessionId();
    sessionIdRef.current = sessionId;

    const browserContext = getBrowserContext();

    void trackUsage({
      clientEventId: clientEventId ?? makeClientEventId(eventType, sessionId),
      sessionId,
      eventType,
      path: browserContext.path,
      referrer: browserContext.referrer,
      userAgent: browserContext.userAgent,
      ...(searchQuery ? { searchQuery } : {}),
      ...(cfpFilter ? { cfpFilter } : {}),
      ...(yearFilter ? { yearFilter } : {}),
      ...(trackedFields ? { selectedFields: trackedFields } : {}),
      ...(typeof conferenceNo === "number" ? { conferenceNo } : {}),
      ...(conferenceName ? { conferenceName } : {}),
      ...(targetUrl ? { targetUrl } : {}),
    }).catch(() => {});
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const path = window.location.pathname;
    if (!shouldTrackPageView(path)) {
      return;
    }

    const sessionId = sessionIdRef.current ?? getOrCreateSessionId();
    sessionIdRef.current = sessionId;

    sendUsageEvent({
      eventType: "page_view",
      clientEventId: `page_view:${sessionId}:${path}`,
    });
  }, []);

  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      lastTrackedSearchRef.current = "";
      return;
    }

    const normalizedQuery = trimmed.toLowerCase();
    const timeoutId = window.setTimeout(() => {
      if (lastTrackedSearchRef.current === normalizedQuery) {
        return;
      }

      lastTrackedSearchRef.current = normalizedQuery;
      sendUsageEvent({
        eventType: "search",
        searchQuery: trimmed,
        cfpFilter: cfp,
        yearFilter: year,
        selectedFields,
      });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    if (skipInitialFilterTrackingRef.current) {
      skipInitialFilterTrackingRef.current = false;
      return;
    }

    if (suppressNextFilterTrackingRef.current) {
      suppressNextFilterTrackingRef.current = false;
      return;
    }

    sendUsageEvent({
      eventType: "filters_changed",
      cfpFilter: cfp,
      yearFilter: year,
      selectedFields,
    });
  }, [cfp, year, selectedFields]);

  const years = [...new Set(CONFERENCES.map((conference) => conference.year).filter(Boolean))].sort((a, b) => Number(a) - Number(b));

  const fieldCounts = new Map<string, number>();
  CONFERENCES.forEach((conference) => {
    conference.fields.forEach((field) => {
      fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
    });
  });

  const fields = [...fieldCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([field]) => field);

  const filtered = CONFERENCES.filter((conference) => {
    const query = search.trim().toLowerCase();
    const acronym = (conference.conference.match(/\(([^)]+)\)\s*$/) || [])[1] || "";
    const matchesSearch =
      !query ||
      conference.conference.toLowerCase().includes(query) ||
      acronym.toLowerCase().includes(query) ||
      conference.location.toLowerCase().includes(query) ||
      conference.fields.some((field) => field.toLowerCase().includes(query)) ||
      conference.sponsors.some((sponsor) => sponsor.toLowerCase().includes(query));

    const matchesCfp = cfp === "all" || getDeadlineStatus(conference) === cfp;
    const matchesYear = year === "all" || String(conference.year) === year;
    const matchesFields =
      selectedFields.length === 0 || conference.fields.some((field) => selectedFields.includes(field));

    return matchesSearch && matchesCfp && matchesYear && matchesFields;
  }).sort((a, b) => {
    if (!a.cfpDate && !b.cfpDate) {
      return a.no - b.no;
    }
    if (!a.cfpDate) {
      return 1;
    }
    if (!b.cfpDate) {
      return -1;
    }
    return a.cfpDate.getTime() - b.cfpDate.getTime();
  });

  const stats = [
    ["Total Conferences", CONFERENCES.length],
    ["Open CFP", CONFERENCES.filter((conference) => getDeadlineStatus(conference) === "open").length],
    ["SRM Easy", CONFERENCES.filter((conference) => getSrmTags(conference, []).includes("SRM Easy")).length],
    ["Matching Results", filtered.length],
  ] as const;
  const isAdminRoute =
    typeof window !== "undefined" && (window.location.pathname === "/admin" || window.location.pathname === "/admin/");

  async function handleCopyConferenceData() {
    const exportPayload = buildChatGptExport(CONFERENCES);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(exportPayload);
      } else {
        fallbackCopyText(exportPayload);
      }
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }

    window.setTimeout(() => setCopyState("idle"), 2500);
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/65 backdrop-blur-md">
        <div className="relative flex h-13 w-full items-center justify-between px-4 sm:h-14 sm:px-5">
          <div className="flex min-w-[140px] items-center justify-start sm:min-w-[180px]">
            <span className="font-display text-xl uppercase tracking-[0.14em] text-white/85 sm:text-2xl">Confera</span>
          </div>

          <div className="absolute left-1/2 flex -translate-x-1/2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40 sm:text-[11px] sm:tracking-[0.16em]">
              a gradex product
            </span>
          </div>

          <div className="flex min-w-[180px] items-center justify-end gap-2">
            <a
              href={isAdminRoute ? "/" : "/admin"}
              className="inline-flex h-8 items-center justify-center rounded-md border border-white/10 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55 transition hover:border-white/20 hover:bg-white/5 hover:text-white/85"
            >
              {isAdminRoute ? "Explorer" : "Admin"}
            </a>
            <div className="hidden items-end text-right sm:flex sm:flex-col">
              <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-white/45">By</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-white/45">Stark</span>
            </div>
            <a
              href="https://github.com/StarkAg"
              target="_blank"
              rel="noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/45 transition hover:border-white/20 hover:bg-white/5 hover:text-white/80"
              aria-label="GitHub"
            >
              <GitHubMark />
            </a>
            <a
              href="https://in.linkedin.com/in/harshxagarwal"
              target="_blank"
              rel="noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/45 transition hover:border-white/20 hover:bg-white/5 hover:text-white/80"
              aria-label="LinkedIn"
            >
              <LinkedInMark />
            </a>
          </div>
        </div>
      </header>

      <div className="fixed inset-0 -z-10">
        <EtherealShadow
          className="h-full w-full"
          color="rgba(94, 156, 255, 0.45)"
          animation={{ scale: 90, speed: 78 }}
          noise={{ opacity: 0.7, scale: 1.15 }}
          sizing="fill"
          showTitle={false}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(7,10,16,0.26),transparent_30%),linear-gradient(180deg,rgba(5,7,12,0.48),rgba(4,6,10,0.88))]" />
      </div>

      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-3 pb-5 pt-18 sm:gap-6 sm:px-4 sm:pb-6 sm:pt-20 md:px-6 lg:px-8">
        {isAdminRoute ? (
          <>
            <section className="relative overflow-hidden rounded-[22px] border border-white/10 bg-black/35 backdrop-blur-sm sm:rounded-[28px]">
              <div className="relative z-10 p-5 sm:p-7 md:p-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/80">Live Usage</p>
                    <h1 className="mt-2 text-4xl font-semibold text-white sm:text-5xl">Convex Analytics</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
                      Internal dashboard for Confera usage. This route is excluded from public page-view tracking so the
                      metrics stay focused on the user-facing explorer.
                    </p>
                  </div>

                  <a
                    href="/"
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/12 bg-white/6 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Back to explorer
                  </a>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Data Source</p>
                    <p className="mt-2 text-lg font-semibold text-white">Convex live query</p>
                    <p className="mt-2 text-sm leading-6 text-white/60">Totals, active sessions, top searches, and recent events refresh from the backend.</p>
                  </article>
                  <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Tracking Scope</p>
                    <p className="mt-2 text-lg font-semibold text-white">Public usage only</p>
                    <p className="mt-2 text-sm leading-6 text-white/60">The `/admin` page does not emit page-view analytics, which avoids inflating the dashboard while reviewing it.</p>
                  </article>
                  <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Path</p>
                    <p className="mt-2 text-lg font-semibold text-white">/admin</p>
                    <p className="mt-2 text-sm leading-6 text-white/60">Use this route for internal monitoring while keeping the conference explorer on the root path.</p>
                  </article>
                </div>
              </div>
            </section>

            <UsageOverview />
          </>
        ) : (
          <>
        <section className="relative overflow-hidden rounded-[22px] border border-white/10 bg-black/35 backdrop-blur-sm sm:rounded-[28px]">
          <div className="relative z-10 min-h-[520px] p-4 sm:p-6 md:min-h-[420px] md:p-10">
            <div className="flex flex-wrap items-center justify-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/60 sm:justify-start sm:text-[10px]">
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-emerald-100">
                IEEE India 2026
              </span>
            </div>

            <div className="mt-10 flex justify-center md:absolute md:inset-x-10 md:top-1/2 md:mt-0 md:-translate-y-1/2">
              <div className="flex max-w-3xl flex-col items-center gap-4 text-center sm:gap-5">
                <div className="flex items-center justify-center gap-2 text-emerald-100 sm:gap-3">
                  <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-xs font-medium tracking-wide text-white/80 sm:text-sm">
                    Made to help SRM KTR students choose faster
                  </span>
                </div>
                <h1 className="font-display text-5xl uppercase leading-none tracking-[0.14em] text-white sm:text-6xl md:text-7xl">
                  Confera
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-white/78 sm:text-base md:text-lg">
                  A smarter way for SRM KTR students to discover IEEE India conferences, compare formats,
                  and shortlist the right submission opportunity before deadlines close.
                </p>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap justify-center gap-2 sm:gap-3 md:absolute md:inset-x-10 md:bottom-10 md:mt-0">
              <div className="inline-flex w-full items-center justify-center gap-2 rounded-[4px] border border-white/12 bg-black/25 px-3 py-1.5 text-xs text-white/80 sm:w-auto sm:px-4 sm:py-2 sm:text-sm">
                <Telescope className="h-4 w-4" />
                250 IEEE India conferences in one flow
              </div>
              <div className="inline-flex w-full items-center justify-center gap-2 rounded-[4px] border border-white/12 bg-black/25 px-3 py-1.5 text-xs text-white/80 sm:w-auto sm:px-4 sm:py-2 sm:text-sm">
                <MapPin className="h-4 w-4" />
                Nearby and hybrid-friendly shortlists
              </div>
              <div className="inline-flex w-full items-center justify-center gap-2 rounded-[4px] border border-white/12 bg-black/25 px-3 py-1.5 text-xs text-white/80 sm:w-auto sm:px-4 sm:py-2 sm:text-sm">
                <CalendarDays className="h-4 w-4" />
                Deadline-first ranking for quick decisions
              </div>
            </div>
          </div>
        </section>
      

      <section className="flex flex-wrap gap-3">
        {stats.map(([label, value]) => (
          <article
            key={label}
            className="min-w-[calc(50%-0.375rem)] flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm sm:min-w-[160px]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/80">AI Shortlisting</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Copy whole conference data for ChatGPT</h2>
          </div>

          <div className="flex flex-col items-start gap-2 md:items-end">
            <button
              type="button"
              onClick={handleCopyConferenceData}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/12 px-4 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/18"
            >
              {copyState === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copyState === "copied" ? "Copied for ChatGPT" : "Copy All Data"}
            </button>
            <p className="text-xs text-white/45">
              {copyState === "error"
                ? "Copy failed. Try again in a secure browser tab."
                : "Includes deadlines, fields, format, sponsors, and IEEE links."}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-3 sm:p-4 md:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
            <label className="w-full flex-1 md:min-w-[250px]">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                Search Conference
              </span>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3">
                <Search className="h-4 w-4 text-white/40" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, acronym, location, field, sponsor"
                  className="h-12 w-full bg-transparent text-base text-white outline-none placeholder:text-white/30 md:text-sm"
                />
              </div>
            </label>

            <label className="w-full flex-1 md:min-w-[170px]">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                CFP Status
              </span>
              <select
                value={cfp}
                onChange={(event) => setCfp(event.target.value as ConferenceStatus | "all")}
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-base text-white outline-none md:text-sm"
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="missing">Missing</option>
              </select>
            </label>

            <label className="w-full flex-1 md:min-w-[170px]">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                Conference Year
              </span>
              <select
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-base text-white outline-none md:text-sm"
              >
                <option value="all">All</option>
                {years.map((optionYear) => (
                  <option key={optionYear} value={String(optionYear)}>
                    {optionYear}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex w-full flex-1 flex-col justify-end md:min-w-[180px]">
              <button
                type="button"
                onClick={() => {
                  suppressNextFilterTrackingRef.current = true;
                  sendUsageEvent({
                    eventType: "clear_filters",
                    cfpFilter: "open",
                    yearFilter: "all",
                    selectedFields: [],
                  });
                  setSearch("");
                  setCfp("open");
                  setYear("all");
                  setSelectedFields([]);
                  setFieldsExpanded(false);
                }}
                className="h-12 rounded-2xl border border-white/12 bg-white/6 px-4 text-base font-semibold text-white transition hover:bg-white/10 md:text-sm"
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/80">
                SRM KTR Filters
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Shortlist by field and current deadlines</h2>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <button
              type="button"
              onClick={() => setFieldsExpanded((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Field Filters
                </p>
                <p className="mt-1 text-sm text-white/65">
                  {selectedFields.length > 0
                    ? `${selectedFields.length} field${selectedFields.length > 1 ? "s" : ""} selected`
                    : "Collapsed by default. Expand to filter by research area."}
                </p>
              </div>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/65 transition ${
                  fieldsExpanded ? "rotate-180" : ""
                }`}
              >
                <ChevronDown className="h-4 w-4" />
              </span>
            </button>

            {fieldsExpanded && (
              <div className="mt-4 flex flex-wrap gap-2">
                {fields.map((field) => {
              const active = selectedFields.includes(field);
              return (
                <button
                  key={field}
                  type="button"
                  onClick={() =>
                    setSelectedFields((current) =>
                      current.includes(field) ? current.filter((item) => item !== field) : [...current, field]
                    )
                  }
                  className={`rounded-full border px-3 py-2 text-[11px] font-medium transition sm:text-xs ${
                    active
                      ? "border-sky-300/40 bg-sky-300/15 text-sky-100"
                      : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
                  }`}
                >
                  {field}
                </button>
              );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-3 sm:p-4 md:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Results</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Conference Results</h2>
          </div>
          <p className="text-sm text-white/60">{filtered.length} shown</p>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {filtered.length === 0 && (
            <article className="rounded-3xl border border-white/10 bg-black/20 p-5 text-white/70">
              No conferences match these filters. Try broadening your search or clearing some field selections.
            </article>
          )}

          {filtered.map((conference) => {
            const status = getDeadlineStatus(conference);
            const srmTags = getSrmTags(conference, selectedFields);
            const visibleFields = conference.fields.slice(0, 4);
            const hiddenFieldCount = Math.max(conference.fields.length - visibleFields.length, 0);
            return (
              <article
                key={conference.no}
                className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20 sm:gap-4 sm:p-5"
              >
                <div className="max-w-4xl">
                  <h3 className="text-base font-semibold leading-7 text-white sm:text-lg sm:leading-8">{conference.conference}</h3>
                  <p className="mt-1 text-sm leading-5 text-white/65 sm:leading-6">
                    {conference.location || "Location not listed"} · {conference.dates || "Dates not listed"}
                  </p>
                </div>

                <div className="flex flex-wrap items-start gap-1.5 sm:gap-2">
                  <span className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] sm:px-3 sm:py-2 sm:text-xs ${statusClass(status)}`}>
                    {status}
                  </span>
                  <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/75 sm:px-3 sm:py-2 sm:text-xs">
                    {formatLabel(conference.format)}
                  </span>
                  <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/75 sm:px-3 sm:py-2 sm:text-xs">
                    Call for Papers {conference.cfpDeadline ? niceDate(conference.cfpDeadline) : "Not listed"}
                  </span>
                </div>

                {srmTags.length > 0 && (
                  <div className="flex flex-wrap items-start gap-1.5 sm:gap-2">
                    {srmTags.map((tag) => (
                      <span
                        key={`${conference.no}-${tag}`}
                        className="rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-100 sm:px-3 sm:py-2 sm:text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {visibleFields.map((field) => (
                    <span
                      key={`${conference.no}-${field}`}
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/70 sm:px-3 sm:py-2 sm:text-xs"
                    >
                      {field}
                    </span>
                  ))}
                  {hiddenFieldCount > 0 && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/55 sm:px-3 sm:py-2 sm:text-xs">
                      +{hiddenFieldCount} more
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <p className="max-w-4xl text-xs leading-5 text-white/45 sm:text-sm sm:leading-6">
                    {conference.sponsors.length > 0 ? conference.sponsors.join(", ") : "Sponsors not listed"}
                  </p>
                  {conference.ieeeLink && (
                    <a
                      href={conference.ieeeLink}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() =>
                        sendUsageEvent({
                          eventType: "conference_link_click",
                          conferenceNo: conference.no,
                          conferenceName: conference.conference,
                          targetUrl: conference.ieeeLink ?? undefined,
                        })
                      }
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
                    >
                      IEEE Page
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
          </>
        )}
      </main>
    </>
  );
}
