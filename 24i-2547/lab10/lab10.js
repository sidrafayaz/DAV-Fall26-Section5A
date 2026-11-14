/* Lab 10 – Time series with D3.js  |  24i-2547 · DS-A */
(function () {
  "use strict";

  const W = 960;
  const parseDate = d3.timeParse("%Y-%m-%d");
  const fmtFull = d3.timeFormat("%d %b %Y");
  const fmtDay = d3.timeFormat("%d %b");
  const fmtMon = d3.timeFormat("%b");
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const C = { city: "#2b3a67", sub: "#1f8f8a", ink: "#1c2634", mute: "#5f6b7c",
              alert: "#b3321f", who: "#2e7d4f", gap: "#8a94a6", daily: "#9db0d6" };
  const LEVELS = [
    { name: "Low",      test: v => v <= 35,  color: "#f4e7b0", note: "35 or below" },
    { name: "Moderate", test: v => v <= 75,  color: "#eeb05a", note: "36 to 75" },
    { name: "High",     test: v => v <= 150, color: "#cc5a28", note: "76 to 150" },
    { name: "Severe",   test: () => true,    color: "#6b1d1d", note: "above 150" }
  ];
  const levelOf = v => LEVELS.find(l => l.test(v)).name;
  const FULL = [new Date(2025, 0, 1), new Date(2025, 11, 31)];
  const tip = d3.select("#tip");
  const f1 = d3.format(".1f");

  d3.csv("dataset/air_quality_2025.csv", r => ({
    date: parseDate(r.date), city: +r.pm25_city, sub: +r.pm25_suburb, temp: +r.temp_c
  })).then(init).catch(err => {
    console.error(err);
    document.getElementById("loaderr").hidden = false;
  });

  /* ---------- helpers ---------- */
  function segments(arr) {            // split a series wherever days are missing
    const out = []; let cur = [];
    arr.forEach((d, i) => {
      if (i > 0 && d3.timeDay.count(arr[i - 1].date, d.date) > 1) { out.push(cur); cur = []; }
      cur.push(d);
    });
    if (cur.length) out.push(cur);
    return out;
  }
  function frame(sel, h, m) {
    m = m || { top: 22, right: 26, bottom: 36, left: 56 };
    const svg = d3.select(sel).append("svg").attr("viewBox", `0 0 ${W} ${h}`).attr("role", "img");
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    return { svg, g, m, w: W - m.left - m.right, h: h - m.top - m.bottom };
  }
  function yAxis(c, y, label) {
    c.g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(6).tickSize(-c.w).tickFormat(""));
    c.g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));
    c.g.append("text").attr("class", "axlabel").attr("transform", "rotate(-90)")
      .attr("x", -c.h / 2).attr("y", -c.m.left + 14).attr("text-anchor", "middle").text(label);
  }
  function monthAxis(c, x) {
    return c.g.append("g").attr("class", "axis").attr("transform", `translate(0,${c.h})`)
      .call(d3.axisBottom(x).ticks(d3.timeMonth).tickFormat(fmtMon));
  }
  function shadeGaps(c, x, gaps, label) {
    gaps.forEach(gp => {
      const x0 = x(gp.start), x1 = x(gp.end);
      c.g.append("rect").attr("class", "gapshade").attr("x", x0).attr("width", x1 - x0)
        .attr("y", 0).attr("height", c.h).attr("fill", C.gap).attr("opacity", 0.22);
      if (label) {
        c.g.append("text").attr("x", (x0 + x1) / 2).attr("y", 14).attr("text-anchor", "middle")
          .attr("class", "lbl").attr("fill", C.ink).text("No data: sensor offline");
      }
    });
  }
  function drawLine(parent, segs, x, y, acc, attrs) {
    const gen = d3.line().defined(d => acc(d) != null).x(d => x(d.date)).y(d => y(acc(d)));
    return parent.selectAll(null).data(segs).join("path")
      .attr("fill", "none").attr("stroke-linejoin", "round").attr("stroke-linecap", "round")
      .attr("d", s => gen(s)).call(sel => Object.entries(attrs).forEach(([k, v]) => sel.attr(k, v)));
  }
  const bisect = d3.bisector(d => d.date).center;
  // Hover: x.invert -> bisector -> nearest sample. If the cursor is more than 1.5 days from
  // a reading it is over a gap, and the tooltip says so rather than inventing a value.
  function hover(c, x, data, marks, html) {
    const rule = c.g.append("line").attr("y1", 0).attr("y2", c.h).attr("stroke", C.ink)
      .attr("stroke-width", 1).attr("stroke-dasharray", "2 3").style("display", "none");
    const dots = c.g.append("g");
    c.g.append("rect").attr("width", c.w).attr("height", c.h).attr("fill", "none")
      .attr("pointer-events", "all")
      .on("mousemove", ev => {
        const [mx] = d3.pointer(ev);
        const when = x.invert(mx);
        const dom = x.domain();
        if (when < dom[0] || when > dom[1]) return;
        const d = data[bisect(data, when)];
        const away = Math.abs(d.date - when) / 864e5;
        rule.style("display", null).attr("x1", mx).attr("x2", mx);
        if (away > 1.5) {
          dots.selectAll("circle").remove();
          tip.style("opacity", 1).html(`<b>${fmtFull(when)}</b><br>No reading (sensor offline)`);
        } else {
          dots.selectAll("circle").data(marks).join("circle").attr("r", 4.5).attr("fill", m => m.color)
            .attr("stroke", "#fff").attr("stroke-width", 1.5)
            .attr("cx", x(d.date)).attr("cy", m => m.y(d) == null ? 0 : m.y(d))
            .attr("display", m => (m.y(d) == null ? "none" : null));
          tip.style("opacity", 1).html(html(d));
        }
        tip.style("left", Math.min(ev.clientX + 16, window.innerWidth - 250) + "px")
           .style("top", ev.clientY - 12 + "px");
      })
      .on("mouseleave", () => { rule.style("display", "none"); dots.selectAll("circle").remove(); tip.style("opacity", 0); });
  }
  const timeX = c => d3.scaleTime().domain(FULL).range([0, c.w]);

  /* ---------- main ---------- */
  function init(data) {
    data.sort((a, b) => a.date - b.date);

    // gaps in the calendar
    const gaps = [];
    for (let i = 1; i < data.length; i++) {
      const n = d3.timeDay.count(data[i - 1].date, data[i].date);
      if (n > 1) gaps.push({ start: d3.timeDay.offset(data[i - 1].date, 1), end: data[i].date,
                             missing: n - 1, before: data[i - 1], after: data[i] });
    }
    const missingTotal = d3.sum(gaps, g => g.missing);
    const segs = segments(data);

    // 7-day moving average inside each unbroken stretch (never across a gap)
    segs.forEach(seg => seg.forEach((d, i) => {
      d.ma = i >= 6 ? d3.mean(seg.slice(i - 6, i + 1), e => e.city) : null;
    }));
    data.forEach(d => { d.level = levelOf(d.city); });

    const above15 = data.filter(d => d.city > 15).length;
    const above75 = data.filter(d => d.city > 75).length;
    const top2 = data.slice().sort((a, b) => b.city - a.city).slice(0, 2);

    // monthly stats
    const mstat = d3.range(12).map(m => {
      const rows = data.filter(d => d.date.getMonth() === m);
      const lo = d3.min(rows, d => d.city), hi = d3.max(rows, d => d.city);
      return { m, n: rows.length, min: lo, max: hi, mean: d3.mean(rows, d => d.city),
               subMean: d3.mean(rows, d => d.sub), mid: new Date(2025, m, 15), range: hi - lo };
    });
    const widest = mstat.reduce((a, b) => (b.range > a.range ? b : a));

    task1(data, gaps, missingTotal);
    task2(data, segs, gaps, above15, above75, top2);
    task3(data, gaps, above75);
    task4(data, segs, gaps, mstat);
    task5(data);
    task6(data);
    task7(mstat, widest);
    task8(data, segs, gaps, missingTotal);
    task9(data, segs, gaps, widest);
  }

  /* ---------- Task 1 ---------- */
  function task1(data, gaps, missingTotal) {
    const days2025 = d3.timeDay.count(new Date(2025, 0, 1), new Date(2026, 0, 1));
    const rows = [
      ["Rows (days recorded)", data.length],
      ["First date", fmtFull(data[0].date)],
      ["Last date", fmtFull(data[data.length - 1].date)],
      ["Days in 2025", days2025],
      ["Missing days", days2025 - data.length]
    ];
    d3.select("#facts").selectAll("tr").data(rows).join("tr")
      .html(r => `<th>${r[0]}</th><td><b>${r[1]}</b></td>`);
    const g = gaps[0];
    document.getElementById("t1note").innerHTML =
      `<b>What I notice:</b> ${data.length} rows for a ${days2025}-day year, so ${days2025 - data.length} days are missing. ` +
      `They are one unbroken stretch, ${fmtDay(g.start)} to ${fmtDay(d3.timeDay.offset(g.end, -1))} (${g.missing} days). ` +
      `The sensor was offline, and the charts below treat it as a gap, not as zero or as a smooth bridge.`;
  }

  /* ---------- Task 2 ---------- */
  function task2(data, segs, gaps, a15, a75, top2) {
    d3.select("#t2chips").html(
      `<span class="chip ok"><b>${a15}</b>days above 15 µg/m³ (of ${data.length} recorded)</span>` +
      `<span class="chip alert"><b>${a75}</b>days above 75 µg/m³</span>`);
    const c = frame("#c2", 400), x = timeX(c);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.city) * 1.1]).nice().range([c.h, 0]);
    yAxis(c, y, "PM2.5, city centre (µg/m³)");
    monthAxis(c, x);
    shadeGaps(c, x, gaps, false);
    [[15, "WHO guideline 15", "start", 6, 14], [75, "Interim target 1: 75", "start", x(new Date(2025, 5, 8)), -6]]
      .forEach(([v, t, anc, px, dy]) => {
        c.g.append("line").attr("x1", 0).attr("x2", c.w).attr("y1", y(v)).attr("y2", y(v))
          .attr("stroke", v === 15 ? C.who : C.alert).attr("stroke-dasharray", "6 4").attr("stroke-width", 1.4);
        c.g.append("text").attr("x", px).attr("y", y(v) + dy).attr("text-anchor", anc).attr("class", "lbl")
          .attr("fill", v === 15 ? C.who : C.alert).text(`${t} µg/m³`);
      });
    drawLine(c.g.append("g"), segs, x, y, d => d.city, { stroke: C.city, "stroke-width": 1.5 });
    top2.forEach(d => {
      c.g.append("circle").attr("cx", x(d.date)).attr("cy", y(d.city)).attr("r", 5.5)
        .attr("fill", C.alert).attr("stroke", "#fff").attr("stroke-width", 1.5);
      c.g.append("text").attr("x", x(d.date)).attr("y", y(d.city) - 11).attr("text-anchor", "middle")
        .attr("class", "lbl").attr("fill", C.ink).text(`${fmtDay(d.date)}: ${f1(d.city)}`);
    });
    hover(c, x, data, [{ y: d => y(d.city), color: C.city }],
      d => `<b>${fmtFull(d.date)}</b><br>City PM2.5: ${f1(d.city)} µg/m³<br>${levelOf(d.city)}`);
  }

  /* ---------- Task 3 ---------- */
  function task3(data, gaps, a75) {
    const run = d3.cumsum(data, d => (d.city > 75 ? 1 : 0));
    data.forEach((d, i) => { d.cum = run[i]; });
    const final = run[run.length - 1];
    const c = frame("#c3", 380), x = timeX(c);
    const y = d3.scaleLinear().domain([0, 200]).range([c.h, 0]);
    yAxis(c, y, "Days above 75 so far");
    monthAxis(c, x);
    shadeGaps(c, x, gaps, false);
    c.g.append("path").datum(data).attr("fill", "#cc5a28").attr("fill-opacity", 0.35)
      .attr("d", d3.area().curve(d3.curveStepAfter).x(d => x(d.date)).y0(c.h).y1(d => y(d.cum)));
    c.g.append("path").datum(data).attr("fill", "none").attr("stroke", "#a8431b").attr("stroke-width", 2)
      .attr("d", d3.line().curve(d3.curveStepAfter).x(d => x(d.date)).y(d => y(d.cum)));
    c.g.append("circle").attr("cx", x(data[data.length - 1].date)).attr("cy", y(final)).attr("r", 5).attr("fill", "#a8431b");
    c.g.append("text").attr("x", x(data[data.length - 1].date) - 10).attr("y", y(final) - 10)
      .attr("text-anchor", "end").attr("class", "lbl").attr("fill", C.ink).text(`Year total: ${final} days`);
    const jun = x(new Date(2025, 5, 1)), aug = x(new Date(2025, 8, 1));
    c.g.append("text").attr("x", (jun + aug) / 2).attr("y", y(100) - 10).attr("text-anchor", "middle")
      .attr("class", "lbl").attr("fill", C.ink).text("Jun to Aug: flat, no new days");
    hover(c, x, data, [{ y: d => y(d.cum), color: "#a8431b" }],
      d => `<b>${fmtFull(d.date)}</b><br>Running total: ${d.cum} days<br>That day: ${f1(d.city)} µg/m³`);
    const ok = final === a75;
    document.getElementById("t3note").innerHTML =
      `The last value is <b>${final}</b>, ${ok ? "matching" : "NOT matching"} the ${a75} days counted in Task 2. ` +
      `The total counts recorded days only; the sensor outage adds nothing, so the line stays level across it.`;
  }

  /* ---------- Task 4 ---------- */
  function task4(data, segs, gaps, mstat) {
    const c = frame("#c4", 400), x = timeX(c);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.city) * 1.1]).nice().range([c.h, 0]);
    yAxis(c, y, "PM2.5 (µg/m³)");
    monthAxis(c, x);
    shadeGaps(c, x, gaps, false);
    drawLine(c.g.append("g"), segs, x, y, d => d.city, { stroke: C.city, "stroke-width": 1.5 });
    drawLine(c.g.append("g"), segs, x, y, d => d.sub, { stroke: C.sub, "stroke-width": 1.5 });
    hover(c, x, data, [{ y: d => y(d.city), color: C.city }, { y: d => y(d.sub), color: C.sub }],
      d => `<b>${fmtFull(d.date)}</b><br>City: ${f1(d.city)}<br>Suburb: ${f1(d.sub)}<br>Gap: ${f1(d.city - d.sub)}`);
    const gapM = mstat.reduce((a, b) => (b.mean - b.subMean > a.mean - a.subMean ? b : a));
    const small = mstat.reduce((a, b) => (b.mean - b.subMean < a.mean - a.subMean ? b : a));
    const r = d3.correlation ? d3.correlation(data.map(d => d.city), data.map(d => d.sub)) : NaN;
    const ratio = d3.mean(data, d => d.sub / d.city);
    document.getElementById("t4note").innerHTML =
      `The two lines rise and fall together${isNaN(r) ? "" : ` (correlation ${r.toFixed(2)})`}. The suburb runs about ${Math.round((1 - ratio) * 100)}% lower. ` +
      `The monthly mean gap is largest in <b>${MONTHS[gapM.m]}</b> (${f1(gapM.mean - gapM.subMean)} µg/m³) and smallest in ${MONTHS[small.m]} (${f1(small.mean - small.subMean)}). ` +
      `The suburb was above the city on ${data.filter(d => d.sub > d.city).length} days only.`;
  }

  /* ---------- Task 5 ---------- */
  function task5(data) {
    d3.select("#lg5").html(LEVELS.map(l =>
      `<span><i style="background:${l.color}"></i>${l.name} (${l.note})</span>`).join(""));
    const counts = d3.rollup(data, v => v.length, d => d.date.getMonth(), d => d.level);
    const rows = d3.range(12).map(m => {
      const o = { m, total: 0, cal: new Date(2025, m + 1, 0).getDate() };
      LEVELS.forEach(l => { o[l.name] = (counts.get(m) && counts.get(m).get(l.name)) || 0; o.total += o[l.name]; });
      return o;
    });
    const stack = d3.stack().keys(LEVELS.map(l => l.name))(rows);
    const c = frame("#c5", 430, { top: 30, right: 20, bottom: 36, left: 52 });
    const x = d3.scaleBand().domain(d3.range(12)).range([0, c.w]).padding(0.22);
    const y = d3.scaleLinear().domain([0, 31]).range([c.h, 0]);
    yAxis(c, y, "Days in month");
    c.g.append("g").attr("class", "axis").attr("transform", `translate(0,${c.h})`)
      .call(d3.axisBottom(x).tickFormat(m => MONTHS[m]));
    // dashed outline = full calendar length of the month
    c.g.selectAll(".ghost").data(rows).join("rect").attr("x", r => x(r.m)).attr("width", x.bandwidth())
      .attr("y", r => y(r.cal)).attr("height", r => c.h - y(r.cal)).attr("fill", "none")
      .attr("stroke", C.mute).attr("stroke-dasharray", "3 3");
    stack.forEach((layer, li) => {
      c.g.selectAll(`.s${li}`).data(layer).join("rect")
        .attr("x", d => x(d.data.m)).attr("width", x.bandwidth())
        .attr("y", d => y(d[1])).attr("height", d => y(d[0]) - y(d[1]))
        .attr("fill", LEVELS[li].color).attr("stroke", "#fff").attr("stroke-width", 0.8)
        .append("title").text(d => `${MONTHS[d.data.m]} · ${LEVELS[li].name}: ${d[1] - d[0]} days`);
      c.g.selectAll(`.t${li}`).data(layer.filter(d => d[1] - d[0] >= 2)).join("text")
        .attr("x", d => x(d.data.m) + x.bandwidth() / 2).attr("y", d => (y(d[0]) + y(d[1])) / 2 + 4)
        .attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 600)
        .attr("fill", li >= 2 ? "#fff" : C.ink).text(d => d[1] - d[0]);
    });
    c.g.selectAll(".tot").data(rows).join("text").attr("x", r => x(r.m) + x.bandwidth() / 2)
      .attr("y", r => y(r.cal) - 6).attr("text-anchor", "middle").attr("class", "lbl").attr("fill", C.ink)
      .text(r => (r.total < r.cal ? `${r.total} of ${r.cal}` : r.total));
    const sev = rows.filter(r => r.Severe > 0).map(r => `${MONTHS[r.m]} (${r.Severe})`).join(", ");
    const lowM = rows.reduce((a, b) => (b.Low > a.Low ? b : a));
    document.getElementById("t5note").innerHTML =
      `<b>Severe days:</b> ${sev}. <b>Most Low days:</b> ${MONTHS[lowM.m]} (${lowM.Low}). ` +
      `<b>Why stacks differ in height:</b> the dashed outline is the calendar length of each month. February has 28 days and April, June, September and November have 30. ` +
      `March has only ${rows[2].total} recorded days because ${rows[2].cal - rows[2].total} were missing, which is why its bar stops well short of its outline. ` +
      `Every stack sums to the days recorded in that month.`;
  }

  /* ---------- Task 6 ---------- */
  function task6(data) {
    const dow = d => (d.date.getDay() + 6) % 7;      // Monday = 0
    const cell = d3.rollup(data, v => d3.mean(v, d => d.city), d => d.date.getMonth(), d => dow(d));
    const byMonth = d3.rollup(data, v => d3.mean(v, d => d.city), d => d.date.getMonth());
    const byDay = d3.rollup(data, v => d3.mean(v, d => d.city), d => dow(d));
    const cols = d3.range(7).concat("All"), rowsK = d3.range(12).concat("All");
    const val = (m, k) => m === "All" ? (k === "All" ? d3.mean(data, d => d.city) : byDay.get(k))
                                       : (k === "All" ? byMonth.get(m) : (cell.get(m) || new Map()).get(k));
    const cells = [];
    rowsK.forEach(m => cols.forEach(k => { const v = val(m, k); if (v != null) cells.push({ m, k, v }); }));
    const ext = d3.extent(cells, d => d.v);
    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain(ext);
    const c = frame("#c6", 600, { top: 34, right: 20, bottom: 74, left: 60 });
    const x = d3.scaleBand().domain(cols).range([0, c.w]).padding(0.05);
    const y = d3.scaleBand().domain(rowsK).range([0, c.h]).padding(0.05);
    c.g.append("g").attr("class", "axis").call(d3.axisTop(x).tickSize(0).tickFormat(k => k === "All" ? "All days" : DAYS[k]))
      .select(".domain").remove();
    c.g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickSize(0).tickFormat(m => m === "All" ? "All months" : MONTHS[m]))
      .select(".domain").remove();
    c.g.selectAll("rect.cell").data(cells).join("rect").attr("x", d => x(d.k)).attr("y", d => y(d.m))
      .attr("width", x.bandwidth()).attr("height", y.bandwidth()).attr("fill", d => color(d.v))
      .attr("stroke", d => (d.m === "All" || d.k === "All") ? C.ink : "none").attr("stroke-width", 1)
      .append("title").text(d => `${d.m === "All" ? "All months" : MONTHS[d.m]} · ${d.k === "All" ? "all weekdays" : DAYS[d.k]}: ${f1(d.v)} µg/m³`);
    c.g.selectAll("text.v").data(cells).join("text").attr("x", d => x(d.k) + x.bandwidth() / 2)
      .attr("y", d => y(d.m) + y.bandwidth() / 2 + 4).attr("text-anchor", "middle").attr("font-size", 12)
      .attr("fill", d => (d3.lab(color(d.v)).l < 62 ? "#fff" : C.ink)).text(d => Math.round(d.v));
    // colour legend
    const lw = 300, lx = (c.w - lw) / 2, ly = c.h + 28;
    const defs = c.svg.append("defs"), grad = defs.append("linearGradient").attr("id", "g6");
    d3.range(0, 1.001, 0.1).forEach(t => grad.append("stop").attr("offset", t * 100 + "%").attr("stop-color", d3.interpolateYlOrRd(t)));
    c.g.append("rect").attr("x", lx).attr("y", ly).attr("width", lw).attr("height", 14).attr("fill", "url(#g6)");
    c.g.append("g").attr("class", "axis").attr("transform", `translate(${lx},${ly + 14})`)
      .call(d3.axisBottom(d3.scaleLinear().domain(ext).range([0, lw])).ticks(5));
    c.g.append("text").attr("x", lx + lw / 2).attr("y", ly + 48).attr("text-anchor", "middle").attr("class", "axlabel")
      .text("Average city PM2.5 (µg/m³)");
    const dv = DAYS.map((n, i) => ({ n, v: byDay.get(i) })), mv = d3.range(12).map(m => byMonth.get(m));
    const dMax = dv.reduce((a, b) => (b.v > a.v ? b : a)), dMin = dv.reduce((a, b) => (b.v < a.v ? b : a));
    document.getElementById("t6note").innerHTML =
      `<b>Reading it:</b> colour changes far more down the rows (months: ${Math.round(d3.min(mv))} to ${Math.round(d3.max(mv))}) than across the columns. ` +
      `Weekday averages only span ${f1(dMin.v)} (${dMin.n}) to ${f1(dMax.v)} (${dMax.n}). ` +
      `Each month × weekday cell holds just 4–5 days, so isolated hot cells (Feb Monday, May Sunday, Nov Saturday) are single spikes, not weekday habits.`;
  }

  /* ---------- Task 7 ---------- */
  function task7(mstat, widest) {
    const c = frame("#c7", 400), x = timeX(c);
    const y = d3.scaleLinear().domain([0, d3.max(mstat, d => d.max) * 1.08]).nice().range([c.h, 0]);
    yAxis(c, y, "PM2.5, city centre (µg/m³)");
    monthAxis(c, x);
    c.g.append("path").datum(mstat).attr("fill", "#d9a27a").attr("fill-opacity", 0.55)
      .attr("d", d3.area().curve(d3.curveMonotoneX).x(d => x(d.mid)).y0(d => y(d.min)).y1(d => y(d.max)));
    [["min"], ["max"]].forEach(([k]) => c.g.append("path").datum(mstat).attr("fill", "none")
      .attr("stroke", "#b8723f").attr("stroke-width", 1).attr("d", d3.line().curve(d3.curveMonotoneX).x(d => x(d.mid)).y(d => y(d[k]))));
    c.g.append("path").datum(mstat).attr("fill", "none").attr("stroke", C.city).attr("stroke-width", 3)
      .attr("d", d3.line().curve(d3.curveMonotoneX).x(d => x(d.mid)).y(d => y(d.mean)));
    c.g.selectAll("circle.mean").data(mstat).join("circle").attr("cx", d => x(d.mid)).attr("cy", d => y(d.mean))
      .attr("r", 3.5).attr("fill", C.city);
    c.g.append("line").attr("x1", x(widest.mid)).attr("x2", x(widest.mid)).attr("y1", y(widest.min)).attr("y2", y(widest.max))
      .attr("stroke", C.alert).attr("stroke-width", 2);
    c.g.append("text").attr("x", x(widest.mid) - 10).attr("y", y(widest.max) + 4).attr("text-anchor", "end")
      .attr("class", "lbl").attr("fill", C.alert)
      .text(`${MONTHS[widest.m]}: ${f1(widest.min)} to ${f1(widest.max)} (range ${f1(widest.range)})`);
    hover(c, x, mstat.map(d => Object.assign({ date: d.mid }, d)),
      [{ y: d => y(d.mean), color: C.city }],
      d => `<b>${MONTHS[d.m]}</b><br>Max ${f1(d.max)}<br>Mean ${f1(d.mean)}<br>Min ${f1(d.min)}<br>Range ${f1(d.range)}`);
    const second = mstat.filter(d => d.m !== widest.m).reduce((a, b) => (b.range > a.range ? b : a));
    document.getElementById("t7note").innerHTML =
      `<b>Widest gap:</b> ${MONTHS[widest.m]} (${f1(widest.range)} µg/m³), then ${MONTHS[second.m]} (${f1(second.range)}). ` +
      `The mean line alone would show ${MONTHS[widest.m]} as an ordinary ${f1(widest.mean)}, and hide a ${f1(widest.max)} peak.`;
  }

  /* ---------- Task 8 ---------- */
  function task8(data, segs, gaps, missingTotal) {
    const c = frame("#c8", 420), x = timeX(c);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.city) * 1.1]).nice().range([c.h, 0]);
    yAxis(c, y, "PM2.5, city centre (µg/m³)");
    monthAxis(c, x);
    shadeGaps(c, x, gaps, true);
    drawLine(c.g.append("g"), segs, x, y, d => d.city, { stroke: C.daily, "stroke-width": 1, opacity: 0.8 });
    drawLine(c.g.append("g"), segs, x, y, d => d.ma, { stroke: C.city, "stroke-width": 3.2 });
    const g = gaps[0], last = d3.timeDay.offset(g.end, -1);
    c.g.append("text").attr("x", x(g.end) + 8).attr("y", 32).attr("class", "lbl").attr("fill", C.ink)
      .text(`${missingTotal} days missing (${fmtDay(g.start)} to ${fmtDay(last)})`);
    hover(c, x, data, [{ y: d => y(d.city), color: C.daily }, { y: d => (d.ma == null ? null : y(d.ma)), color: C.city }],
      d => `<b>${fmtFull(d.date)}</b><br>Daily: ${f1(d.city)}<br>7-day average: ${d.ma == null ? "needs 7 days in a row" : f1(d.ma)}`);
    const low = data.filter(d => d.ma != null).reduce((a, b) => (b.ma < a.ma ? b : a));
        document.getElementById("t8note").innerHTML =
      `<b>Note:</b> ${missingTotal} days are missing, ${fmtDay(g.start)} to ${fmtDay(last)}. The line stops on ${fmtDay(g.before.date)} and restarts on ${fmtDay(g.after.date)}. ` +
      `The 7-day average restarts after the gap, so its first value comes six days later, and no average mixes days from both sides. ` +
      `The average falls to a low of ${f1(low.ma)} (${fmtDay(low.date)}) and climbs back. December's mean (138.8) matches January's (137.6), so the year ends where it began: a seasonal cycle, not a long-term rise or fall.`;
  }

  /* ---------- Task 9 ---------- */
  function task9(data, segs, gaps, widest) {
    const m = { top: 16, right: 26, bottom: 30, left: 56 };
    const hF = 300, gapH = 52, hC = 64, H = m.top + hF + gapH + hC + m.bottom, w = W - m.left - m.right;
    const svg = d3.select("#c9").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img");
    svg.append("defs").append("clipPath").attr("id", "clip9").append("rect").attr("width", w).attr("height", hF);
    const xF = d3.scaleTime().domain(FULL).range([0, w]);
    const xC = d3.scaleTime().domain(FULL).range([0, w]);
    const yMax = d3.max(data, d => d.city) * 1.1;
    const yF = d3.scaleLinear().domain([0, yMax]).nice().range([hF, 0]);
    const yC = d3.scaleLinear().domain(yF.domain()).range([hC, 0]);

    const fg = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const cg = svg.append("g").attr("transform", `translate(${m.left},${m.top + hF + gapH})`);
    const fc = { g: fg, w, h: hF, m };

    fg.append("g").attr("class", "grid").call(d3.axisLeft(yF).ticks(6).tickSize(-w).tickFormat(""));
    fg.append("g").attr("class", "axis").call(d3.axisLeft(yF).ticks(6));
    fg.append("text").attr("class", "axlabel").attr("transform", "rotate(-90)").attr("x", -hF / 2).attr("y", -m.left + 14)
      .attr("text-anchor", "middle").text("PM2.5, city centre (µg/m³)");
    const xAxisG = fg.append("g").attr("class", "axis").attr("transform", `translate(0,${hF})`);
    const clipped = fg.append("g").attr("clip-path", "url(#clip9)");
    const gapRects = clipped.selectAll("rect.gp").data(gaps).join("rect").attr("fill", C.gap).attr("opacity", 0.22).attr("y", 0).attr("height", hF);
    const gapLbl = clipped.selectAll("text.gl").data(gaps).join("text").attr("class", "lbl").attr("y", 14)
      .attr("text-anchor", "middle").attr("fill", C.ink).text("No data: sensor offline");
    [75].forEach(v => {
      clipped.append("line").attr("x1", 0).attr("x2", w).attr("y1", yF(v)).attr("y2", yF(v))
        .attr("stroke", C.alert).attr("stroke-dasharray", "6 4");
      fg.append("text").attr("x", w).attr("y", yF(v) - 5).attr("text-anchor", "end").attr("class", "lbl")
        .attr("fill", C.alert).text("75 µg/m³");
    });
    const lineGen = d3.line().x(d => xF(d.date)).y(d => yF(d.city));
    const maGen = d3.line().defined(d => d.ma != null).x(d => xF(d.date)).y(d => yF(d.ma));
    const dailyP = clipped.selectAll("path.d").data(segs).join("path").attr("fill", "none").attr("stroke", C.daily).attr("stroke-width", 1.2);
    const maP = clipped.selectAll("path.m").data(segs).join("path").attr("fill", "none").attr("stroke", C.city).attr("stroke-width", 2.8);
    const ptG = clipped.append("g");
    hover(fc, xF, data, [{ y: d => yF(d.city), color: C.city }],
      d => `<b>${fmtFull(d.date)}</b><br>PM2.5: ${f1(d.city)} µg/m³<br>${levelOf(d.city)}`);

    // overview (context)
    cg.append("g").attr("class", "grid").call(d3.axisLeft(yC).ticks(2).tickSize(-w).tickFormat(""));
    cg.append("g").attr("class", "axis").attr("transform", `translate(0,${hC})`)
      .call(d3.axisBottom(xC).ticks(d3.timeMonth).tickFormat(fmtMon));
    const cl = d3.line().x(d => xC(d.date)).y(d => yC(d.city));
    cg.selectAll("path.o").data(segs).join("path").attr("fill", "none").attr("stroke", C.city).attr("stroke-width", 1).attr("d", s => cl(s));
    cg.selectAll("rect.og").data(gaps).join("rect").attr("x", g => xC(g.start)).attr("width", g => xC(g.end) - xC(g.start))
      .attr("height", hC).attr("fill", C.gap).attr("opacity", 0.22);
    cg.append("text").attr("class", "axlabel").attr("x", 0).attr("y", -8).text("Overview: drag to choose dates");

    function update() {
      const [d0, d1] = xF.domain();
      const span = d3.timeDay.count(d0, d1);
      const ax = d3.axisBottom(xF);
      if (span > 150) ax.ticks(d3.timeMonth).tickFormat(fmtMon);
      else if (span > 45) ax.ticks(d3.timeWeek.every(1)).tickFormat(fmtDay);
      else ax.ticks(d3.timeDay.every(span > 18 ? 2 : 1)).tickFormat(fmtDay);
      xAxisG.call(ax);
      dailyP.attr("d", s => lineGen(s));
      maP.attr("d", s => maGen(s));
      gapRects.attr("x", g => xF(g.start)).attr("width", g => xF(g.end) - xF(g.start));
      gapLbl.attr("x", g => (xF(g.start) + xF(g.end)) / 2);
      const vis = data.filter(d => d.date >= d0 && d.date <= d1);
      ptG.selectAll("circle").data(span <= 62 ? vis : []).join("circle").attr("r", 3.6)
        .attr("fill", C.city).attr("cx", d => xF(d.date)).attr("cy", d => yF(d.city));
      const peak = vis.length ? vis.reduce((a, b) => (b.city > a.city ? b : a)) : null;
      document.getElementById("zinfo").innerHTML = vis.length
        ? `<b>${fmtDay(d0)} to ${fmtFull(d1)}</b>: ${vis.length} readings, mean ${f1(d3.mean(vis, d => d.city))}, peak ${f1(peak.city)} on ${fmtDay(peak.date)}`
        : "No readings in this range";
    }

    const brush = d3.brushX().extent([[0, 0], [w, hC]]).on("brush end", ev => {
      if (!ev.selection) xF.domain(FULL);
      else xF.domain(ev.selection.map(xC.invert));
      update();
    });
    const gb = cg.append("g").attr("class", "brush").call(brush);
    gb.call(brush.move, [0, w]);
    document.getElementById("reset").addEventListener("click", () => gb.call(brush.move, [0, w]));
    document.getElementById("goWide").addEventListener("click", () => {
      const a = new Date(2025, widest.m, 1), b = new Date(2025, widest.m + 1, 0);
      gb.call(brush.move, [xC(a), xC(b)]);
    });
  }
})();
