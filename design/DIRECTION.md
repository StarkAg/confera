# Confera: direction

## Brief (self-authored: the owner said "start modifying", 2026-10-24)

- **What:** Confera, a small web tool at confera.gradex.bond. It lists every
  upcoming IEEE conference held in India (297 as of 24 Oct 2026, refreshed
  daily from IEEE's public conference search) with its call-for-papers
  deadline, fields of interest, city and format.
- **For whom:** SRM KTR students (Chennai) and their guides who want to submit
  a paper to an IEEE conference and need to pick one before its deadline.
- **The one job:** in ten seconds, see which conferences are still open for
  papers in *my* field, which close soonest, and which I can attend (hybrid,
  or near Chennai). Then open the IEEE page.
- **Three words:** urgent, specific, a little wonder (finding a conference
  should feel like discovering a place, not filling a form).
- **References outside the web:** a planetarium dome, a passport full of
  stamps, a naturalist's field guide.
- **What exists:** the name Confera, the live data, the "SRM Easy / Deadline
  Soon / IEEE Madras" tags, the ChatGPT export, Convex usage analytics and the
  /admin page. No logo, no photos, no brand colours worth keeping (the current
  site is the Dark Dev Tool face with an emerald accent).
- **Image generation:** not used (no consent asked; self-authored brief).

## Imagery we can honestly get

No photographs of these conferences exist for us. The honest richness is
**the data itself** (297 real conferences, real dates, real cities, real
fields) drawn in code: as a sky, as stamps, as specimens.

## The category default we refuse

Conference listings (WikiCFP, conferenceindex.org, IEEE's own search) all
share: a white page, a long text table or result list, IEEE/academic blue,
small grey dates, no sense of time pressure. The cliché colour is IEEE blue /
navy. This brief would naturally fall into **the Dark Dev Tool** (where it is
now: dark zinc, emerald, a stats strip of counts, filter pills) or **the
shadcn Dashboard** (KPI cards "Open CFP 88 / SRM Easy 51"). The deadline
theme also pulls toward **a departure board**, which we refuse by name.

## Three concepts

| | A. Planetarium | B. Passport | C. Field guide |
|---|---|---|---|
| Sentence | Confera is a planetarium show of the year's conferences. | Confera is a passport page filling with conference stamps. | Confera is a field guide to IEEE conferences in India. |
| Family | place | object | printed |
| Ground | dark: dome night blue | colour field: passport-page apricot | paper: lichen-tinted white |
| Type | expanded (Unbounded + Hanken Grotesk) | condensed (Big Shoulders Display + Public Sans) | serif (Newsreader) |
| Accent | yellow: starlight amber = open CFP | violet: Indian rubber-stamp ink | teal: habitat ink |
| Richness | data: every conference is a star | illustration: a stamp drawn from each conference's data | shape: a specimen glyph drawn from each conference's fields |
| Grammar | single-screen tool | catalogue | document / index |
| Motion | dot field: the sky drifts, open CFPs twinkle | kinetic: stamps press onto the page | line-art: specimens draw themselves |

## Choice (explorations shot at 390 and 1440: shots/explore-a|b|c/sheet.png)

**B. Passport wins.** It is the most *this product*: the stamps are the real
data (acronym, city, "papers by 29 Oct", entry date and format), the violet is
the ink of every Indian office rubber stamp, and the field chips are the tool
itself. A student collecting conference stamps is also what a CV is.

- **A lost:** the sky is too sparse to read as data; what is left is a dark
  page with glowing dots, close to the Launch Page face, and it fails the swap
  test. Kept from it: the urgency line ("6 close before 31 October").
- **C lost:** most conferences cover two or three fields, so the specimen
  glyph reads as a stick figure; the page drifts to tasteful paper. Kept from
  it: the facts list (papers due / found in / season / habitat) for the detail
  view, and "present from KTR".

History check: `site|object|colour-field|condensed|violet|illustration|catalogue`: clear.
Fix before build: stamps overflow sideways at 390, cramped phone header,
"Show my78" spacing, focus ring on the chip inputs.

## Owner's call (24 Oct): Passport, in a dark theme

Dark is designed, not inverted: the ground is the **stamp ink itself**, dried
on the page (aubergine-black), and the passport page's apricot becomes the
text colour. Navy (the passport cover) was refused: it is IEEE blue again.

## Tokens (dark only; `color-scheme: dark`)

| Role | Value | Source |
|---|---|---|
| ground | oklch(17% 0.028 305) | violet stamp ink, dried black |
| raised | oklch(21% 0.034 305) | a second ink pass (menus, the desk) |
| guilloche | oklch(25% 0.04 305) | the security print, barely there |
| ink | oklch(94% 0.025 70) | the apricot visa page, as text |
| ink-2 | oklch(80% 0.03 70) | secondary text, 4.5:1+ on ground |
| rule | oklch(35% 0.04 305) | hairlines |
| stamp | oklch(76% 0.14 305) | rubber-stamp violet, lifted for dark: the one accent (stamps, the primary action, selected fields) |
| urgent | oklch(82% 0.12 62) | apricot: status only, "papers close within 7 days" |

- **Type:** Big Shoulders Display (condensed, the lettering of rubber stamps and
  station signs; headlines and stamp acronyms only). Public Sans (a
  government-issue sans for forms, which is what a passport is; everything
  else, tabular figures for dates).
- **Scale:** display clamp(3rem, 1.4rem + 6.2vw, 7.25rem) · h2 clamp(1.9rem, 1.4rem + 1.6vw, 2.75rem) · h3 18 · body 17 · small 15 · meta 13.
- **Radius:** 3px on controls (stamp blocks), 0 elsewhere; the stamps carry the curves.
- **Signature:** the desk re-stamps when you pick a field: seven stamps press
  down in sequence (scale 1.35 → 1, overshoot, 140ms stagger, 520ms each); then
  every 4.5s one stamp is pressed again. Reduced motion: stamps sit still.

## Content

- **Header:** CONFERA · "IEEE India · 297 conferences · updated 24 Oct" · Admin · GitHub · LinkedIn.
- **H1:** "88 IEEE conferences in India still take papers" (88 is live).
- **Line:** "Each stamp is one of them: where it happens and the day its call for papers closes. Pick your field and the page stamps the ones you can still make."
- **Fields:** Computing · Communication · Signal processing · Circuits and devices · Power and energy · Robotics and control · "All 16 fields".
- **Action:** "Show my 78 conferences" (live count).
- **Urgency line:** "6 close before 31 October. 51 are hybrid, so you can present from KTR."
- **Results heading:** "Your stamps" + "78 conferences, soonest deadline first".
- **Filters:** search ("Name, acronym, city, field or sponsor"), Open / Closed / No date / All, Year, Clear.
- **Entry:** round stamp (acronym, city, papers by) · full name · dates, city, format · tags as words ("Present from KTR", "~45 km from SRM", "Closes in 5 days", "IEEE Madras") · first three fields · "IEEE page".
- **ChatGPT row:** "Let ChatGPT shortlist for you" · "Copy all 297 for ChatGPT" · "Paste it with your research topic. Includes deadlines, fields, formats, sponsors and IEEE links."
- **Empty (filtered):** "No conferences match “robotics” in 2028. Clear the filters."
- **Footer:** "From IEEE's public conference search, refreshed every morning. Built by Stark, a GradeX product."
