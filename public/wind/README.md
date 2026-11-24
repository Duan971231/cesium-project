# Wind sample

- File: `gfs-10m.json` (unaltered JSON snapshot)
- Model: NOAA GFS, 10 metres above ground, analysis (forecastTime = 0).
- Reference / valid time: 2026-11-23 18:00 UTC.
- Grid: 360 × 181 points, 1 degree, global, north to south, longitude 0–359.
- Components: U (eastward), V (northward), units m/s.
- Downloaded: 2026-11-24.
- JSON publisher: https://github.com/aaronyooht/wingmate-wind-data
- File: https://github.com/aaronyooht/wingmate-wind-data/blob/master/docs/wind-global-1deg.json
- Git blob SHA: `ffcddfed6a5e2952837fdab29a2bd01063d92956`.

The publisher converts NOAA GFS data from NOMADS to JSON. This checked-in sample
is static; it is not live weather and does not update automatically. The JSON
header is authoritative for the data time. Particle motion is accelerated for
visualization and represents air moving **toward** its destination; meteorological
wind direction describes where wind comes **from**.

The renderer reads the file from the local public URL; no third-party request is
needed at runtime. Replace it with a compatible U/V pair to change the snapshot.
