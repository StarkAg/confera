import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import conferenceMarkdown from "../full.md?raw";
import { api } from "../convex/_generated/api";
import { UsageOverview } from "@/components/usage-overview";
import { EntryStamp, RoundStamp, StampFilters } from "@/components/stamps";
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

const NOW = new Date();
const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
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
const GENERATED_ON = (conferenceMarkdown.match(/Generated on: (\d{4}-\d{2}-\d{2})/) || [])[1] || null;

// Short names for the six fields most students pick; the rest use IEEE's own wording.
const FIELD_SHORT: Record<string, string> = {
  "Computing and Processing": "Computing",
  "Communication, Networking and Broadcast Technologies": "Communication",
  "Signal Processing and Analysis": "Signal processing",
  "Components, Circuits, Devices and Systems": "Circuits and devices",
  "Power, Energy and Industry Applications": "Power and energy",
  "Robotics and Control Systems": "Robotics and control",
};

function acronymOf(conference: Conference) {
  return (conference.conference.match(/\(([^()]+)\)\s*$/) || [])[1] || "";
}

function startDateOf(conference: Conference) {
  const start = conference.dates.split(" to ")[0];
  const date = start ? new Date(`${start}T00:00:00`) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

// A small, stable tilt per conference so a page of stamps never looks machine-set.
const tilt = (no: number) => ((no * 37) % 9) - 4;

// The desk layout: where each of the first seven stamps lands, and its tilt.
const DESK_SPOTS: Array<[number, number, number]> = [
  [4, 4, -8], [44, 0, 6], [70, 28, -4], [8, 42, 9], [44, 38, -12], [22, 70, 4], [62, 68, -6],
];

function tagWords(tag: string, conference: Conference) {
  if (tag === "SRM Easy") return { text: "Present from KTR", tone: "easy" };
  if (tag === "Deadline Soon") {
    const left = daysUntil(conference.cfpDate) ?? 0;
    return { text: left === 0 ? "Closes today" : `Closes in ${left} day${left === 1 ? "" : "s"}`, tone: "soon" };
  }
  if (tag === "Your Field") return { text: "Your field", tone: "" };
  return { text: tag, tone: "" };
}

// "26–27 Feb 2027", "30 Jan – 2 Feb 2027", "29 Dec 2026 – 2 Jan 2027".
function humanDates(range: string) {
  const [a, b] = range.split(" to ").map((part) => (part ? new Date(`${part}T00:00:00`) : null));
  if (!a || Number.isNaN(a.getTime())) return range || "Dates not listed";
  const full = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (!b || Number.isNaN(b.getTime()) || b.getTime() === a.getTime()) return full(a);
  if (a.getFullYear() !== b.getFullYear()) return `${full(a)} – ${full(b)}`;
  if (a.getMonth() !== b.getMonth()) {
    return `${a.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${full(b)}`;
  }
  return `${a.getDate()}–${full(b)}`;
}

function isUrgent(conference: Conference) {
  const left = daysUntil(conference.cfpDate);
  return left !== null && left >= 0 && left <= 7;
}

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

  const openConferences = CONFERENCES.filter((conference) => getDeadlineStatus(conference) === "open");
  const closingThisWeek = openConferences.filter(isUrgent).length;
  const openHybrid = openConferences.filter((conference) => getSrmTags(conference, []).includes("SRM Easy")).length;
  const deskStamps = filtered.filter((conference) => getDeadlineStatus(conference) === "open").slice(0, DESK_SPOTS.length);
  const deskKey = `${selectedFields.join("|")}#${search}#${year}`;
  const deskRef = useRef<HTMLDivElement>(null);

  // Signature: every 4.5s one stamp on the desk is pressed again.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      const stamps = deskRef.current?.querySelectorAll<HTMLElement>(".stamp");
      if (!stamps?.length) return;
      const el = stamps[Math.floor(Math.random() * stamps.length)];
      el.classList.remove("land");
      void el.offsetWidth;
      el.style.animationDelay = "0ms";
      el.classList.add("land");
    }, 4500);
    return () => window.clearInterval(timer);
  }, []);

  function toggleField(field: string) {
    setSelectedFields((current) => (current.includes(field) ? current.filter((item) => item !== field) : [...current, field]));
  }

  function clearFilters() {
    suppressNextFilterTrackingRef.current = true;
    sendUsageEvent({ eventType: "clear_filters", cfpFilter: "open", yearFilter: "all", selectedFields: [] });
    setSearch("");
    setCfp("open");
    setYear("all");
    setSelectedFields([]);
    setFieldsExpanded(false);
  }

  function trackClick(conference: Conference) {
    sendUsageEvent({
      eventType: "conference_link_click",
      conferenceNo: conference.no,
      conferenceName: conference.conference,
      targetUrl: conference.ieeeLink ?? undefined,
    });
  }

  const updated = GENERATED_ON
    ? new Date(`${GENERATED_ON}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;
  const stampLabel = (conference: Conference) =>
    `${conference.conference}, ${conference.location || "location not listed"}, papers ${
      conference.cfpDeadline ? `due ${niceDate(conference.cfpDeadline)}` : "deadline not listed"
    }`;
  const statusOptions: Array<[ConferenceStatus | "all", string]> = [["open", "Open"], ["closed", "Closed"], ["missing", "No date"], ["all", "All"]];

  return (
    <>
      <StampFilters />
      <header className="pp-top">
        <a className="pp-mark" href="/">CONFERA</a>
        <span className="pp-meta">
          IEEE India · {CONFERENCES.length} conferences{updated ? ` · updated ${updated}` : ""}
        </span>
        <nav className="pp-links" aria-label="Site">
          {/* No public link to /admin; it still works by typing the URL. */}
          {isAdminRoute && <a className="pp-icon text" href="/">Explorer</a>}
          <a className="pp-icon" href="https://github.com/StarkAg" target="_blank" rel="noreferrer" aria-label="GitHub">
            <GitHubMark />
          </a>
          <a className="pp-icon" href="https://in.linkedin.com/in/harshxagarwal" target="_blank" rel="noreferrer" aria-label="LinkedIn">
            <LinkedInMark />
          </a>
        </nav>
      </header>

      {isAdminRoute ? (
        <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-3 pb-5 pt-8 sm:gap-6 sm:px-4 md:px-6 lg:px-8">
          <section className="rounded-[3px] border border-white/10 bg-black/20 p-5 sm:p-7 md:p-10">
            <h1 className="text-4xl font-semibold text-white sm:text-5xl">Convex Analytics</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
              Internal dashboard for Confera usage. This route is excluded from public page-view tracking so the
              metrics stay focused on the explorer.
            </p>
          </section>
          <UsageOverview />
        </main>
      ) : (
        <main>
          <section className="pp-hero" aria-labelledby="pp-h1">
            <div className="pp-copy">
              <h1 id="pp-h1">
                <span>{openConferences.length}</span> IEEE conferences in India still take papers
              </h1>
              <p className="pp-lede">
                Each stamp is one of them: where it happens and the day its call for papers closes. Pick your field and
                the page stamps the ones you can still make.
              </p>
              <fieldset className="pp-fields">
                <legend className="pp-legend">Your field</legend>
                <div className="chips">
                  {DEFAULT_FIELDS.map((field) => (
                    <button key={field} type="button" className="chip" aria-pressed={selectedFields.includes(field)} onClick={() => toggleField(field)}>
                      {FIELD_SHORT[field] ?? field}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="chip more"
                    aria-expanded={fieldsExpanded}
                    aria-controls="all-fields"
                    onClick={() => {
                      setFieldsExpanded(true);
                      document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    All {fields.length} fields
                  </button>
                </div>
              </fieldset>
              <a className="pp-cta" href="#results">
                Show my <b>{filtered.length}</b> conference{filtered.length === 1 ? "" : "s"}
              </a>
            </div>

            <div className="desk" ref={deskRef} key={deskKey} aria-label="The soonest deadlines, as stamps">
              {deskStamps.map((conference, index) => {
                const [left, top, rotate] = DESK_SPOTS[index];
                const isEntry = index % 3 === 1;
                return (
                  <a
                    key={conference.no}
                    href={conference.ieeeLink ?? "#results"}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackClick(conference)}
                    className={`stamp land ${isEntry ? "entry" : "round"}`}
                    style={{ left: `${left}%`, top: `${top}%`, ["--r" as string]: `${rotate}deg`, animationDelay: `${index * 140}ms` }}
                  >
                    {isUrgent(conference) && !isEntry && (
                      <span className="days-left" aria-hidden="true">
                        {daysUntil(conference.cfpDate) === 0 ? "LAST DAY" : `${daysUntil(conference.cfpDate)} DAYS LEFT`}
                      </span>
                    )}
                    {isEntry ? (
                      <EntryStamp
                        acronym={acronymOf(conference)}
                        city={conference.location.replace(/, India$/, "")}
                        start={startDateOf(conference)}
                        format={conference.format}
                        label={`${conference.conference}, held ${conference.dates} in ${conference.location}`}
                      />
                    ) : (
                      <RoundStamp
                        id={`desk-${conference.no}`}
                        acronym={acronymOf(conference)}
                        city={conference.location.replace(/, India$/, "")}
                        deadline={conference.cfpDate}
                        label={stampLabel(conference)}
                      />
                    )}
                  </a>
                );
              })}
            </div>
          </section>

          <p className="pp-urgency">
            <span className="soon">{closingThisWeek} close in the next 7 days.</span>
            <span>{openHybrid} are hybrid, so you can present from KTR.</span>
          </p>

          <section className="pp-results" id="results" aria-labelledby="results-h">
            <div className="pp-results-head">
              <div>
                <h2 id="results-h">Your stamps</h2>
                <p className="pp-count" aria-live="polite">
                  {filtered.length} conference{filtered.length === 1 ? "" : "s"}, soonest deadline first
                </p>
              </div>
            </div>

            <div className="pp-filters">
              <label className="search">
                Search
                <input
                  className="pp-input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, acronym, city, field or sponsor"
                />
              </label>
              <div className="seg" role="group" aria-label="Call for papers">
                {statusOptions.map(([value, text]) => (
                  <button key={value} type="button" aria-pressed={cfp === value} onClick={() => setCfp(value)}>
                    {text}
                  </button>
                ))}
              </div>
              <label>
                Year
                <select className="pp-select" value={year} onChange={(event) => setYear(event.target.value)}>
                  <option value="all">All years</option>
                  {years.map((optionYear) => (
                    <option key={optionYear} value={String(optionYear)}>{optionYear}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="pp-clear" onClick={clearFilters}>Clear</button>
            </div>

            {fieldsExpanded && (
              <div className="chips pp-allfields" id="all-fields" role="group" aria-label="All fields of interest">
                {fields.map((field) => (
                  <button key={field} type="button" className="chip" aria-pressed={selectedFields.includes(field)} onClick={() => toggleField(field)}>
                    {field}
                  </button>
                ))}
              </div>
            )}

            {filtered.length === 0 ? (
              <p className="empty">
                No conferences match {search.trim() ? `“${search.trim()}”` : "these filters"}
                {year !== "all" ? ` in ${year}` : ""}. <button type="button" onClick={clearFilters}>Clear the filters</button>
              </p>
            ) : (
              <ul className="entries">
                {filtered.map((conference) => {
                  const tags = getSrmTags(conference, selectedFields);
                  const shownFields = conference.fields.slice(0, 3);
                  const more = conference.fields.length - shownFields.length;
                  return (
                    <li key={conference.no} className="entry">
                      <span className="stamp round" style={{ ["--r" as string]: `${tilt(conference.no)}deg` }}>
                        <RoundStamp
                          id={`e-${conference.no}`}
                          acronym={acronymOf(conference)}
                          city={conference.location.replace(/, India$/, "")}
                          deadline={conference.cfpDate}
                          label={stampLabel(conference)}
                        />
                      </span>
                      <div>
                        <h3>{conference.conference}</h3>
                        <p className="where">
                          {humanDates(conference.dates)} · {conference.location || "Location not listed"} ·{" "}
                          {conference.format === "inperson" ? "in person" : conference.format || "format not listed"}
                        </p>
                        {tags.length > 0 && (
                          <ul className="tags">
                            {tags.map((tag) => {
                              const word = tagWords(tag, conference);
                              return <li key={tag} className={word.tone}>{word.text}</li>;
                            })}
                          </ul>
                        )}
                        <p className="fields-line">
                          {shownFields.join(" · ")}
                          {more > 0 ? ` · ${more} more` : ""}
                        </p>
                        <div className="entry-foot">
                          <p className="sponsors">{conference.sponsors.join(", ") || "Sponsors not listed"}</p>
                          {conference.ieeeLink && (
                            <a className="ieee-link" href={conference.ieeeLink} target="_blank" rel="noreferrer" onClick={() => trackClick(conference)}>
                              IEEE page
                            </a>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="pp-gpt">
              <div>
                <h2>Let ChatGPT shortlist for you</h2>
                <p>
                  {copyState === "error"
                    ? "Copy failed. Try again in a normal browser tab."
                    : "Copies all conferences with deadlines, fields, formats, sponsors and IEEE links. Paste it with your research topic."}
                </p>
              </div>
              <button type="button" onClick={handleCopyConferenceData}>
                {copyState === "copied" ? "Copied" : `Copy all ${CONFERENCES.length} for ChatGPT`}
              </button>
            </div>
          </section>
        </main>
      )}

      <footer className="pp-foot">
        <span>From IEEE's public conference search, refreshed every morning.</span>
        <span>Built by Stark, a GradeX product.</span>
      </footer>
    </>
  );
}
