// Rubber stamps drawn from a conference's own data. The ink roughness comes
// from the shared #stamp-rough SVG filter rendered once by <StampFilters />.

const shortDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase();

export function StampFilters() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <filter id="stamp-rough">
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="3" />
        <feDisplacementMap in="SourceGraphic" scale="1.6" />
      </filter>
    </svg>
  );
}

type RoundStampProps = {
  id: string;
  acronym: string;
  city: string;
  deadline: Date | null;
  label: string;
};

/** Round stamp: acronym in the middle, city around the top, deadline around the bottom. */
export function RoundStamp({ id, acronym, city, deadline, label }: RoundStampProps) {
  const acr = (acronym || "IEEE").slice(0, 9);
  const size = acr.length > 7 ? 22 : acr.length > 5 ? 27 : 32;
  return (
    <svg viewBox="0 0 190 190" role="img" aria-label={label} className="stamp-svg">
      <defs>
        <path id={`${id}-top`} d="M30 95 A65 65 0 0 1 160 95" />
        <path id={`${id}-bot`} d="M22 95 A73 73 0 0 0 168 95" />
      </defs>
      <circle cx="95" cy="95" r="88" fill="none" stroke="currentColor" strokeWidth="4" />
      <circle cx="95" cy="95" r="80" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text className="stamp-small" fontSize="13" letterSpacing="2" fill="currentColor">
        <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
          {city.toUpperCase().slice(0, 22)}
        </textPath>
      </text>
      <text x="95" y={100 + size / 3} textAnchor="middle" className="stamp-big" fontSize={size} fill="currentColor">
        {acr}
      </text>
      <line x1="40" x2="150" y1="126" y2="126" stroke="currentColor" strokeWidth="1.5" />
      <text className="stamp-small" fontSize="12" letterSpacing="2" fill="currentColor">
        <textPath href={`#${id}-bot`} startOffset="50%" textAnchor="middle" dominantBaseline="hanging">
          {deadline ? `PAPERS BY ${shortDate(deadline)}` : "NO DEADLINE LISTED"}
        </textPath>
      </text>
    </svg>
  );
}

type EntryStampProps = {
  acronym: string;
  city: string;
  start: Date | null;
  format: string;
  label: string;
};

/** Rectangular entry stamp: when it happens, where, and in what format. */
export function EntryStamp({ acronym, city, start, format, label }: EntryStampProps) {
  const when = start
    ? start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
    : "DATES TBA";
  const fmt = format === "inperson" ? "IN PERSON" : (format || "format tba").toUpperCase();
  return (
    <svg viewBox="0 0 230 120" role="img" aria-label={label} className="stamp-svg">
      <rect x="3" y="3" width="224" height="114" rx="6" fill="none" stroke="currentColor" strokeWidth="4" />
      <text x="16" y="34" className="stamp-small" fontSize="12" letterSpacing="2" fill="currentColor">
        ENTRY · {fmt}
      </text>
      <text x="16" y="74" className="stamp-big" fontSize="36" fill="currentColor">
        {(acronym || "IEEE").slice(0, 12)}
      </text>
      <text x="16" y="102" className="stamp-small" fontSize="13" letterSpacing="1" fill="currentColor">
        {when} · {city.toUpperCase().slice(0, 14)}
      </text>
    </svg>
  );
}
