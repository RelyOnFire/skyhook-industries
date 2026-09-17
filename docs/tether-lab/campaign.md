# Expeditions: a working network

Routes: /lab/campaign/ and the public guide /lab/campaign/method/.

The Earth–Moon–Phobos campaign has two linked objectives: establish the tethers,
then sustain industry and scheduled deliveries. The Moon's lunavator remains a
free lunar rotor. Phobos itself anchors the inward and outward tethers.

## Economy and scheduling

Construction material remains the original cargo stock. Equipment is a second
resource, carried with the same finite payload, fuel and recovery rules.
Earth begins with manufacturing and 20 t equipment, contributing 0.5 t equipment
and 1 t pooled propellant per day. Surface resources and access are abstracted.

A remote industry requires a tether and consumes 20 t construction plus 5 t
equipment. The lunar processor produces 1 t construction/day using 0.05 t
equipment/day. Phobos staging consumes 0.5 t construction and 0.02 t
equipment/day for one Mars operations point. These are game recipes and abstract
activity points, not engineering estimates or modeled surface missions.
Industry stops at missing inputs or full storage; only completed output consumes
inputs. Incoming flights reserve depot storage (one million tonnes/resource).

The direct Moon–Phobos corridor works in both directions. Its ideal solar coast
time approximates the Moon at Earth's heliocentric radius; four handling days
replace the Earth–Phobos allowance of three. Existing route durations are
unchanged. No launch windows, ephemerides, lunar escape, Phobos interception,
capture loads, surface pickup or flexible dynamics are solved. Tether ratings,
instant construction, fuel allocations and endpoint recovery remain game rules.
The detailed Earth Flight Studio is separate and unchanged.

Each of up to twelve recurring services uses the manual dispatch checks. First
attempt is tomorrow. After success, next attempt is departure + chosen interval
(1–3,650 days). Blocked service retries in one day; no catch-up queue accumulates.
Arrivals precede bookings at the same instant, then ascending service ID controls
shared endpoint priority. Pause/remove leaves active flights intact. Resume
cannot create overdue attempts. Traffic remains limited to 32 active flights.

advance() processes every arrival and service attempt chronologically. Production
integrates between events, so large jumps and small steps give equivalent stock,
flights, service history and progress (within floating-point tolerance). The
manual +1/+30/next-event controls and Play share this engine. Play performs one
saved step per second at 1, 10 or 30 days/step; it waits for saves before ticking
again. Hidden tabs, reload, world changes, errors and the 100,000-day horizon stop
play. No offline or wall-clock catch-up. Marker movement is schematic elapsed
fraction; tracked flight and arrival panels explain status. Reduced motion
disables marker transitions.

A sustainable scenario tested for 1,000 days sends 5 t Earth–Moon equipment every
90 days, 3 t Earth–Phobos equipment every 100 days, and 10 t Moon–Phobos material
every 20 days. The player first commissions both tethers and supplies the
20 t/5 t installation requirements plus working equipment.

## Saves and compatibility

IndexedDB skyhook-campaigns stays at database version 1, with the same worlds
store. Current state schema 2 / network-0.2.0 exports in a skyhook-campaign
version-2 envelope. The validator explicitly accepts and migrates schema 1 /
network-0.1.0, including original version-one backup envelopes.

Migration preserves ID, name, simulation day, revision, all old depot fields,
fuel, objectives, logs, flight IDs and arrival dates. Flights become construction
cargo with no recurring-service ID. Earth gains manufacturing and 20 t equipment,
the remote industries start unbuilt, and schedules/progress start empty. No
retroactive production. Reading does not rewrite IndexedDB. The first save
atomically retains the old head in its checkpoint history. A schema-only Save now
also increments revision so an old cached app cannot overwrite the migrated head
with its previously valid revision. Normal gameplay increments it as before.

Atomic writes compare the stored revision with the writer token; failed writes
preserve committed state. The UI retains unsaved state for retry/export and
stops automatic time. Three previous checkpoints and up to twelve named slots
remain. Unchanged saves are no-ops. Import and recovery create separate IDs.
Unknown versions and malformed inputs are rejected before changing the world.
Local saves belong to their origin/browser; portable JSON moves between origins
or devices. No account/cloud sync.

## Verification

tests/lab-campaign.test.mjs tests legacy progression, exact one-time cargo
delivery, v1 backup migration (a real prior QA export), active-flight migration,
recipe starvation, direct lunar/Phobos supply, large/small step equivalence,
reload mid-schedule, shared recovery contention, arrival-before-dispatch,
pause/remove semantics, incoming storage reservation, traffic/service/horizon
limits, and malformed schedule rejection.

tests/campaign.browser.py plays both chapters, including producing material,
delivering equipment, installing both industries, scheduling three complementary
routes, flight tracking and arrivals, pause/resume, accelerated play and reload.
It also covers portable backup/import, checkpoint branches, competing tabs,
automatic-clock stop on an injected write failure and successful retry, and
migration of a native version-one IndexedDB record with checkpoint preservation.
Responsive captures cover 1440, 1000, 768, 390 and 320 px; the method guide works
without JavaScript. CI also runs existing Flight Studio/electrodynamic/navigation
regressions and verifies reference outputs.

## Later chapters and sources

Mercury mining, mirror manufacture and a solar swarm remain future chapters.
Detailed lunavator geometry, Phobos loads, targeting/launch windows and integration
with tested Flight Studio designs require separate numerical work.

- Hoyt, Cislunar Tether Transport System, NIAC 1999, summary, III.A.3 and Appendix B:
  https://www.niac.usra.edu/files/studies/final_report/7Hoyt.pdf
- Weinstein, Space Colonization Using Space-Elevators from Phobos, 2003:
  https://ntrs.nasa.gov/citations/20030065879
- https://ssd.jpl.nasa.gov/astro_par.html
- https://ssd.jpl.nasa.gov/planets/approx_pos.html
- https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
