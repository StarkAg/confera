
const DATA_URL = "./full.md";
const TODAY = new Date();
const DAY_MS = 1000 * 60 * 60 * 24;
const SRM_DEFAULT_FIELDS = [
  "Computing and Processing",
  "Communication, Networking and Broadcast Technologies",
  "Signal Processing and Analysis",
  "Robotics and Control Systems",
  "Components, Circuits, Devices and Systems",
  "Power, Energy and Industry Applications",
];
const LOCAL_KEYWORDS = [
  "chennai",
  "chengalpattu",
  "kattankulathur",
  "tambaram",
  "kanchipuram",
  "kancheepuram",
  "vellore",
  "trichy",
  "tiruch",
  "coimbatore",
  "erode",
  "salem",
  "namakkal",
  "tirunelveli",
  "madurai",
  "thanjavur",
  "melmaruvathur",
  "sriperumbudur",
  "thiruvallur",
  "puducherry",
  "pondicherry",
  "tamil nadu",
];
const SOUTH_INDIA_KEYWORDS = [
  "kerala",
  "karnataka",
  "andhra pradesh",
  "telangana",
  "hyderabad",
  "bengaluru",
  "bangalore",
  "mysuru",
  "kochi",
  "ernakulam",
  "thiruvananthapuram",
  "kollam",
  "palakkad",
  "mangalore",
  "mangaluru",
  "vijayawada",
  "guntur",
  "tirupati",
  "warangal",
  "kozhikode",
  "trivandrum",
];
const STUDENT_PRESETS = {
  balanced: {
    label: "Balanced",
    description: "Best overall shortlist for SRM KTR students: practical travel from Chennai, open CFPs, and solid research fit.",
  },
  nearby: {
    label: "Near Chennai",
    description: "Push Tamil Nadu and nearby South India conferences to the top so students can shortlist with lower travel friction.",
  },
  lowTravel: {
    label: "Low Travel",
    description: "Prioritise hybrid conferences and practical locations when students want lower time and cost overhead.",
  },
  deadline: {
    label: "Deadline First",
    description: "Bring the most urgent open CFPs up first so students know where they need to act now.",
  },
};

const state = {
  conferences: [],
  filtered: [],
  selectedFields: new Set(),
  search: "",
  cfp: "all",
  year: "all",
  preset: "balanced",
};

const refs = {
  grid: document.getElementById("conferenceGrid"),
  template: document.getElementById("conferenceCardTemplate"),
  statsBar: document.getElementById("statsBar"),
  resultCount: document.getElementById("resultCount"),
  yearFilter: document.getElementById("yearFilter"),
  cfpFilter: document.getElementById("cfpFilter"),
  searchInput: document.getElementById("searchInput"),
  fieldChips: document.getElementById("fieldChips"),
  clearFilters: document.getElementById("clearFilters"),
  heroCanvas: document.getElementById("sceneCanvas"),
  studentPicks: document.getElementById("studentPicks"),
  studentPresets: document.getElementById("studentPresets"),
  studentPresetSummary: document.getElementById("studentPresetSummary"),
};

function parseCSV(text) {
  // Parse markdown table from full.md
  // Columns: # | Conference | Dates | CFP Deadline | Location | Format | Field of Interest | Sponsors | IEEE Details | API Details
  const lines = text.split("\n");
  const dataLines = lines.filter(line => {
    const t = line.trim();
    return t.startsWith("|") && !t.startsWith("| #") && !t.startsWith("| ---") && !t.startsWith("| -");
  });

  return dataLines.map(line => {
    const cells = line.split("|").map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
    // 0:#  1:Conference  2:Dates  3:CFP Deadline  4:Location  5:Format  6:Field of Interest  7:Sponsors  8:IEEE Details  9:API Details
    const conference = cells[1] || "";
    const dates = cells[2] || "";
    const cfpRaw = (cells[3] || "").trim();
    const location = cells[4] || "";
    const format = cells[5] || "";
    const fields = (cells[6] || "").split(";").map(f => f.trim()).filter(Boolean);
    const sponsors = (cells[7] || "").split(";").map(s => s.trim()).filter(Boolean);
    const ieeeLink = (cells[8] || "").match(/\(([^)]+)\)/)?.[1] || null;
    const yearMatch = conference.match(/^(\d{4})/);

    return {
      no: Number((cells[0] || "0")),
      conference,
      dates,
      cfpDeadline: cfpRaw || null,
      cfpDate: cfpRaw ? new Date(`${cfpRaw}T00:00:00`) : null,
      location,
      format,
      fields,
      sponsors,
      ieeeLink,
      year: yearMatch ? Number(yearMatch[1]) : null,
    };
  }).filter(c => c.conference);
}

function getDeadlineStatus(conf) {
  if (!conf.cfpDate || Number.isNaN(conf.cfpDate.getTime())) {
    return "missing";
  }
  return conf.cfpDate >= TODAY ? "open" : "closed";
}

function niceDate(value) {
  if (!value) return "Not listed";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - TODAY.getTime()) / DAY_MS);
}

function getPreferredFields() {
  return state.selectedFields.size ? [...state.selectedFields] : SRM_DEFAULT_FIELDS;
}

function getFieldMatchCount(conf) {
  const preferred = getPreferredFields();
  return conf.fields.filter((field) => preferred.includes(field)).length;
}

function getLocationTier(conf) {
  const location = conf.location.toLowerCase();
  if (LOCAL_KEYWORDS.some((keyword) => location.includes(keyword))) {
    return "local";
  }
  if (SOUTH_INDIA_KEYWORDS.some((keyword) => location.includes(keyword))) {
    return "south";
  }
  return "national";
}

function isMadrasSectionConference(conf) {
  return conf.sponsors.some((sponsor) => sponsor.toLowerCase().includes("madras section"));
}

function buildStudentRecommendation(conf) {
  const status = getDeadlineStatus(conf);
  const daysLeft = daysUntil(conf.cfpDate);
  const locationTier = getLocationTier(conf);
  const fieldMatchCount = getFieldMatchCount(conf);
  const preferredFieldCount = getPreferredFields().length;
  const hybrid = conf.format.toLowerCase() === "hybrid";
  const preset = state.preset;

  let score = 0;
  const reasons = [];

  if (status === "open") {
    score += 42;
    reasons.push("CFP is still open");
  } else if (status === "missing") {
    score += 10;
    reasons.push("CFP date is not listed yet");
  } else {
    score -= 28;
    reasons.push("CFP has already closed");
  }

  if (daysLeft !== null && daysLeft >= 0) {
    if (daysLeft <= 14) {
      score += preset === "deadline" ? 30 : 18;
      reasons.push(`Deadline is close: ${niceDate(conf.cfpDeadline)}`);
    } else if (daysLeft <= 45) {
      score += preset === "deadline" ? 24 : 14;
      reasons.push(`Still actionable this cycle: ${niceDate(conf.cfpDeadline)}`);
    } else if (daysLeft <= 90) {
      score += preset === "deadline" ? 12 : 8;
    } else {
      score += 4;
    }
  }

  if (locationTier === "local") {
    score += preset === "nearby" ? 30 : 20;
    reasons.push("Venue is in Chennai / Tamil Nadu range");
  } else if (locationTier === "south") {
    score += preset === "nearby" ? 18 : 10;
    reasons.push("Travel is still manageable from Chennai");
  } else {
    score += preset === "nearby" ? 1 : 4;
  }

  if (hybrid) {
    score += preset === "lowTravel" ? 28 : 15;
    reasons.push("Hybrid format reduces travel pressure");
  } else if (conf.format.toLowerCase() === "inperson") {
    score += preset === "lowTravel" ? 4 : 8;
  }

  if (fieldMatchCount > 0) {
    score += Math.min(fieldMatchCount * 7, 21);
    if (state.selectedFields.size) {
      reasons.push(`Matches ${fieldMatchCount} selected field${fieldMatchCount > 1 ? "s" : ""}`);
    } else if (fieldMatchCount >= Math.ceil(preferredFieldCount / 2)) {
      reasons.push("Strong fit for common SRM research tracks");
    }
  }

  if (isMadrasSectionConference(conf)) {
    score += 9;
    reasons.push("Supported by IEEE Madras Section");
  }

  if (preset === "lowTravel" && locationTier === "local" && hybrid) {
    score += 14;
  }

  const cappedScore = Math.max(18, Math.min(99, score));

  return {
    score: cappedScore,
    reasons: reasons.slice(0, 4),
    status,
  };
}

function renderStudentPicks() {
  if (!refs.studentPicks || !refs.studentPresetSummary) return;

  const activePreset = STUDENT_PRESETS[state.preset] || STUDENT_PRESETS.balanced;
  const fieldContext = state.selectedFields.size
    ? `Using your selected fields: ${[...state.selectedFields].join(", ")}.`
    : "Using common SRM KTR interests such as computing, communication, signal processing, robotics, electronics, and power.";

  refs.studentPresetSummary.textContent = `${activePreset.description} ${fieldContext}`;
  refs.studentPicks.innerHTML = "";

  if (state.filtered.length === 0) {
    refs.studentPicks.innerHTML = `
      <article class="student-pick-card student-pick-empty">
        <h3>No student picks available for these filters.</h3>
        <p>Clear some filters or switch the preset to see better options.</p>
      </article>
    `;
    return;
  }

  const ranked = state.filtered
    .map((conf) => ({ conf, recommendation: buildStudentRecommendation(conf) }))
    .sort((a, b) => {
      if (b.recommendation.score !== a.recommendation.score) {
        return b.recommendation.score - a.recommendation.score;
      }
      if (a.conf.cfpDate && b.conf.cfpDate) {
        return a.conf.cfpDate - b.conf.cfpDate;
      }
      return a.conf.no - b.conf.no;
    })
    .slice(0, 3);

  ranked.forEach(({ conf, recommendation }, index) => {
    const card = document.createElement("article");
    card.className = "student-pick-card";

    const top = document.createElement("div");
    top.className = "student-pick-top";

    const headingWrap = document.createElement("div");
    const kicker = document.createElement("p");
    kicker.className = "student-pick-kicker";
    kicker.textContent = `Student Pick ${index + 1}`;

    const title = document.createElement("h3");
    title.textContent = conf.conference;

    headingWrap.append(kicker, title);

    const score = document.createElement("div");
    score.className = "student-score";
    score.textContent = `${recommendation.score}/100 fit`;

    top.append(headingWrap, score);

    const meta = document.createElement("p");
    meta.className = "student-pick-meta";
    meta.textContent = `${conf.location || "Location not listed"} · ${conf.format || "Format not listed"} · CFP ${conf.cfpDeadline ? niceDate(conf.cfpDeadline) : "Not listed"}`;

    const reasons = document.createElement("div");
    reasons.className = "student-reasons";
    recommendation.reasons.forEach((reason) => {
      const tag = document.createElement("span");
      tag.className = "student-reason";
      tag.textContent = reason;
      reasons.appendChild(tag);
    });

    const footer = document.createElement("div");
    footer.className = "student-pick-footer";

    const footerNote = document.createElement("p");
    footerNote.className = "student-pick-note";
    footerNote.textContent = state.selectedFields.size
      ? "Ranking adapts to your selected fields."
      : "Ranking is tuned for typical SRM KTR student shortlisting.";

    const link = document.createElement("a");
    link.className = "student-pick-link";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.href = conf.ieeeLink || "#";
    link.textContent = conf.ieeeLink ? "Open IEEE Page ↗" : "IEEE page unavailable";
    if (!conf.ieeeLink) {
      link.classList.add("disabled");
      link.setAttribute("aria-disabled", "true");
    }

    footer.append(footerNote, link);
    card.append(top, meta, reasons, footer);
    refs.studentPicks.appendChild(card);
  });
}

function renderStats() {
  const total = state.conferences.length;
  const open = state.conferences.filter((c) => getDeadlineStatus(c) === "open").length;
  const closed = state.conferences.filter((c) => getDeadlineStatus(c) === "closed").length;
  const missing = state.conferences.filter((c) => getDeadlineStatus(c) === "missing").length;

  const stats = [
    ["Total Conferences", total],
    ["Open Call for Papers", open],
    ["Closed Call for Papers", closed],
    ["Missing Call for Papers", missing],
    ["Matching Results", state.filtered.length],
  ];

  refs.statsBar.innerHTML = "";
  stats.forEach(([label, value]) => {
    const statCard = document.createElement("article");
    statCard.className = "stat-card";
    statCard.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value">${value}</div>`;
    refs.statsBar.appendChild(statCard);
  });
}

function renderYearOptions() {
  const years = [...new Set(state.conferences.map((c) => c.year).filter(Boolean))].sort((a, b) => a - b);

  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    refs.yearFilter.appendChild(option);
  });
}

function renderFieldChips() {
  const counts = new Map();
  state.conferences.forEach((conf) => {
    conf.fields.forEach((field) => counts.set(field, (counts.get(field) || 0) + 1));
  });

  const fields = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  refs.fieldChips.innerHTML = "";

  fields.forEach(([field, count]) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = `${field} (${count})`;
    chip.dataset.field = field;
    chip.addEventListener("click", () => {
      if (state.selectedFields.has(field)) {
        state.selectedFields.delete(field);
        chip.classList.remove("active");
      } else {
        state.selectedFields.add(field);
        chip.classList.add("active");
      }
      applyFiltersAndSync();
    });
    refs.fieldChips.appendChild(chip);
  });
}

function syncURL() {
  const params = new URLSearchParams();
  if (state.search) params.set("q", state.search);
  if (state.cfp !== "all") params.set("cfp", state.cfp);
  if (state.year !== "all") params.set("year", state.year);
  if (state.selectedFields.size) params.set("fields", [...state.selectedFields].join(","));
  if (state.preset !== "balanced") params.set("preset", state.preset);
  const newUrl = params.toString()
    ? `${location.pathname}?${params}`
    : location.pathname;
  history.replaceState(null, "", newUrl);
}

function loadFromURL() {
  const params = new URLSearchParams(location.search);
  if (params.get("q")) state.search = params.get("q");
  state.cfp = params.get("cfp") || "open";
  if (params.get("year")) state.year = params.get("year");
  if (params.get("preset") && STUDENT_PRESETS[params.get("preset")]) {
    state.preset = params.get("preset");
  }
  if (params.get("fields")) {
    params.get("fields").split(",").forEach(f => state.selectedFields.add(f));
  }
}

function applyFiltersAndSync() {
  syncURL();
  applyFilters();
}

function applyFilters() {
  const query = state.search.toLowerCase();

  state.filtered = state.conferences.filter((conf) => {
    // Extract acronym e.g. "(ICCSC)" → "iccsc"
    const acronym = (conf.conference.match(/\(([^)]+)\)\s*$/) || [])[1] || "";
    const matchesSearch = !query ||
      conf.conference.toLowerCase().includes(query) ||
      acronym.toLowerCase().includes(query) ||
      conf.location.toLowerCase().includes(query) ||
      conf.fields.some(f => f.toLowerCase().includes(query)) ||
      conf.sponsors.some(s => s.toLowerCase().includes(query));
    const matchesCFP = state.cfp === "all" || getDeadlineStatus(conf) === state.cfp;
    const matchesYear = state.year === "all" || String(conf.year) === state.year;

    const matchesFields =
      state.selectedFields.size === 0 || conf.fields.some((field) => state.selectedFields.has(field));

    return matchesSearch && matchesCFP && matchesYear && matchesFields;
  });

  state.filtered.sort((a, b) => {
    if (!a.cfpDate && !b.cfpDate) {
      return a.no - b.no;
    }
    if (!a.cfpDate) {
      return 1;
    }
    if (!b.cfpDate) {
      return -1;
    }
    return a.cfpDate - b.cfpDate;
  });

  renderGrid();
  renderStudentPicks();
  renderStats();
}

function renderGrid() {
  refs.grid.innerHTML = "";

  if (state.filtered.length === 0) {
    refs.grid.innerHTML = '<article class="conference-card"><h3 class="conf-title">No conferences match these filters.</h3><p class="deadline">Try broadening search, year, or field filters.</p></article>';
    refs.resultCount.textContent = "0 shown";
    return;
  }

  const fragment = document.createDocumentFragment();

  state.filtered.forEach((conf, index) => {
    const node = refs.template.content.firstElementChild.cloneNode(true);

    const status = getDeadlineStatus(conf);

    node.querySelector(".conf-title").textContent = conf.conference;

    const pill = node.querySelector(".status-pill");
    pill.textContent = status;
    pill.classList.add(`status-${status}`);

    node.querySelector(".deadline").textContent = conf.cfpDeadline ? niceDate(conf.cfpDeadline) : "—";

    // Dates
    if (conf.dates) node.querySelector(".card-dates").textContent = conf.dates;

    // Location + Format
    const meta = [];
    if (conf.location) meta.push(conf.location);
    if (conf.format) meta.push(conf.format.charAt(0).toUpperCase() + conf.format.slice(1));
    if (meta.length) node.querySelector(".card-meta").textContent = meta.join(" · ");

    // Sponsors
    if (conf.sponsors.length) {
      node.querySelector(".card-sponsors").textContent = conf.sponsors.join(", ");
    } else {
      node.querySelector(".card-sponsors").style.visibility = "hidden";
    }

    // IEEE link
    const linkEl = node.querySelector(".card-ieee-link");
    if (conf.ieeeLink) {
      linkEl.href = conf.ieeeLink;
    } else {
      linkEl.style.visibility = "hidden";
    }

    // Field tags — show all
    const tags = node.querySelector(".field-tags");
    conf.fields.forEach((field) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = field;
      tags.appendChild(tag);
    });

    if (conf.ieeeLink) {
      node.style.cursor = "pointer";
      node.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        window.open(conf.ieeeLink, "_blank", "noopener,noreferrer");
      });
    }

    node.style.animationDelay = `${Math.min(index * 18, 240)}ms`;
    fragment.appendChild(node);
  });

  refs.grid.appendChild(fragment);
  refs.resultCount.textContent = `${state.filtered.length} shown`;
}

function wireEvents() {
  const fieldsToggle = document.getElementById("fieldsToggle");
  const fieldChips = refs.fieldChips;
  fieldsToggle.addEventListener("click", () => {
    const expanded = fieldsToggle.getAttribute("aria-expanded") === "true";
    fieldsToggle.setAttribute("aria-expanded", !expanded);
    fieldChips.classList.toggle("chips-collapsed", expanded);
  });

  let searchDebounce;
  refs.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(applyFiltersAndSync, 200);
  });

  refs.cfpFilter.addEventListener("change", (event) => {
    state.cfp = event.target.value;
    applyFiltersAndSync();
  });

  refs.yearFilter.addEventListener("change", (event) => {
    state.year = event.target.value;
    applyFiltersAndSync();
  });

  refs.clearFilters.addEventListener("click", () => {
    state.search = "";
    state.cfp = "all";
    state.year = "all";
    state.preset = "balanced";
    state.selectedFields.clear();

    refs.searchInput.value = "";
    refs.cfpFilter.value = "all";
    refs.yearFilter.value = "all";
    refs.fieldChips.querySelectorAll(".chip").forEach((chip) => chip.classList.remove("active"));
    refs.studentPresets.querySelectorAll(".student-preset-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.preset === "balanced");
    });

    applyFiltersAndSync();
  });

  refs.studentPresets.querySelectorAll(".student-preset-btn").forEach((button) => {
    button.addEventListener("click", () => {
      state.preset = button.dataset.preset;
      refs.studentPresets.querySelectorAll(".student-preset-btn").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      applyFiltersAndSync();
    });
  });
}

function mountThreeScene() {
  const canvas = refs.heroCanvas;
  if (!canvas) return;

  const glOpts = { premultipliedAlpha: false, alpha: true };
  const gl = canvas.getContext("webgl", glOpts) || canvas.getContext("experimental-webgl", glOpts);
  if (!gl) return;

  const vsSource = `
    precision mediump float;
    attribute vec2 a_position;
    varying vec2 vUv;
    void main() {
      vUv = .5 * (a_position + 1.);
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fsSource = `
    precision mediump float;
    varying vec2 vUv;
    uniform float u_time;
    uniform float u_ratio;
    uniform vec2 u_pointer_position;
    uniform float u_scroll_progress;

    vec2 rotate(vec2 uv, float th) {
      return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
    }

    float neuro_shape(vec2 uv, float t, float p) {
      vec2 sine_acc = vec2(0.);
      vec2 res = vec2(0.);
      float scale = 8.;
      for (int j = 0; j < 15; j++) {
        uv = rotate(uv, 1.);
        sine_acc = rotate(sine_acc, 1.);
        vec2 layer = uv * scale + float(j) + sine_acc - t;
        sine_acc += sin(layer) + 2.4 * p;
        res += (.5 + .5 * cos(layer)) / scale;
        scale *= (1.2);
      }
      return res.x + res.y;
    }

    void main() {
      vec2 uv = .5 * vUv;
      uv.x *= u_ratio;
      vec2 pointer = vUv - u_pointer_position;
      pointer.x *= u_ratio;
      float p = clamp(length(pointer), 0., 1.);
      p = .5 * pow(1. - p, 2.);
      float t = .001 * u_time;
      vec3 color = vec3(0.);
      float noise = neuro_shape(uv, t, p);
      noise = 1.2 * pow(noise, 3.);
      noise += pow(noise, 10.);
      noise = max(.0, noise - .5);
      noise *= (1. - length(vUv - .5));
      color = vec3(0.5, 0.15, 0.65);
      color = mix(color, vec3(0.02, 0.7, 0.9), 0.32 + 0.16 * sin(2.0 * u_scroll_progress + 1.2));
      color += vec3(0.15, 0.0, 0.6) * sin(2.0 * u_scroll_progress + 1.5);
      color = color * noise;
      gl_FragColor = vec4(color, noise);
    }
  `;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = compileShader(gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.useProgram(program);

  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(program, "u_time");
  const uRatio = gl.getUniformLocation(program, "u_ratio");
  const uPointer = gl.getUniformLocation(program, "u_pointer_position");
  const uScroll = gl.getUniformLocation(program, "u_scroll_progress");

  const pointer = { x: 0.5, y: 0.5, tX: 0.5, tY: 0.5 };

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uRatio, canvas.width / canvas.height);
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  window.addEventListener("pointermove", (e) => {
    pointer.tX = e.clientX / window.innerWidth;
    pointer.tY = e.clientY / window.innerHeight;
  });

  function render() {
    pointer.x += (pointer.tX - pointer.x) * 0.2;
    pointer.y += (pointer.tY - pointer.y) * 0.2;

    gl.uniform1f(uTime, performance.now());
    gl.uniform2f(uPointer, pointer.x, 1 - pointer.y);
    gl.uniform1f(uScroll, window.scrollY / (2 * window.innerHeight));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  render();
}

async function init() {
  try {
    const text = await fetch(DATA_URL).then((res) => {
      if (!res.ok) {
        throw new Error(`Unable to load data (${res.status})`);
      }
      return res.text();
    });

    state.conferences = parseCSV(text);
    state.filtered = [...state.conferences];

    loadFromURL();
    renderYearOptions();
    renderFieldChips();
    wireEvents();

    // Restore UI from URL state
    if (state.search) refs.searchInput.value = state.search;
    refs.cfpFilter.value = state.cfp;
    if (state.year !== "all") refs.yearFilter.value = state.year;
    if (state.selectedFields.size) {
      refs.fieldChips.querySelectorAll(".chip").forEach(chip => {
        if (state.selectedFields.has(chip.dataset.field)) chip.classList.add("active");
      });
    }
    refs.studentPresets.querySelectorAll(".student-preset-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.preset === state.preset);
    });

    applyFilters();
    mountThreeScene();
  } catch (error) {
    refs.grid.innerHTML = `<article class="conference-card"><h3 class="conf-title">Could not load conference data.</h3><p class="deadline">${error.message}</p></article>`;
  }
}

init();
