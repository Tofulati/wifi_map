# Wi-Fi Map

A map of measured Wi-Fi speeds. Stand somewhere, type the network's name, press **Measure this network**, and the app runs a speed test, tags the result with your GPS position, and plots it. Readings build up into colored speed zones per network, so you can see where a cafe's Wi-Fi is fast, where it drops off, and which network nearby is best for streaming, gaming, or video calls.

Everything runs in the browser. There is no backend: readings are stored in your browser's `localStorage`.

## Quick start

Requires Node.js 20.19+ or 22.12+ (Vite 8's minimum).

```bash
npm install
npm run dev        # http://localhost:5173
```

Measuring needs location permission. Browsers only grant it on `localhost` or over HTTPS, so to test on a phone, expose the dev server through an HTTPS tunnel such as `cloudflared` or `ngrok`.

In development, **Show demo data** at the bottom of the side panel fills the map with seeded fake readings around the current view. Demo readings are never saved.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-checks (`tsc -b`) then builds to `dist/` |
| `npm run preview` | Serves the built `dist/` locally |
| `npm run lint` | ESLint over all TypeScript files |

## CI and deployment

Workflows live in [`../.github/workflows/`](../.github/workflows/):

- **`lint.yml`** runs ESLint and `tsc -b` on every pull request.
- **`deploy.yml`** runs on every push to `main`: it runs the lint workflow, then builds with the GitHub Pages base path and publishes to [tofulati.github.io/wifi_map](https://tofulati.github.io/wifi_map/). It can also be started by hand from the Actions tab.

Pages must be set to deploy from **GitHub Actions** (Settings → Pages → Source).

## Project layout

```
src/
├── main.tsx                 Entry point: mounts <App> and loads global styles
├── App.tsx
├── styles/
│   ├── global.css           Page-level rules (html, body, #root)
│   └── variables.css        Shared colors and font sizes as CSS custom properties
├── components/              One folder per component: Component.tsx + Component.css
│   ├── map/
│   │   └── WifiMap/         The map and the app's top-level state; WifiMap.styles.ts holds MapLibre paint
│   ├── panel/               Everything inside the collapsible side panel
│   │   ├── SidePanel/       The sliding container
│   │   ├── SearchControl/   Place search box
│   │   ├── YourLocation/    "Your location" section: nearby networks + MeasurePanel
│   │   ├── MeasurePanel/    Network-name input and the measure button
│   │   ├── SelectedNetwork/ Detail view after clicking a dot
│   │   └── PlaceDetails/    Place name, coordinates, and networks near it
│   └── network/             Small speed displays reused by the panel and map popups
│       ├── NetworkSpeedCard/
│       ├── NetworkSummary/  Per-activity rating bars
│       └── SpeedFigures/    "185.4 Mbps down · 37.1 up · 14 ms ping"
├── hooks/
│   └── usePlaceName.ts      Reverse-geocodes coordinates into a place name
├── lib/                     Logic and I/O, no React
│   ├── coordinates.ts       Coordinates type, formatting, meters-per-degree math
│   ├── networkReading.ts    Reading type; runs the speed test and GPS lookup
│   ├── networkName.ts       Cleans and matches network names ("cafenet" → "CafeNet")
│   ├── readingStore.ts      Load/save readings in localStorage
│   ├── nearbyReadings.ts    Averages readings per network near a point
│   ├── activitySupport.ts   Rates speeds for streaming, gaming, calls, etc.
│   ├── speedContours.ts     Turns readings into colored speed zones
│   └── photonGeocoder.ts    Place search and reverse geocoding via Photon
└── data/
    └── demoReadings.ts      Seeded fake readings for development
```

**Where to put new code:** React components go in `components/<area>/<Name>/`. Logic that doesn't render anything goes in `lib/`. Shared visual values go in `styles/variables.css`.

## Tech stack

- [React 19](https://react.dev) + TypeScript, built with [Vite](https://vite.dev)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) through [react-map-gl](https://visgl.github.io/react-map-gl/) for the map
- [@cloudflare/speedtest](https://github.com/cloudflare/speedtest) for download, upload, and latency
- [Turf](https://turfjs.org) (`interpolate`, `isobands`, `intersect`, `difference`, `distance`) for the speed zones
- [@maplibre/maplibre-gl-geocoder](https://github.com/maplibre/maplibre-gl-geocoder) for the search box

## External services

These are all public, keyless endpoints:

| Service | Used for | Where |
| --- | --- | --- |
| [Cloudflare speed test](https://speed.cloudflare.com) | Measuring speeds | `lib/networkReading.ts` |
| [Photon](https://photon.komoot.io) (Komoot's demo server) | Place search and place names | `lib/photonGeocoder.ts` |
| [CARTO Positron](https://github.com/CartoDB/basemap-styles) | Basemap tiles | `components/map/WifiMap/WifiMap.tsx` |

Photon's demo server has no uptime guarantee and asks for reasonable traffic only. Self-host it if the app gets real users.

## Further reading

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): how state, data, and rendering fit together, and how speed zones are computed
- [`../.cursor/rules/code-style.mdc`](../.cursor/rules/code-style.mdc): code conventions (naming, styling, React patterns)
