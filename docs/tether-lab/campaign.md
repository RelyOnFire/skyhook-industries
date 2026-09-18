# Expeditions: from first corridors to first light

Routes: /lab/campaign/ and the public guide /lab/campaign/method/.

The campaign has three linked chapters: establish Earth–Moon–Phobos tethers,
sustain industry and scheduled deliveries, then develop Mercury and a solar swarm. The Moon's lunavator remains a
free lunar rotor. Phobos itself anchors the inward and outward tethers.

## Operations interface

The campaign is one operations workspace: all outposts and their local stocks,
inbound cargo, industry rates and tether availability stay exposed. Choosing a
destination highlights it without hiding other depots. Each outpost has supply
shortcuts that prepare the cargo form, choose tug/tether based on commissioned
endpoints, and suggest a maintenance interval; they never dispatch automatically.

The map is the largest desktop panel, highlights the planned corridor, supports
keyboard destination selection, and shows the swarm around the same Sun. Cargo
and mirror deployments share an arrival-ordered traffic queue above scheduled
services, so arrivals take precedence and recurring supply follows immediately.
Both lists have bounded keyboard scrolling that tightens on shorter desktops.
The delivery composer sits directly under
the map; mirror operations follow it. The clock and pooled totals share a sticky
bar. At smaller widths the workspace reflows, with anchor links to Outposts, Map,
Traffic and Send cargo. Tablet depots form a grid beneath the map; phones stack.

One next-milestone prompt guides progression. Completed objectives, architecture
explanations and saved-network management use secondary disclosures. Your saves
opens save, backup, import and recovery controls. A save failure also exposes
Retry save and Export unsaved progress directly in the error message. Primary
stock, production and traffic information does not require opening a tab.
Mirror production, launch controls and deployed totals sit in the same workspace.
Model 0.3.0, schema 3, numerical rules, service schedules, migration and saved-world
values are unchanged. Live operations preserve Play as described below.

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
again. Dispatching cargo, building, editing services, launching mirrors and Save
now keep Play active. Their saves use the same lock as automatic ticks; the next
tick waits for persistence to finish. Explicit +1/+30/next-event steps pause Play
before advancing. Pause remains available during a pending save. Hidden tabs,
reload, world changes, errors and the 100,000-day horizon also stop play.
No offline or wall-clock catch-up. Marker movement is schematic elapsed
fraction; tracked flight and arrival panels explain status. Reduced motion
disables marker transitions.

A sustainable scenario tested for 1,000 days sends 5 t Earth–Moon equipment every
90 days, 3 t Earth–Phobos equipment every 100 days, and 10 t Moon–Phobos material
every 20 days. The player first commissions both tethers and supplies the
20 t/5 t installation requirements plus working equipment.

## Saves and compatibility

IndexedDB skyhook-campaigns stays at database version 1, with the same worlds
store. Current state schema 3 / network-0.3.0 exports in a skyhook-campaign
version-3 envelope. The validator explicitly accepts and migrates schemas 1 and 2
(network-0.1.0 and network-0.2.0), including their original backup envelopes.

Version-one migration preserves ID, name, simulation day, revision, all old depot fields,
fuel, objectives, logs, flight IDs and arrival dates. Flights become construction
cargo with no recurring-service ID. Earth gains manufacturing and 20 t equipment,
the remote industries start unbuilt, and schedules/progress start empty. No
retroactive production. Reading does not rewrite IndexedDB. The first save
atomically retains the old head in its checkpoint history. A schema-only Save now
also increments revision so an old cached app cannot overwrite the migrated head
with its previously valid revision. Normal gameplay increments it as before.

Version-two migration retains every old port field, fuel, time, revision, logs,
objectives, industry, schedules and flights exactly. Mercury starts empty and
unbuilt, the expedition locked, with no extra Earth allocation or past production.
Schema-three validation checks solar clocks and deployment durations, unique
IDs, facility dependencies, stock bounds and the mirror mass identity:
manufactured = ready + in transit + deployed. Cargo and solar flights share
the 32-flight bound. Old-schema files cannot contain Mercury routes.

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

tests/campaign.browser.py plays all three chapters, including producing material,
delivering equipment, installing both industries, scheduling three complementary
routes, flight tracking and arrivals, pause/resume, accelerated play and reload.
It also covers portable backup/import, checkpoint branches, competing tabs,
automatic-clock stop on an injected write failure and successful retry, and
migration of native version-one and version-two IndexedDB records with checkpoint
preservation. A delayed manual-dispatch save verifies that Play waits, resumes,
and retains exactly one shipment. Service edits and Save now preserve Play;
explicit time steps, world changes and failed manual dispatch saves stop it.
A real completed v2 network is supplied and built out through
Mercury, automatic deployment, all new milestones and a solar backup round-trip.
Responsive captures cover 1440, 1000, 768, 390 and 320 px; the method guide works
without JavaScript. CI also runs existing Flight Studio/electrodynamic/navigation
regressions and verifies reference outputs.

## Mercury and solar deployment

Unlock at 100 Mars operations points by spending 60 t construction and 20 t
Earth equipment on survey/ground support; this does not deliver Mercury cargo.
All three previous destinations have bidirectional Mercury corridors. Mercury's
frozen radius is 0.38709927 AU (JPL approximate elements, table one). Earth/Moon
use 1 AU and Phobos uses the existing 1.523679 AU approximation. Add four, five
and six handling days respectively; tug fuel allocations are 1.8, 1.8 and
2.2 t per cargo tonne, reduced to 40% for tether service. Earlier routes stay
unchanged. These are ideal coast times, not launch windows or solved encounters.

Mercury needs the usual 30 t tether plus 20 t construction/5 t equipment refinery.
The 100,000 t local deposit is a finite game allocation, not a planetary reserve
estimate. Each daily cycle refines up to 2 t deposit into construction, using
0.05 t equipment per tonne. Mirror works cost 40 t construction/10 t equipment;
a cycle then turns up to 1 t construction plus 0.05 t equipment into 1 t mirrors.
Coupled Mercury production uses discrete daily cycles beginning installation +1
so large and small time steps cannot change which inputs the works can consume.
Inputs and reserved storage constrain output; no production catch-up is queued.

The launch array costs another 40 t construction/10 t equipment and requires
mirror works. A 10 t mirror batch uses 1 t pooled fuel and reserves Mercury
recovery for 2/tier days. Launch support is a scenario budget. Ideal transfer to
0.5 AU plus two handling days takes about 56 days. Stock is spent at departure;
deployed mass increases once on arrival. The scenario's assumed 10 g/m² gives
0.1 km²/tonne; this is not demonstrated hardware performance. No energy or power
is calculated. Drawn symbols denote batches rather than individual mirrors.

Automatic launch first attempts tomorrow; successful 10 t attempts repeat every
10 days, blocked attempts retry daily without backlog. Pause preserves transit.
At a shared instant: cargo/solar arrivals, Mercury refinery then works, cargo
services by ID, automatic solar launch. Earlier industry remains continuous
between events. Next-event time includes production and solar events.

After initial cargo, an Earth–Mercury 10 t equipment service every 60 days can
support the 0.15 t/day maximum maintenance demand. Extra stock is needed for
construction and to cover transfer lead time. Four milestones: refinery,
works+array, first 10 t deployed, then 100 t deployed (10 km² scenario area).

tests/lab-campaign-solar.test.mjs verifies exact real-v2 migration, gates and
costs, route estimates, complete gameplay, single deployment credit, reload
in transit, 600-day vs half-day-step equivalence, finite-deposit and equipment
starvation, incoming storage reservation, auto pause/resume, recovery/traffic
contention, horizon limits and malformed solar save rejection.

Mirror composition, including hematite, remains provisional. Mercury's bulk
iron-rich core does not establish an accessible surface hematite supply;
MESSENGER-derived surface composition is iron-poor and strongly reduced.
The recipes do not claim validated extraction, coating, optics or thermal
survival. See Nittler et al. below and the public Mercury guide.

## Further work and sources

More destinations and swarm energy systems remain future work.
Detailed lunavator geometry, Phobos loads, targeting/launch windows and integration
with tested Flight Studio designs require separate numerical work.

- Hoyt, Cislunar Tether Transport System, NIAC 1999, summary, III.A.3 and Appendix B:
  https://www.niac.usra.edu/files/studies/final_report/7Hoyt.pdf
- Weinstein, Space Colonization Using Space-Elevators from Phobos, 2003:
  https://ntrs.nasa.gov/citations/20030065879
- Nittler et al., The Chemical Composition of Mercury (2017):
  https://arxiv.org/abs/1712.02187
- https://ssd.jpl.nasa.gov/astro_par.html
- https://ssd.jpl.nasa.gov/planets/approx_pos.html
- https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
