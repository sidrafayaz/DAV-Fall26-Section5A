# D3 Data Visualization Tasks

A single page (`index.html`) with six D3 v7 visualizations. Each one has sticky notes on either side explaining the key ideas.

## Run it

The page loads CSV/GeoJSON files, so it must be served, not opened directly:

```bash
python -m http.server
```

Then open http://localhost:8000

## Files

Put these in the same folder as `index.html`:

| File | Columns | Used by |
|---|---|---|
| `university.csv` | `department, course, students` | Tasks 1, 2 |
| `flights.csv` | `source, target, flights` | Tasks 3, 6 |
| `population.csv` | `id, country, population_millions` | Task 4 |
| `pakistan_cities.csv` | `name, lat, lon, pop` | Tasks 5, 6 |
| `world.geojson` | country shapes with 3-letter ISO ids (e.g. `PAK`) | Tasks 4, 5, 6 |

Notes:
- `population.csv` `id` must use the same 3-letter codes as the map.
- City names in `pakistan_cities.csv` must match `source`/`target` in `flights.csv` exactly.
- `pop` is assumed to be a raw head-count (labels show cities above 1,000,000).

## The tasks

1. **Treemap**: course enrollment; area = students, color = department, tooltip on hover.
2. **Dendrogram**: University → Department → Course; click a department to collapse/expand.
3. **Force network**: cities linked by flights; link width = flights/week, node size = number of routes, draggable, hover highlights routes.
4. **Choropleth**: world population; square-root color scale, light gray = no data, hover border + tooltip, legend with min/max.
5. **Pakistan point map**: Mercator fitted to Pakistan; circle area = population (sqrt scale), semi-transparent, labels only above 1 million.
6. **Combined map**: routes drawn first, cities on top; position = location, size = population, color = hub (4+ routes), line width = flights/week; legend and hover highlight.

## Tweaks

- Pakistan map too tight or loose: change `pad` in `pakistanProjection()`.
- Different map file name: change `d3.json("world.geojson")`.
- Hub threshold: change `>= 4` in `isHub` (Task 6).
