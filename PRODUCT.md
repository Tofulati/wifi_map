# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People testing Wi-Fi in a place who want to understand where the connection is fast or weak.

## Product Purpose

Wi-Fi Map lets people measure a network's download speed, upload speed, and latency at their
current location, then see those readings plotted as speed zones on a map. Success means making
the spatial pattern of a network's performance understandable enough to find stronger or weaker
spots.

## Positioning

The product builds a location-aware map of Wi-Fi performance over repeated measurements, rather
than only reporting one speed test.

## Operating Context

Users stand in or move through a place, enter the Wi-Fi network name, run a measurement, and
return to the map to inspect readings and nearby network summaries. Place search and current
location support help users explore a specific area.

## Capabilities and Constraints

- Runs in the browser and requires location permission for measurements.
- Records download speed, upload speed, latency, and GPS position when browser capabilities allow.
- Plots readings and derived colored speed zones per network.
- Supports place search and inspection of nearby networks.
- Saves readings to local storage immediately and remains usable offline.
- Can synchronize readings to Supabase when configured; failed uploads remain local for retry.
- Demo readings are available for development and are never persisted.
- Never expose a Supabase service-role key in the browser.
- Do not fabricate readings or product claims.

## Evidence on Hand

- Product description and setup instructions: [wifi_map/README.md](wifi_map/README.md)
- Architecture and data-flow documentation: [wifi_map/docs/ARCHITECTURE.md](wifi_map/docs/ARCHITECTURE.md)
- Main map workflow and state orchestration: [wifi_map/src/components/map/WifiMap/WifiMap.tsx](wifi_map/src/components/map/WifiMap/WifiMap.tsx)
- Browser entry point: [wifi_map/src/App.tsx](wifi_map/src/App.tsx)
- Supabase schema migration: [wifi_map/supabase/migrations/20261112000000_create_measurements.sql](wifi_map/supabase/migrations/20261112000000_create_measurements.sql)

## Product Principles

- Make Wi-Fi performance spatially understandable.
- Preserve useful local data when connectivity or remote services are unavailable.
- Make measurement provenance and uncertainty clear.
- Keep the measurement workflow direct and lightweight.
- Treat privacy and credential safety as product constraints, not afterthoughts.

## Accessibility & Inclusion

No product-specific accessibility standard was confirmed. Future work should preserve browser
accessibility fundamentals and avoid making map interaction the only way to access measurement
results.
