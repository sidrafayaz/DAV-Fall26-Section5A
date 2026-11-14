const tooltip = d3.select("#tooltip");

const showTip = (event, html) =>
  tooltip.style("opacity", 1).html(html)
    .style("left", event.pageX + 12 + "px")
    .style("top", event.pageY + 12 + "px");

const hideTip = () => tooltip.style("opacity", 0);

const makeSvg = (id, w, h) => d3.select(id).attr("viewBox", [0, 0, w, h]);

// University -> Department -> Course
const buildHierarchy = data => ({
  name: "University",
  children: Array.from(d3.group(data, d => d.department), ([name, rows]) => ({
    name,
    children: rows.map(r => ({ name: r.course, students: r.students }))
  }))
});

Promise.all([
  d3.csv("dataset/university.csv", d3.autoType),
  d3.csv("dataset/flights.csv", d3.autoType),
  d3.csv("dataset/pakistan_cities.csv", d3.autoType),
  d3.csv("dataset/population.csv", d3.autoType),
  d3.json("dataset/world.geojson")
]).then(([university, flights, cities, population, world]) => {
  task1(university);
  task2(university);
  task3(flights);
  task4(population, world);
  task5(cities, world);
  task6(cities, flights, world);
});

/* ---------- Task 1: Treemap ---------- */
function task1(data) {
  const w = 900, h = 560;
  const svg = makeSvg("#t1", w, h);

  const root = d3.hierarchy(buildHierarchy(data))
    .sum(d => d.students)
    .sort((a, b) => b.value - a.value);

  // extra top padding on departments leaves room for their label
  d3.treemap().size([w, h - 70])
    .paddingInner(2).paddingOuter(3)
    .paddingTop(d => d.depth === 1 ? 20 : 3)(root);

  const depts = root.children.map(d => d.data.name);
  const color = d3.scaleOrdinal(depts, ["#4e79a7", "#e15759", "#59a14f", "#b07aa1"]);

  svg.append("text").attr("x", 10).attr("y", 24).attr("font-size", 18).attr("font-weight", "bold")
    .text("Course Enrollment by Department (area = number of students)");

  const legend = svg.append("g").attr("transform", "translate(10,40)");
  depts.forEach((name, i) => {
    legend.append("rect").attr("x", i * 170).attr("width", 14).attr("height", 14).attr("fill", color(name));
    legend.append("text").attr("x", i * 170 + 20).attr("y", 12).attr("font-size", 13).text(name);
  });

  const g = svg.append("g").attr("transform", "translate(0,70)");

  g.selectAll(".dept").data(root.children).join("g")
    .each(function (d) {
      const node = d3.select(this);
      node.append("rect").attr("x", d.x0).attr("y", d.y0)
        .attr("width", d.x1 - d.x0).attr("height", d.y1 - d.y0)
        .attr("fill", color(d.data.name)).attr("fill-opacity", 0.2);
      node.append("text").attr("x", d.x0 + 5).attr("y", d.y0 + 15)
        .attr("font-weight", "bold").text(d.data.name);
    });

  const leaf = g.selectAll(".leaf").data(root.leaves()).join("g")
    .attr("transform", d => `translate(${d.x0},${d.y0})`)
    .on("mousemove", (event, d) => showTip(event,
      `<b>${d.data.name}</b><br>Department: ${d.parent.data.name}<br>Students: ${d.value}`))
    .on("mouseout", hideTip);

  leaf.append("rect")
    .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
    .attr("fill", d => color(d.parent.data.name));

  leaf.append("text").attr("x", 6).attr("y", 18).attr("fill", "white").attr("font-size", 13)
    .text(d => d.data.name);
}

/* ---------- Task 2: Dendrogram ---------- */
function task2(data) {
  const w = 900, h = 520, m = { top: 20, right: 180, bottom: 20, left: 130 };
  const svg = makeSvg("#t2", w, h);
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  const root = d3.hierarchy(buildHierarchy(data));
  const cluster = d3.cluster().size([h - m.top - m.bottom, w - m.left - m.right]);
  const color = d3.scaleOrdinal([0, 1, 2], ["#444", "#e15759", "#4e79a7"]);
  // horizontal layout: swap x and y
  const link = d3.linkHorizontal().x(d => d.y).y(d => d.x);

  function update() {
    cluster(root);

    g.selectAll("path.link").data(root.links(), d => d.target.data.name).join("path")
      .attr("class", "link").attr("fill", "none").attr("stroke", "#aaa").attr("d", link);

    const nodes = g.selectAll("g.node").data(root.descendants(), d => d.data.name)
      .join(enter => {
        const n = enter.append("g").attr("class", "node");
        n.append("circle").attr("r", 7);
        n.append("text").attr("dy", "0.32em");
        return n;
      })
      .attr("transform", d => `translate(${d.y},${d.x})`);

    nodes.select("circle")
      .attr("fill", d => color(d.depth))
      .style("cursor", d => d.depth === 1 ? "pointer" : "default")
      .on("click", (event, d) => {
        if (d.depth !== 1) return;
        [d.children, d._children] = [d._children, d.children];
        update();
      });

    // leaf labels on the right, parent labels on the left (white halo keeps them readable over links)
    nodes.select("text")
      .attr("x", d => d.depth === 2 ? 12 : -12)
      .attr("text-anchor", d => d.depth === 2 ? "start" : "end")
      .attr("stroke", "white").attr("stroke-width", 4).attr("paint-order", "stroke")
      .text(d => d.data.name);
  }

  update();
}

/* ---------- Task 3: Force-directed flight network ---------- */
function task3(edges) {
  const w = 900, h = 560;
  const svg = makeSvg("#t3", w, h);

  const links = edges.map(d => ({ ...d }));
  // node list from the unique cities in the edge list
  const ids = edges.flatMap(d => [d.source, d.target]);
  const degree = d3.rollup(ids, v => v.length, d => d);
  const nodes = Array.from(new Set(ids), id => ({ id, degree: degree.get(id) }));

  const width = d3.scaleLinear().domain(d3.extent(links, d => d.flights)).range([1, 10]);
  const radius = d3.scaleSqrt().domain(d3.extent(nodes, d => d.degree)).range([8, 24]);

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(130))
    .force("charge", d3.forceManyBody().strength(-400))
    .force("center", d3.forceCenter(w / 2, h / 2))
    .force("collide", d3.forceCollide(d => radius(d.degree) + 12));

  const link = svg.append("g").attr("stroke", "#999").attr("stroke-opacity", 0.7)
    .selectAll("line").data(links).join("line")
    .attr("stroke-width", d => width(d.flights))
    .on("mousemove", (event, d) => showTip(event,
      `${d.source.id} - ${d.target.id}<br>${d.flights} flights/week`))
    .on("mouseout", hideTip);

  const node = svg.append("g").selectAll("g").data(nodes).join("g")
    .call(d3.drag()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      }));

  node.append("circle").attr("r", d => radius(d.degree)).attr("fill", "#4e79a7")
    .attr("stroke", "white").attr("stroke-width", 1.5);
  node.append("text").attr("text-anchor", "middle").attr("font-size", 12)
    .attr("dy", d => radius(d.degree) + 14).text(d => d.id);

  const connected = (a, b) => a === b ||
    links.some(l => (l.source === a && l.target === b) || (l.source === b && l.target === a));

  node.on("mouseover", (event, d) => {
      link.attr("stroke-opacity", l => l.source === d || l.target === d ? 1 : 0.08);
      node.attr("opacity", n => connected(d, n) ? 1 : 0.2);
    })
    .on("mousemove", (event, d) => showTip(event, `<b>${d.id}</b><br>Routes: ${d.degree}`))
    .on("mouseout", () => {
      hideTip();
      link.attr("stroke-opacity", 0.7);
      node.attr("opacity", 1);
    });

  simulation.on("tick", () => {
    link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });
}

/* ---------- Task 4: World population choropleth ---------- */
function task4(population, world) {
  const w = 960, h = 560;
  const svg = makeSvg("#t4", w, h);

  const byId = new Map(population.map(d => [d.id, d]));
  const [min, max] = d3.extent(population, d => d.population_millions);
  const color = d3.scaleSequentialSqrt(d3.interpolateYlOrRd).domain([min, max]);

  const projection = d3.geoNaturalEarth1().fitSize([w, h - 70], world);
  const path = d3.geoPath(projection);

  svg.append("g").selectAll("path").data(world.features).join("path")
    .attr("d", path)
    .attr("fill", d => byId.has(d.id) ? color(byId.get(d.id).population_millions) : "#e0e0e0")
    .attr("stroke", "white").attr("stroke-width", 0.5)
    .on("mousemove", function (event, d) {
      const rec = byId.get(d.id);
      d3.select(this).raise().attr("stroke", "black").attr("stroke-width", 1.5);
      showTip(event, `<b>${d.properties.name}</b><br>` +
        (rec ? `Population: ${rec.population_millions} million` : "No data"));
    })
    .on("mouseout", function () {
      d3.select(this).attr("stroke", "white").attr("stroke-width", 0.5);
      hideTip();
    });

  // gradient legend
  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient").attr("id", "legend-gradient");
  d3.range(0, 1.01, 0.1).forEach(t =>
    gradient.append("stop").attr("offset", t * 100 + "%").attr("stop-color", color(min + t * (max - min))));

  const legend = svg.append("g").attr("transform", `translate(${w / 2 - 150},${h - 45})`);
  legend.append("rect").attr("width", 300).attr("height", 14).attr("fill", "url(#legend-gradient)");
  legend.append("text").attr("y", 30).attr("font-size", 12).text(`${min} M`);
  legend.append("text").attr("x", 300).attr("y", 30).attr("font-size", 12).attr("text-anchor", "end").text(`${max} M`);
  legend.append("rect").attr("x", 330).attr("width", 14).attr("height", 14).attr("fill", "#e0e0e0");
  legend.append("text").attr("x", 350).attr("y", 12).attr("font-size", 12).text("No data");
}

/* ---------- Shared helpers for Tasks 5 and 6 ---------- */
function pakistanProjection(world, extent) {
  const pakistan = world.features.find(f => f.id === "PAK");
  return d3.geoMercator().fitExtent(extent, pakistan);
}

function drawBaseMap(svg, projection, world) {
  svg.append("g").selectAll("path").data(world.features).join("path")
    .attr("d", d3.geoPath(projection))
    .attr("fill", "#f2f2f2").attr("stroke", "#bbb");
}

/* ---------- Task 5: Pakistan cities point map ---------- */
function task5(cities, world) {
  const w = 700, h = 650;
  const svg = makeSvg("#t5", w, h);
  const projection = pakistanProjection(world, [[20, 20], [w - 20, h - 20]]);
  drawBaseMap(svg, projection, world);

  // area proportional to population -> radius ~ sqrt(population)
  const radius = d3.scaleSqrt().domain([0, d3.max(cities, d => d.pop)]).range([0, 45]);
  // largest first, so small cities stay on top
  const sorted = [...cities].sort((a, b) => b.pop - a.pop);
  sorted.forEach(c => [c.x, c.y] = projection([c.lon, c.lat]));

  svg.append("g").selectAll("circle").data(sorted).join("circle")
    .attr("cx", d => d.x).attr("cy", d => d.y).attr("r", d => radius(d.pop))
    .attr("fill", "#e15759").attr("fill-opacity", 0.5)
    .attr("stroke", "#a02a2c")
    .on("mousemove", (event, d) => showTip(event, `<b>${d.name}</b><br>Population: ${d.pop} million`))
    .on("mouseout", hideTip);

  svg.append("g").selectAll("text").data(sorted.filter(d => d.pop > 1)).join("text")
    .attr("x", d => d.x).attr("y", d => d.y - radius(d.pop) - 4)
    .attr("text-anchor", "middle").attr("font-size", 12)
    .attr("stroke", "white").attr("stroke-width", 3).attr("paint-order", "stroke")
    .text(d => d.name);
}

/* ---------- Task 6: Combined spatial encoding map ---------- */
function task6(cities, flights, world) {
  const w = 950, h = 650;
  const svg = makeSvg("#t6", w, h);
  const projection = pakistanProjection(world, [[20, 20], [w - 260, h - 20]]);
  drawBaseMap(svg, projection, world);

  const byName = new Map(cities.map(c => [c.name, c]));
  cities.forEach(c => [c.x, c.y] = projection([c.lon, c.lat]));

  // routes per city; hub = 4 or more routes
  const degree = d3.rollup(flights.flatMap(d => [d.source, d.target]), v => v.length, d => d);
  cities.forEach(c => c.degree = degree.get(c.name) || 0);

  const width = d3.scaleLinear().domain(d3.extent(flights, d => d.flights)).range([1, 8]);
  const radius = d3.scaleSqrt().domain([0, d3.max(cities, d => d.pop)]).range([0, 30]);
  const fill = d => d.degree >= 4 ? "#d62728" : "#1f77b4";

  // routes first, cities on top
  const route = svg.append("g").attr("stroke", "#555").attr("stroke-opacity", 0.5)
    .selectAll("line").data(flights).join("line")
    .attr("x1", d => byName.get(d.source).x).attr("y1", d => byName.get(d.source).y)
    .attr("x2", d => byName.get(d.target).x).attr("y2", d => byName.get(d.target).y)
    .attr("stroke-width", d => width(d.flights))
    .on("mousemove", (event, d) => showTip(event, `${d.source} - ${d.target}<br>${d.flights} flights/week`))
    .on("mouseout", hideTip);

  const sorted = [...cities].sort((a, b) => b.pop - a.pop);
  const city = svg.append("g").selectAll("circle").data(sorted).join("circle")
    .attr("cx", d => d.x).attr("cy", d => d.y).attr("r", d => radius(d.pop))
    .attr("fill", fill).attr("fill-opacity", 0.75).attr("stroke", "white");

  const label = svg.append("g").selectAll("text").data(sorted).join("text")
    .attr("x", d => d.x).attr("y", d => d.y - radius(d.pop) - 4)
    .attr("text-anchor", "middle").attr("font-size", 11)
    .attr("stroke", "white").attr("stroke-width", 3).attr("paint-order", "stroke")
    .text(d => d.name);

  const linked = (a, b) => a === b || flights.some(f =>
    (f.source === a.name && f.target === b.name) || (f.source === b.name && f.target === a.name));

  city.on("mouseover", (event, d) => {
      route.attr("stroke-opacity", f => f.source === d.name || f.target === d.name ? 1 : 0.05);
      city.attr("opacity", c => linked(d, c) ? 1 : 0.2);
    })
    .on("mousemove", (event, d) => showTip(event,
      `<b>${d.name}</b><br>Population: ${d.pop} million<br>Routes: ${d.degree}${d.degree >= 4 ? " (hub)" : ""}`))
    .on("mouseout", () => {
      hideTip();
      route.attr("stroke-opacity", 0.5);
      city.attr("opacity", 1);
    });

  // legend for the four encodings
  const lg = svg.append("g").attr("transform", `translate(${w - 240},30)`).attr("font-size", 12);
  const text = (x, y, s, opts = {}) => lg.append("text").attr("x", x).attr("y", y)
    .attr("font-weight", opts.bold ? "bold" : null).attr("text-anchor", opts.anchor || "start").text(s);

  text(0, 0, "Position: city location", { bold: true });

  text(0, 35, "Color", { bold: true });
  [["#d62728", "Hub (4+ routes)"], ["#1f77b4", "Other city"]].forEach(([c, label], i) => {
    lg.append("circle").attr("cx", 10).attr("cy", 55 + i * 25).attr("r", 8).attr("fill", c).attr("fill-opacity", 0.75);
    text(28, 59 + i * 25, label);
  });

  text(0, 125, "Circle size: population", { bold: true });
  [1, 5, 15].forEach((p, i) => {
    const x = 35 + i * 80;
    lg.append("circle").attr("cx", x).attr("cy", 175).attr("r", radius(p))
      .attr("fill", "#999").attr("fill-opacity", 0.6);
    text(x, 220, `${p} M`, { anchor: "middle" });
  });

  text(0, 255, "Line width: flights per week", { bold: true });
  [10, 40, 70].forEach((f, i) => {
    lg.append("line").attr("x1", 0).attr("x2", 60).attr("y1", 280 + i * 25).attr("y2", 280 + i * 25)
      .attr("stroke", "#555").attr("stroke-width", width(f));
    text(75, 284 + i * 25, `${f} flights`);
  });
}
