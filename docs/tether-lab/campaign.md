# Expeditions: from first corridors to the asteroid belt

Routes: /lab/campaign/ and the public guide /lab/campaign/method/.

The campaign has five linked chapters and twenty milestones: establish Earth–Moon–Phobos tethers,
sustain industry and scheduled deliveries, develop Mercury and a solar swarm, connect its power back to Mercury, then supply Ceres through Phobos and return water for propellant. The Moon's lunavator remains a
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
Construction, equipment, water and mirrors have distinct map glyphs and matching queue
colors. Track any cargo flight or mirror launch to highlight its corridor and
inspect its payload, destination and arrival in the fixed map footer. Tracking,
clearing and completion never expand this footer or move the traffic controls.
Cargo and mirror identities remain separate even when their numeric IDs match.
On phones, tracking brings the map into view and focuses the inspector. Returned
power and Mercury's production multiplier appear in the map header, linked to
the full power controls; an unconnected swarm reports zero returned power.
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
Model 0.5.0 / schema 5 adds the Phobos–Ceres water loop. Ceres and its operations
panel appear once the power link is online; opening its expedition is a separate
funded action. Its only corridor runs through Phobos. Contextual supply actions
prepare that route, and water is selectable only from Ceres to Phobos. Earlier
outposts retain their fixed arrival slots. The opt-in power loop was added in
model 0.4.0 / schema 4. Earlier recipes and pending
events remain unchanged until the player connects swarm power. Live operations
preserve Play as described below. Arrival telemetry has a permanent, bounded
slot in every open outpost; changing inbound cargo does not move depot controls.

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
The detailed Earth and lunar Flight Studio experiments are separate from the campaign. The Moon outpost's “Explore this tether” link opens `/lab/lunar/` in a new tab without changing campaign resources or saved progress. That experiment models orbital transfers; it does not validate the campaign's Earth–Moon routes or simulate surface pickup.

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
fraction; tracked flight and arrival panels explain status. Orbital animations are illustrative: free rotors travel around Earth, the Moon
Mercury and Ceres; Phobos and its attached inward/outward arms orbit Mars together.
Swarm rings circulate around the Sun. Visual periods are fixed for readability,
not physical orbital periods or positions. Corridor endpoints denote schematic
outposts, not intercepts. Play runs motion, Pause holds its pose, and changing
worlds resets the pose. Reduced motion disables orbital animations, power-link
flow and cargo transitions without changing simulation time or outcomes.

A sustainable scenario tested for 1,000 days sends 5 t Earth–Moon equipment every
90 days, 3 t Earth–Phobos equipment every 100 days, and 10 t Moon–Phobos material
every 20 days. The player first commissions both tethers and supplies the
20 t/5 t installation requirements plus working equipment.

## Saves and compatibility

IndexedDB skyhook-campaigns stays at database version 1, with the same worlds
store. Current state schema 5 / network-0.5.0 exports in a skyhook-campaign
version-5 envelope. The validator accepts schemas 1, 2, 3 and 4 with their matching
models and original backup envelopes.

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
Version-three migration preserves every existing field, including solar stocks,
deposit, facilities, launch schedules and in-flight deployments. Its powerLink
starts false. It grants no resources, output or past power; existing
players can continue completed worlds. The same schema-only revision/checkpoint
protection applies. Current validation checks solar clocks and deployment durations, unique
IDs, facility dependencies, stock bounds and the mirror mass identity:
manufactured = ready + in transit + deployed. Cargo and solar flights share
the 32-flight bound. Schema-one/two files cannot contain Mercury routes. A power link requires an
installed launch array and at least 100 t deployed. Schemas one through three cannot activate it.

Version-four migration preserves every old field, including the connected power
loop, deposit, output, launch attempt dates and in-flight batches. All four older
schemas gain an empty Ceres port, zero water stock at every port, and a locked
fresh belt state. No free supplies, extraction, refining or elapsed-time output
are added. Schemas one through four cannot contain Ceres traffic or water cargo.
The same read-only load, first-write checkpoint and revision protection apply.
Water validation checks the finite-deposit and depot/transit/consumption identities
documented below. The genuine completed v4 export is tracked in
`tests/fixtures/campaign-v4.json`, alongside real v1, v2 and v3 fixtures.

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

tests/campaign.browser.py plays the first four chapters, including producing material,
delivering equipment, installing both industries, scheduling three complementary
routes, flight tracking and arrivals, pause/resume, accelerated play and reload.
It also covers portable backup/import, checkpoint branches, competing tabs,
automatic-clock stop on an injected write failure and successful retry, and
migration of native version-one, version-two and version-three IndexedDB records with checkpoint
preservation. It also checks arrival row geometry, animated Play/Pause poses,
independent cargo/mirror tracking with colliding IDs, fixed tracking geometry,
phone focus and keyboard clearing, mirror completion and map power readings,
reduced-motion behavior, increasing power after deployment, and the power-link
upgrade and backup round-trip. A delayed manual-dispatch save verifies that Play waits, resumes,
and retains exactly one shipment. Service edits and Save now preserve Play;
explicit time steps, world changes and failed manual dispatch saves stop it.
A real completed v2 network is supplied and built out through
Mercury, automatic deployment, all new milestones and a solar backup round-trip.
Responsive captures cover 1440, 1000, 768, 390 and 320 px; the method guide works
without JavaScript. CI also runs existing Flight Studio/electrodynamic/navigation
regressions and verifies reference outputs.

`tests/campaign-belt.browser.py` continues a native v4 save through Chapter 05
using ordinary controls: stage the Phobos stock, open Ceres, ship its construction
and equipment, build both works, return water and sustain scheduled deliveries.
It verifies migration and stale-writer protection, local costs, no fuel before
delivery, backup/reload, map tracking, route preparation, reduced motion, fixed
arrival geometry, all four new milestones and responsive layouts. Its optional
`--origin` runs the same checks against the stable preview in an isolated browser.

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
0.1 km²/tonne; this is not demonstrated hardware performance. Intercepted sunlight and power returned by the optional link are calculated as
scenario quantities below. Drawn symbols denote batches rather than individual mirrors.

Before the power link, automatic launch first attempts tomorrow; successful
10 t attempts repeat every 10 days, blocked attempts retry daily without backlog. Pause preserves transit.
At a shared instant: cargo/solar arrivals, Mercury tooling (when connected),
refinery then works, the belt cycle when unlocked, cargo
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

## The power loop (Chapter 04)

Continue a completed First light save. At 100 t deployed, a one-time power-link
upgrade costs 60 t material and 10 t equipment at Mercury. It adds the abstract
receiver/relay and local tooling facilities together. Activation does not advance
time, reschedule existing attempts, alter flights, or produce an immediate batch.
Keep working material or equipment after construction; a completely empty depot
needs a delivery to start the first cycle.

For deployed mirror area A in km², intercepted sunlight is
A × 10⁶ × 1361 / 0.5² / 10⁹ GW. The frozen reference is 1361 W/m² at 1 AU;
flux follows inverse-square distance. The model assumes illuminated projected
area equals the scenario mirror area; it does not solve orientation or shadowing.
Without a link, returned power is zero. With a link, the combined capture,
conversion and return fraction is 20%. Thus 100 t (10 km²) intercepts 54.44 GW
and returns 10.888 GW. These are instantaneous scenario power ratings, not
accumulated energy or a validated mirror/power-beaming design.

All returned power is automatically reinvested in production capacity:
F = 1 + returned GW / 20. Daily refinery capacity becomes 2F t and mirror
capacity F t. The power-to-capacity rule, conversion efficiency and recipes
are explicit gameplay assumptions. More deployed mirrors increase power, which
increases production and subsequent deployment: a compounding feedback loop.
Transfer delay, finite inputs, storage, launch recovery, fuel and traffic prevent
unlimited exponential growth. Capacity and next-cycle actual output are shown
separately, with shortages exposed.

Before the refinery, local tooling can convert 1 t construction into 1 t equipment.
Its daily capacity is 0.15F t, the full refinery-plus-works maintenance demand.
It replenishes at most a two-cycle equipment buffer (0.3F t), subtracting equipment
already in stock and honoring inbound storage reservations. It uses material
available at the start of the cycle; the refinery and works then use the existing
ordered recipes. This sustains maintenance locally without free equipment or
retroactive output. Only completed production consumes inputs. Depleted mines
can still use imported construction in the works. The initial 100,000 t deposit
remains a local mining tract, not a model of disassembling the entire planet.

When connected, automatic batches use Mercury's tier capacity (10/20/30 t).
After a successful launch, the next interval is max(2/tier, batch mass/F) days.
An already scheduled attempt keeps its date; new power changes the interval at
its next success. Blocked attempts still retry tomorrow. Upgrading Mercury's
tether increases batch size and throughput per traffic slot. All fuel, recovery,
32-flight and horizon checks remain active; existing batches retain their mass
and original deployment time. Enabling the link does not enable paused launches.

Four additional milestones: connect power, double Mercury capacity (20 GW),
return 100 GW, and deploy 2,000 t with the link online. No reset is needed.

Tests in lab-campaign-power.test.mjs cover real-v3 migration, units, opt-in cost,
unchanged event clocks, one-time deployment credit, self-sustaining maintenance,
increasing output, all four goals, scarce inputs, finite deposit and storage,
launch constraints, large/small/reloaded time steps, and corrupt power saves.

## Into the Belt (Chapter 05)

Continue the existing network. Opening Ceres requires a connected power link,
2,000 t of deployed mirrors, and a tier-2-or-better Phobos tether with its staging
industry installed. Funding consumes 60 t material and 20 t equipment **at Phobos**.
It advances no time and delivers nothing to Ceres. Reserve separate construction
and working supplies for the outpost and the Phobos propellant plant.

The new corridor is Phobos–Ceres, bidirectional for material and equipment.
Ceres uses a frozen 2.8 AU circular radius from NASA's rounded mean-distance
reference, and Phobos uses the existing 1.523679 AU Mars approximation. The ideal
half-period coast plus six handling days is about 586 days in each direction.
Tugs allocate 0.5 t support propellant per cargo tonne; tether service allocates
0.2 t/t. These costs are balancing assumptions, not delta-v or an engine model.
All existing corridor constants, capacities and pending arrival dates are unchanged.

Deliver 50 t material to Ceres: 30 t commissions its free-orbit rotovator and
20 t builds water works, together with 5 t equipment. Sending 20 t equipment
initially also provides 15 t working stock, enough to cover the first recurring
supply's long lead time. The water works extracts up to 2 t water each belt cycle,
consuming 0.01 t equipment per tonne from a finite 100,000 t local water deposit.
A 5 t Phobos–Ceres equipment service every 200 days exceeds the 0.02 t/day maximum
maintenance demand once its pipeline is filled; Phobos still needs inbound
equipment for staging, extraction supplies and its propellant plant.

Install the separate Phobos propellant works for 40 t local material and 10 t
equipment. Water cargo is allowed only Ceres→Phobos. It leaves Ceres on departure,
uses ordinary capacity/fuel/recovery/traffic rules, and credits Phobos once on
arrival. The plant processes up to 2 t water per cycle into an equal mass of
pooled support fuel, consuming 0.005 t equipment per tonne. Fuel becomes available
network-wide under the existing abstract pooling rule; Ceres stock and water in
transit provide no fuel. A 10 t tether return costs 2 t fuel and can yield 10 t,
before counting equipment transport and setup costs. Fuel can support other
corridors and Mercury mirror launches through the same existing pool.

Belt cycles begin one day after expedition funding, then daily. Newly installed
works start on the next scheduled cycle. At shared event times: continuous older
industry integrates to the event; cargo and mirror arrivals credit first; Mercury
tooling/refinery/mirrors run; Ceres extraction and Phobos refining run; cargo services
attempt by ascending ID; automatic mirror launches attempt last. Only completed
output consumes inputs. A full fuel pool preserves stored water and equipment;
partial output is allowed, and missed output never accumulates. Small steps,
large jumps and export/import during transit preserve equivalent results.

Saved `belt` fields are `unlocked`, `depositT`, `extractedT`, `returnedWaterT`,
`refinedT`, `propellantWorks` and `nextCycleDay`. Ports gain `waterT`; only Ceres
and Phobos can hold water. The validator checks, within 1e-5 t:

```text
100000 − deposit = extracted
extracted = Ceres water + Phobos water + water in transit + refined
returnedWater = Phobos water + refined
```

The four milestones are funding the expedition, installing Ceres water works,
processing 10 t at Phobos, and processing 100 t with a return service that has
at least three departures and one delivery. A 10 t water return every 90 days
is a conservative starting service, not the mine's maximum throughput. Long
transfer times and shared traffic slots make larger tether tiers useful.

`tests/lab-campaign-belt.test.mjs` covers real-v4 migration, gates and local
costs, route restrictions, full construction/delivery/refining, one-time credit,
net fuel accounting, finite deposits, partial input/storage limits, same-instant
arrival→refining→dispatch, retries, pause/remove, time-step equivalence, milestones,
traffic/horizon limits and invalid water saves.

Dawn findings support near-surface water ice on Ceres; the local deposit size,
yield, maintenance and conversion recipes are game assumptions. They do not
establish an accessible reserve, working mine, electrolysis plant or cryogenic
propellant system. Power, thermal control, surface access, losses and storage
engineering are not solved. Neither this rotovator nor its routes are validated
by a Flight Studio experiment.

## Further work and sources

More destinations, larger extraction tracts and detailed swarm engineering remain future work.
The separate lunar and Phobos Flight Studio experiments now expose orbital
rotovator dynamics and static anchored-cable loads/local releases respectively.
Lunar surface pickup, Phobos capture/recovery, real targeting/launch windows and
integration of tested Studio designs into campaign ratings remain future work.
Moon and Phobos outpost links open those experiments without mutating the world.

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

- NASA solar irradiance reference: https://earth.gsfc.nasa.gov/climate/projects/solar-irradiance/science
- NASA/JPL inverse-square solar power context: https://www.jpl.nasa.gov/edu/resources/lesson-plan/calculating-solar-power-in-space/
- NASA Ceres facts (rounded 2.8 AU mean distance): https://science.nasa.gov/dwarf-planets/ceres/facts/
- JPL, Where Is the Ice on Ceres? New NASA Dawn Findings (2016): https://www.jpl.nasa.gov/news/where-is-the-ice-on-ceres-new-nasa-dawn-findings/
