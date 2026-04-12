
const DATA_URL = "./full.md";
const TODAY = new Date();

const state = {
  conferences: [],
  filtered: [],
  selectedFields: new Set(),
  search: "",
  cfp: "all",
  year: "all",
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
    state.selectedFields.clear();

    refs.searchInput.value = "";
    refs.cfpFilter.value = "all";
    refs.yearFilter.value = "all";
    refs.fieldChips.querySelectorAll(".chip").forEach((chip) => chip.classList.remove("active"));

    applyFiltersAndSync();
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

    applyFilters();
    mountThreeScene();
  } catch (error) {
    refs.grid.innerHTML = `<article class="conference-card"><h3 class="conf-title">Could not load conference data.</h3><p class="deadline">${error.message}</p></article>`;
  }
}

init();
