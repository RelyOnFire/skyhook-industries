# Expeditions: from first corridors to the asteroid belt

Routes: /lab/campaign/ and the public guide /lab/campaign/method/.

The campaign has six linked chapters and twenty-four milestones: establish Earth–Moon–Phobos tethers,
sustain industry and scheduled deliveries, develop Mercury and a solar swarm, connect its power back to Mercury, then supply Ceres through Phobos and return water for propellant. Industrial scale adds paid capacity upgrades, finite mining tracts and a protected fuel reserve to grow beyond the first belt loop. The Moon's lunavator remains a
free lunar rotor. Phobos itself anchors the inward and outward tethers.

## Operations interface

The welcome screen is included in the initial HTML. Save discovery runs in the
browser after hydration; Start, Import and the network-name input stay disabled
until it completes. A fixed space holds the save status or Continue action, so
finding a saved network does not move the other controls. No player data is
embedded in the generated page. The welcome map fetches its detailed planet
surfaces when it becomes visible; an open network loads them immediately. The
map keeps the same geometry throughout. Without JavaScript, visitors can still
read the introduction and follow links to the campaign guide and save help.

The campaign is one operations workspace: all outposts and their local stocks,
inbound cargo, industry rates and tether availability stay exposed. Choosing a
destination highlights it without hiding other depots. Outpost supply shortcuts
consider unlocked, directly connected depots with the selected resource. They
prefer a ready departure, then the largest available whole-tonne shipment up to
10 t and the actual corridor capacity, then lower fuel per tonne and shorter
transit. Both commissioned endpoints use a tether; otherwise the form uses a
tug. Recovering tethers remain tether suggestions if no ready supplier exists;
this does not silently switch transport mode or spend extra fuel. If no depot
has a whole tonne, the ordinary Earth/Phobos replenishment source remains with
its visible dispatch blocker. Locked routes and reverse water routes are never
suggested. Earth's explicit Ship buttons retain their Earth→Moon route.
Shortcuts only prepare the cargo form and maintenance interval: no dispatch,
resource change or save occurs until the player takes an action. The chosen
origin, payload and any blocker are visible in the cargo form.

The map is the largest desktop panel, highlights the planned corridor, supports
keyboard destination selection, and shows the swarm around the same Sun. Cargo
and mirror deployments share an arrival-ordered traffic queue above scheduled
services, so arrivals take precedence and recurring supply follows immediately.
Both lists have bounded keyboard scrolling that tightens on shorter desktops.
The arrival list can be filtered by cargo kind (including cargo-only and mirrors)
and destination. Its mass and matching-flight count describe the visible subset;
header and capacity counts still describe the whole network. Filters preserve
arrival order and map tracking. If a filter hides the tracked flight, Show tracked
clears the filters and focuses its row. Empty matches offer Show all traffic.
Filters remain usable during Play and update with arrivals and departures; they
are temporary view settings, reset on reload or world change, and never write a
save or change a service.
Construction, equipment, water and mirrors have distinct map glyphs and matching queue
colors. Track any cargo flight or mirror launch to highlight its corridor and
inspect its payload, destination and arrival in the fixed map footer. Tracking,
clearing and completion never expand this footer or move the traffic controls.
Cargo and mirror identities remain separate even when their numeric IDs match.
**Explore Earth launch** above the map opens a dedicated HASTOL-inspired Earth
access sequence, even without active tether flights. A hypersonic carrier climbs,
shuts off its engines for a ballistic pop-up, meets the lower grapple at matched
position and velocity, then returns while the tether lifts and releases the cargo.
Climb, Rendezvous, Lift and Release have their own camera, pause and scrub controls.
This is separate from the introduction film's motion. Hardware is enlarged and
physical time compressed for legibility; the readouts are explicitly illustrative.
The original carrier has a slender chined body, swept horizontal wings, paired
nacelles, canted fins and centered glazing. One coherent camera view exposes
the complete airframe; its canopy and wings are not independently rotated. The
capture view eases higher after fading the distant planet, then restores the
wide framing for lift and release.
Both stabilizer roots are embedded in their engine nacelles, with solid canted
fins rather than floating single-sided triangles.
Darkstar/Blackbird-style planforms and the slender Skylon concept inform its
appearance, rather than specifying a flight-capable vehicle. The authored geometry
uses no external aircraft mesh or branded markings. References include
[Lockheed Martin's Darkstar design account](https://www.lockheedmartin.com/en-us/careers/life-at-lm/2023/top-gun-movie.html)
and [ESA's Skylon concept](https://www.esa.int/ESA_Multimedia/Images/2013/07/SABRE_engine_in_place_on_Skylon_spaceplane).

The geographic illustration places the eastbound pickup above the Atlantic at
28.5° N, 72° W; the existing planar motion is oriented against that reference
rather than across a stretched polar texture. Its oblate surface uses geodetic
latitude, longitude and the [NASA Earth Fact Sheet's WGS84 axes](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html).
A native-resolution regional crop of NASA's January Blue Marble map sharpens
the corridor, alongside the existing global texture. Clouds use their actual
transparency mask and all maps use anisotropic filtering. The regional surface
conforms to the same geographic mesh, with a 20 m display offset to avoid depth
fighting. Sources and reproducible extraction are in `public/textures/README.md`.
This is a fixed visual corridor, not a selected runway or solved geographic
launch. The motion/readouts retain their original 6,371 km mean-radius convention;
the surface shape, imagery and inclination do not change trajectories or saves.

The nominal visual example uses a 150 km handoff at 4.5 km/s, a circular hub at
1,100 km and 950 km arms. These chosen parameters are not a reproduced HASTOL
vehicle or a commissioned design. The prescribed powered climb connects to an
Earth-central-gravity aircraft coast. The rigid tether matches the carrier's
position and velocity at pickup; release inherits the tip velocity and subsequently
coasts under the same gravity. Aircraft performance, atmospheric loads, capture
hardware, finite-mass tether recoil and destination targeting are not solved.
[The NIAC HASTOL Phase II report](https://www.niac.usra.edu/files/studies/final_report/391Grant.pdf),
chapter 1, provides the aircraft/pop-up/grapple sequence and discusses higher
rendezvous altitudes and the capture window. Its differing study cases must not
be conflated with these nominal display parameters.

Earth-origin tether cargo offers **Earth launch** in its traffic row, retaining
its actual manifest and live delivery status alongside the concept. A standalone
concept has no shipment identity, cargo mass or arrival claim. The Earth sequence
is explicitly local access, rather than a replay of an interplanetary flight.
Game time continues if
Play was already running, and arrivals still credit exactly once. Opening,
scrubbing and closing the replay never write a save. The Three.js scene loads
only on request, with a diagram fallback if WebGL fails. Reduced motion starts
paused; Escape closes the dialog and Space inside it controls only the replay.
**Explore Moon launch** beside the Earth entry opens a separate lunar mass-driver
concept without requiring a shipment. Moon-origin tether cargo offers **Moon
launch** in its traffic row, with its real manifest, arrival day and live status.
Tugs, other origins and mirror deployments retain map tracking.

Load, Accelerate, Coast, Capture, Swing and Release have separate camera moments.
An original coil launcher, loading bay, capacitor banks and solar apron feed a
raised straight ramp. Illuminated coils follow the sled; after separation the
sled stays on the track while cargo coasts without rocket exhaust. The view
zooms into the fitting and closing grapple, then widens to show both tether ends
and the departing cargo. NASA's existing LROC texture covers the mean sphere;
local hardware is enlarged. The ground close-up uses a native 4096 px crop from
NASA/GSFC/ASU's Apollo 15 low-Sun LROC mosaic at nominal 10 m/pixel, mapped once
onto the curved mean sphere. No artificial crater blobs or brightness-derived
terrain heights are used. The globe places the corridor against the Hadley
mid-latitude reference instead of compressing a polar cap into horizontal streaks.
The image's recorded lighting is retained, and the global surface remains a
fallback. Source, exact extraction and reproduction are in `public/textures/README.md`. The visual composition takes inspiration from the
[shared lunar mass-driver concept video](https://www.youtube.com/watch?v=-0tUa1a0HjQ),
without embedding its footage or reproducing its satellites.

The display model uses the lunar Flight Studio's frozen mean radius (1,737.4 km)
and GM (4,902.800118 km³/s²). A prescribed circular hub at 200 km with 150 km arms
matches cargo at a 50 km apogee and 0.9 km/s. Backward central-gravity integration
finds the exit state and a straight rail foot above the sphere. Net prescribed
launcher acceleration is 60 m/s²: approximately 8 km of accelerating track and
16.3 physical seconds give about 0.98 km/s at exit, followed by about 293 seconds
of unpowered coast. The 39-second replay compresses those intervals and the swing;
it does not represent one uniform physical playback rate. The rail uses a linear
physical clock, and the coast begins at that same playback rate. Only after the
camera widens does the long coast compress; its clock eases back to the capture
rate before rendezvous. The overlay shows the current time factor and the speed
readout retains two decimals. Free-coast speed decreases under gravity, with no
post-exit boost or jump in projected pace. Coils, the rail, sled and actual cargo
meshes share a single centreline, with a tested clear bore. The loading bay and
exit are outside the coil train. Cargo attitude is
prescribed for a visible grapple fitting. Release inherits the tip's inertial
velocity, then coasts under lunar gravity. Conservation, matched pickup, surface
clearance, phase continuity and wide framing are checked numerically.

This is an access illustration, separate from campaign transfer durations and
the orbital-transfer Lunar Flight Studio. The equal-arm rotor, prescribed motion
and launcher acceleration do not solve finite-mass capture recoil, structural
loads, coil power/storage, sled braking, terrain, lunar rotation or destination
targeting. A mass driver supplies departure speed; a tether catcher supplies
additional speed and release, rather than treating a surface shot as an already
circularized orbit. The
[lunar electromagnetic launcher study](https://ntrs.nasa.gov/api/citations/19890006394/downloads/19890006394.pdf),
section 4, describes coil launchers and the need for capture or circularization.
Mercury surface access remains a future environment-specific design. For Mars access, a Phobos
inward tip is not stationary relative to the ground. Weinstein's
[2003 proposal](https://ntrs.nasa.gov/citations/20030065879) terminates above the
atmosphere and describes about 0.52 km/s relative surface motion, with short boosted
craft reaching the moving terminal. A direct grab of stationary surface cargo
would require additional tip control and an atmosphere/terrain/load analysis.
These future access mechanisms are not yet campaign facilities or departure scenes.
On phones, tracking brings the map into view and focuses the inspector. Returned
power and Mercury's production multiplier appear in the map header, linked to
the full power controls; an unconnected swarm reports zero returned power.
The delivery composer sits directly under
the map; mirror operations follow it. The clock and pooled totals share a sticky
bar. At smaller widths the workspace reflows, with anchor links to Outposts, Map,
Traffic and Send cargo. Tablet depots form a grid beneath the map; phones stack.

An optional Network outlook below the live traffic projects 30, 90 or 365 days
using the same chronological simulation engine on copies of the current world.
It reports service departures, the exact reason for each blocked cargo or automatic
mirror attempt, received cargo, support fuel, deployed mirrors and depot stocks,
including end-of-window industry shortages. Repeated holds are grouped by reason;
their links lead to the affected service or mirror controls. The hold list has a
bounded keyboard-scrollable region. One chronological projection avoids cloning
the world separately for every forecast day.

The cargo composer also offers **Preview service** before creating a new recurring
line. It runs the current network and a copy with the proposed service over the
same 30/90/365-day window, including its actual tomorrow-first attempt and queue
priority. The report shows new departures, that service's received cargo and
hold reasons, plus network receipts, remaining fuel, existing-service holds and
mirror launches with/without the proposal. Flights still in transit are excluded
from receipts. A valid schedule that currently lacks stocks, recovery or endpoint
capacity can still be previewed, so its future blockers are visible.
Previewing never dispatches, schedules or saves. It computes only when requested;
changing inputs hides the report, while advancing the network marks the retained
snapshot out of date until Preview service is clicked again. Play continues.
The report resets on world changes and reload. The existing Schedule service
button remains the explicit commit action, using the normal scheduling checks.

The same outlook can compare a draft payload and interval for one existing
service against the current plan at the selected horizon. Both sides use the
same event engine; it shows that service's departures and blocked attempts,
network cargo received, ending support fuel, and mirror launches. Editing the
draft or comparing it never saves or changes in-flight cargo. Applying the
schedule uses the ordinary service-edit action and preserves the next attempt,
history and existing flights. If the next attempt is beyond the horizon, the
comparison says so; cargo still travelling at the end is not counted as received.
The projection assumes existing schedules and automatic launches continue, while
no manual shipments, construction or Earth allocations occur. It updates when
the world changes while open and never advances simulation time or writes a save.

One next-milestone prompt guides progression. Completed objectives, architecture
explanations and saved-network management use secondary disclosures. Your saves
opens save, backup, import and recovery controls. A save failure also exposes
Retry save and Export unsaved progress directly in the error message. Primary
stock, production and traffic information does not require opening a tab.
Mirror production, launch controls and deployed totals sit in the same workspace.
After all twenty-four milestones, that prompt becomes an ongoing operations goal:
100,000, 200,000, 400,000 and 800,000 t deployed. It shows progress and a
read-only 90-day projection of added mirrors and returned power, with a direct
route to Network outlook and a short cue for paused launches, an exhausted
Mercury tract or projected departure holds. These are optional scale targets,
not new saved objectives; they do not alter the economy or save schema.
An exhausted Mercury tract links straight to its project card. Industrial
projects now show the remaining material and equipment after counting stock and
cargo already in flight. Supply shortcuts choose a stocked connected origin,
prepare a payload within the current corridor rating, and take the player to the
cargo form. Preparing a shipment never dispatches it or changes the save.
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
shared endpoint priority. Edit changes a service payload and interval in place, preserving its ID, history, enabled state, pending attempt and active flights. The new interval starts after the next successful departure. Unchanged edits are no-ops. Pause/remove leaves active flights intact. Resume
cannot create overdue attempts. Cargo has 256 active-flight slots; mirror deployments
have an independent 128-batch allowance. Mirrors cannot consume cargo capacity.
Both counts appear in the traffic panel. Fuel, local stock, endpoint recovery,
storage reservations and the simulation horizon still constrain departures.

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
Space toggles Play/Pause while operating the map or reading panels. A key hint
appears on the clock button. Holding the key toggles once and does not scroll;
modifier shortcuts and IME composition are ignored. Text fields, selects,
buttons, links, disclosures and map destination buttons retain their normal
keyboard behavior. The shortcut uses the clock button's existing save and horizon
guards, including allowing Pause while a save is pending.
No offline or wall-clock catch-up. Marker movement is schematic elapsed
fraction; tracked flight and arrival panels explain status. Orbital animations are illustrative: free rotors travel around Earth, the Moon
Mercury and Ceres; Phobos and its attached inward/outward arms orbit Mars together.
Swarm rings circulate around the Sun. Visual periods are fixed for readability,
not physical orbital periods or positions. Corridor endpoints denote schematic
outposts, not intercepts. Play runs motion, Pause holds its pose, and changing
worlds resets the pose. Flight glyphs use a separate, aligned SVG overlay so
daily traffic updates do not repaint map labels or the Mercury power conduit.
Reduced motion disables orbital animations, power-link
flow and cargo transitions without changing simulation time or outcomes.

A sustainable scenario tested for 1,000 days sends 5 t Earth–Moon equipment every
90 days, 3 t Earth–Phobos equipment every 100 days, and 10 t Moon–Phobos material
every 20 days. The player first commissions both tethers and supplies the
20 t/5 t installation requirements plus working equipment.

## Customer freight and earned supplies

Contracts give an established network optional work alongside its own supply chain.
The Freight contracts panel stays with live logistics. Up to three orders can be
active together, with one per buyer. Each order keeps its own deadline and cargo;
a long Mars delivery can run alongside a shorter lunar job. Three fictional buyers post finite procurement rounds, and two independent
freight operators reserve some of that demand. Prices, demand cycles, fleet limits
and procurement costs are explicit scenario rules, not forecasts of real markets.

| Buyer / order | Cargo route | Low / steady / high rate per on-time tonne |
| --- | --- | --- |
| Terran Orbital Works / lunar construction imports | Moon → Earth material | 2 / 4 / 6 credits |
| Ares Habitat Cooperative / Mars habitat construction | Moon → Phobos material | 4 / 6 / 8 credits |
| Helion Research Industries / Mercury industrial tooling | Earth → Mercury equipment | 12 / 16 / 20 credits |

Both endpoint tethers and the origin industry must be commissioned; accepting an
order does not require ready stock. Standard orders request 30 t with a 30-day
loading window. Industrial orders request 300 t with a 120-day window and require
the same established network as industrial development. The deadline is acceptance
plus the loading window plus that route's frozen coast and handling time. Last
departure and arrival deadline are shown separately. All cargo must arrive on time;
an arrival exactly at the deadline counts before expiry. Completing the order pays
an additional 25% of its base value once. Each buyer waits 90 days after settlement
before accepting another order from the player; rivals have their own booking clock. Acceptance near the 100,000-day horizon is rejected
if the deadline would lie beyond it.

Only explicitly assigned cargo departing after acceptance counts. Preparing an
order chooses its recipient in the existing composer; preparing a regular supply
or changing its route/resource restores the player's depot as recipient. Ordinary
shipments and existing services never silently become customer freight. Delivery
consumes the cargo for the buyer and pays credits; it does not credit the player's
destination stock, received-total milestones or Moon/Phobos progression counters.
Customer cargo remains visible in traffic and tracking but is excluded from usable
inbound supplies and industrial-project shortfalls. It still reserves physical
depot room, so cancellation can safely return cargo to the depot on arrival.

Contract services share normal inventory, fuel, recovery, arrival, capacity and
queue rules. Their final batch shrinks to the unassigned quantity, and all services
for the order pause when its remaining cargo is in flight or the order settles.
Their history remains available until manually removed. Cancellation and expiry
retain partial earnings, give no completion bonus, and stop further bookings.
Already dispatched cargo for a cancelled order arrives as ordinary depot supplies.
Contract deadlines are events in advance() and Next event. Forecasts use the same
engine, include customer receipts and credit balances, and can run through an
active contract's deadline without changing the world.

Earth procurement spends earned credits explicitly: material costs 12 credits/t,
equipment 30 credits/t and pooled support fuel 2 credits/t. Quantities are whole
tonnes; stock plus reserved inbound storage must fit, and purchases cannot borrow
or happen automatically. Material/equipment prices exceed the highest same-cargo
contract payout including its bonus, preventing a profitable purchase–delivery–
replacement loop. Normal Earth production and allocations retain their existing
rules. Credits have no real-money value and are not leaderboard scores.

Schema 9 adds a commerce ledger, bounded contract receipts (20 recent settlements
plus any referenced by live cargo or retained services), buyer cooldowns and nullable
contractId on shipments/services. All v1–8 migrations start with zero earned/spent
credits, no orders or cooldowns, and null assignments on existing traffic. Existing
resources, progress, clocks, design reports and arrival dates stay intact. There
are no retroactive deliveries, payments or purchases. Validation checks identities,
terms, chronology, payment and balance conservation, references and assignment caps.

## Buyer demand and competing carriers

Schema 10 / network-0.10.0 introduces 90-day procurement rounds. Each round replaces
only the unclaimed request volume; accepted player orders and rival cargo from older
rounds keep their terms and arrivals. The market starts at a new world's day zero or
an older world's saved day. Nothing runs retroactively during migration. All market
activity uses simulation time and the ordinary advance() engine, including forecasts.

| Buyer | Requested tonnes in the repeating four-round cycle |
| --- | --- |
| Terran Orbital Works | 300, 600, 450, 300 |
| Ares Habitat Cooperative | 600, 300, 450, 750 |
| Helion Research Industries | 600, 450, 300, 750 |

New-order rates follow the remaining open demand: below 300 t is low, 300–599 t is
steady, and at least 600 t is high. Accepting a 30/300 t order reserves that quantity
immediately and saves its rate, 25% completion bonus and market round. Acceptance
checks the displayed round/rate against the current quote. Delivery and receipts
use those saved terms even if the live rate changes. Previously accepted v9 orders
retain their original 4/8/20 credit rates and exact bonuses, and are outside the new
round's reservation ledger.

Cancellation or expiry returns the undelivered quantity to open demand only while
its original procurement round is still open. Requests from an older round have
closed and do not reappear. Partial payments and in-flight depot fallback keep their
existing rules. A round's exact accounting is:

`requested = open + player committed + rival committed`

Committed volumes include cargo already delivered for that round; same-round
cancellation releases only undelivered tonnes. Earlier round commitments remain in
saved contracts and rival flights. This finite-round design avoids a market that
accumulates unmet demand forever, or one whose old requests can be resurrected.

Two fictional competitors use independent transport and supply allocations:

- Selene Logistics serves Moon → Earth with a 90 t convoy (three 30 t loads), with
  at most one convoy travelling at once.
- Vector Freight serves Moon → Phobos and Earth → Mercury with a 120 t convoy
  (four 30 t loads), with at most three convoys travelling at once. It chooses the
  route with the larger open request, using a fixed tie order.

Their first booking decision is 15 days after the market starts, then every 30 days.
Each operator can reserve at most one convoy per decision, using whole 30 t loads
up to its rating and the available demand. Bookings reserve requests immediately;
arrival uses that corridor's unchanged coast plus handling time. A busy fleet waits
for a later decision. No convoy can arrive beyond the campaign horizon. Rival ships
use separate allocations: they never debit player depots, fuel, tether recovery or
flight slots. Their supply inputs and return logistics are abstracted, as distinct
from a full competing industrial economy. Their delivered cargo goes to customers,
not the player's depots, and earns no player credits or milestones.

Shared events process player/rival arrivals and contract expiry before renewing a
procurement round and making rival bookings; industry and player services retain
their existing order. Market clocks and rival arrivals participate in Next event.
The offer catalogue keeps buyers in a fixed order and shows open demand, price band,
next round, and rival traffic. Bounded Buyer activity records explain reservations
and deliveries. Network outlook projects open demand, new-order rates and rival
cargo using the same event engine, assuming no new player acceptance.

The saved market carries its origin day, round and clocks, current buyer ledgers,
bounded rival convoys and delivery totals, and the 24 most recent activity entries.
Validation checks round timing, reservations, allowed operators/routes, convoy
ratings and counts, transit durations, identities and saved payout terms. The v9
fixture was generated by network-0.9.0 from the prior browser-suite export using
ordinary acceptance, dispatch, time and service actions; it is a QA world, not a
newly collected player save. It retains earned/spent credits, a completed receipt,
a partially paid active order, cargo in flight and a scheduled contract service.

## Saves and compatibility

IndexedDB skyhook-campaigns stays at database version 1, with the same worlds
store. Current state schema 10 / network-0.10.0 exports in a skyhook-campaign
version-10 envelope. The validator accepts schemas 1, 2, 3, 4, 5, 6, 7, 8 and 9 with their matching
models and original backup envelopes.

Version-one migration preserves ID, name, simulation day, revision, all old depot fields,
fuel, objectives, logs, flight IDs and arrival dates. Flights become construction
cargo with no recurring-service ID. Earth gains manufacturing and 20 t equipment,
the remote industries start unbuilt, and schedules/progress start empty. No
retroactive production. Reading does not rewrite IndexedDB. The first save
atomically retains the old head in its checkpoint history. A schema- or model-only Save now
also increments revision so an old cached app cannot overwrite the migrated head
with its previously valid revision. Normal gameplay increments it as before.

Version-two migration retains every old port field, fuel, time, revision, logs,
objectives, industry, schedules and flights exactly. Mercury starts empty and
unbuilt, the expedition locked, with no extra Earth allocation or past production.
Version-three migration preserves every existing field, including solar stocks,
deposit, facilities, launch schedules and in-flight deployments. Its powerLink
starts false. It grants no resources, output or past power; existing
players can continue completed worlds. The same migration revision/checkpoint
protection applies. Current validation checks solar clocks and deployment durations, unique
IDs, facility dependencies, stock bounds and the mirror mass identity:
manufactured = ready + in transit + deployed. Cargo flights are bounded at 256
and mirror deployments separately at 128. Schema-one/two files cannot contain Mercury routes. A power link requires an
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

Model 0.5.1 keeps schema 5 and expands transit capacity. Valid network-0.5.0
worlds change only their model tag on load: every stock, Ceres field, flight,
arrival date, service, clock, milestone and log is preserved. There is no reset or
catch-up production. The first write retains the old head and advances revision,
including Save now without a gameplay action. Older models are validated against
their original combined 32-flight bound; current worlds use independent limits.
The genuine congested v5 export is `tests/fixtures/campaign-v5.json`.

Version-five migration accepts both network-0.5.0 and network-0.5.1. It preserves
all earlier stocks, ports, deposits, arrivals, service counters and pending clocks,
adding only an empty `development` record. All capacity levels, purchased tract
counts and the automatic-mirror fuel reserve start at zero. Reading alone does not
rewrite IndexedDB. The first successful write keeps the old head and advances
revision, protecting the new world from an older cached writer. No extra reserve,
production or upgrades are granted. Backups through version five remain portable.

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
Space checks cover saved time advancing and stopping, held keys, no page scroll,
editing and native control activation, modifiers/composition, pending saves,
save failures and the horizon. `--origin` runs this suite against a published
preview in an isolated browser.
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

`tests/lab-campaign-traffic.test.mjs` verifies exact v5 model migration, independent
capacity boundaries, automatic retry, bounded backup size, invalid imports and
large/small/reloaded time-step agreement above the old cap.
`tests/campaign-traffic.browser.py` resumes a real 32-flight v5 world, verifies
model-only revision/checkpoint protection and stale-writer rejection, then dispatches
and schedules beyond the old limit. It exercises more than 100 simultaneous
flights, ordered tracking, backup/reload and five responsive widths. It opens the
90/365-day outlook on that mature network and verifies no save mutation or 320 px
overflow. `tests/lab-campaign-forecast.test.mjs` checks the projection against a
direct engine advance, blocked service attempts and the simulation horizon. The
browser suite also supports `--origin` for isolated preview verification.

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
mirror-capacity and horizon checks remain active; existing batches retain their mass
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

## Industrial scale (Chapter 06)

The next chapter opens for an established power and Ceres network: swarm power
linked, Ceres extraction and Phobos propellant works installed, and at least
100 t of returned water refined. Existing completed saves can continue directly.
The four milestones are a launch-array expansion, expanded Ceres and Phobos
works, another Mercury mining tract, and 50,000 t deployed with all three capacity
expansions installed.

Players pay material and equipment at the project site. Each of three capacity
levels doubles the relevant capacity. No action advances time, rewrites pending
flights or reschedules an already pending service/launch attempt.

| Project | First upgrade | Later cost | Effect at levels 0 / 1 / 2 / 3 |
| --- | --- | --- | --- |
| Mercury mirror array | 300 t material + 20 t equipment | Material ×3 and equipment ×2 per level | Mirror payload factor 1 / 2 / 4 / 8 |
| Ceres water works | 100 t material + 10 t equipment | Both costs ×2 per level | Water capacity 2 / 4 / 8 / 16 t/day |
| Phobos propellant works | 100 t material + 10 t equipment | Both costs ×2 per level | Fuel capacity 2 / 4 / 8 / 16 t/day |

Mirror payload is the existing Mercury tier rating multiplied by the array
factor, up to 240 t at tier 3 and expansion level 3. Cargo flights keep their
10/20/30 t ratings. Mirror fuel remains 0.1 t per tonne, Mercury recovery remains
2/tier days, and cargo competes for that recovery service as before. The automatic
interval is still the greater of batch mass/current mirror production capacity
and recovery. Larger batches improve throughput per transit slot but demand more
fuel per attempt. These industrial ratings are scenario rules, not structural or
launch-engineering calculations.

Water/fuel recipes spend the same equipment per tonne and process only available
inputs with reserved storage respected. Upgrading extraction without sufficient
return transport stockpiles water at Ceres; upgrading Phobos without delivered
water leaves the plant idle. Mercury's local tooling maintains a working buffer,
so importing equipment for construction is often necessary. Service editing and
the outlook help tune the upgraded supply chain.

A player-selected fuel reserve (0 to 1,000,000 whole tonnes) applies only to
automatic mirror attempts, after scheduled cargo has run. An automatic launch
waits if it would leave less than the reserve and retries the following day.
Cargo and explicit manual mirror launches may use this fuel. Changing the reserve
preserves the next attempt date; zero keeps the previous behavior.

Each site offers up to eight additional finite 100,000 t tracts. Mercury tract n
costs 500n material + 20n equipment locally; Ceres tract n costs 150n + 10n.
Purchasing access increases the remaining deposit, not depot stock or production.
The Ceres water ledger now begins with `100000 + 100000 × ceresTracts` instead of
the original fixed allocation; all extracted, stored, in-transit and refined
water still balances. Mercury and Ceres reserve displays include purchased tracts.
The tract sizes do not estimate planetary resources.

Map infrastructure markers reflect the three capacity upgrades. Additional
schematic swarm bands appear at 2,000, 10,000 and 50,000 t; the diagram caps symbols
for readability and continues to respect Play/Pause and reduced motion.

`tests/lab-campaign-development.test.mjs` exercises v5 continuity, local costs,
finite reserves and ledgers, reserve-protected automatic launches, existing-flight
preservation, invalid state rejection and time-step agreement. Service-edit tests
cover unchanged edits, validation and scheduling/history preservation. The
industrial browser suite covers migration, paid projects, cargo reserve, service
editing, backup/reload and responsive operation using an isolated test world.

## Further work and sources

More destinations and detailed swarm engineering remain future work. Industrial upgrades and additional finite extraction tracts are now implemented.
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


## Performance-based Earth Flight Studio design

After two successful deliveries, the Earth Studio offers “Use this design in
Expeditions.” Both rendezvous must pass, minimum clearance must be at least
120 km and axial load margin at least one. Dirty inputs cannot transfer an old
result. The URL carries inputs only; a worker reruns the numerical model before
showing a candidate. Reviewing changes no saved state and pauses time.

The version-2 report stores the exact design, payload, delivery interval,
recovery propellant, clearance, load margin, specific energy gain and dry mass.
Dry structure/hardware mass is computed at the same 48-cell reference resolution;
validation checks it against the stored design. No claimed URL ratings are trusted.

The reference is the default D1p-0.4.0 two-delivery run: **3 t**, **17,319.84471845627 s**
between releases, **13.615127521277605 t** recovery propellant and **108.88 t** dry mass.
These constants and the following mappings are frozen for network-0.8.0:

| Campaign property | Mapping from measured report |
| --- | --- |
| Earth payload rating | floor(10 × tier × min(3, tested payload / 3)), minimum 1 t |
| Earth recovery reservation | (2 / tier) × clamp(delivery interval / reference interval, 0.25, 4) days |
| Earth corridor fuel multiplier | (1 + clamp((propellant / payload) / reference propellant-per-payload, 0, 4)) / 2 |
| Construction material cost | ceil(40 × dry mass / 108.88), minimum 1 t |
| Equipment cost | ceil(10 × dry mass / 108.88), minimum 1 t |

The reference receives **no import bonus**. Smaller or less efficient designs may
perform worse than the standard fleet. The preview compares current/candidate
capabilities, construction costs and services that would exceed capacity.
Changing design can trade mass throughput against cadence, fuel and cost.

Each route still uses the smaller endpoint capacity, and both endpoints must be
ready. Earth's measured performance is applied symmetrically to bookings involving
Earth as a campaign assumption. Only Earth's half of a tether corridor's support
fuel allocation scales; the remote half, tugs and routes excluding Earth are
unchanged. Coast and handling times remain frozen. A daily recurring service may
not exploit every fractional recovery improvement because it retries daily.
Manual dispatch and Next event can use the actual fractional readiness time.
These ratios model a fleet operational profile; they are not a physical conversion
of a local release into an interplanetary encounter. Electrical energy use is
reported by the Lab but is not a campaign resource or additional fuel charge.

Schema 8 preserves older resources, traffic, services and clocks. Older worlds
without a design keep standard performance. Schema-7/version-1 commissioned reports
retain their paid 20% recovery benefit and original fuel/capacity terms until the
player explicitly converts them. Recalculation is read-only. Conversion credits
40 t material and 10 t equipment once against the new cost, with no cash/refund for
unused credit. Subsequent replacements pay the full displayed cost. Restoring the
standard fleet is free but refunds nothing and retires any unused legacy credit.

Commissioning, replacing or restoring never changes in-flight cargo or existing
reservations. Oversized scheduled payloads are preserved and wait until the player
changes the service, port or design. Atomic saves, revisions and old-head checkpoints
remain in use. Exports retain the report; imports accept versions 1–10.

`tests/fixtures/campaign-v7.json` was made by the prior network-0.7.0 model from
the tracked v6 migration fixture, with construction stock supplied before its paid
commissioning. It is a regression fixture, not a newly collected player save.
Actual solver variants exercise different payload, engine and structure choices;
tests verify dispatch fuel/capacity, changed service frequency, cost, remote-port
limits, step determinism, legacy conversion, replacement and standard restoration.

## Agreed development direction

Expeditions remains a browser strategy game. Subsequent work should deepen the
transport decisions: varied customer demand and contracts, markets and competing
operators, followed by research that changes network capabilities and tradeoffs.
Buyer rounds now vary open demand and new-order rates, while bounded rival fleets
compete for unaccepted requests. Their supply industry remains abstract. Next,
research should create distinct logistical choices with costs and tradeoffs; avoid
adding a mandatory upgrade checklist or an import-only bonus. Playtest the market
in completed saves before expanding the number of interconnected economy systems.

A richer 3D system view should retain the concise operations workspace and expose
route congestion, moving freight and growing infrastructure. Optional close-ups
should explain capture, cargo or industry and preserve immediate return to planning;
first-person piloting and an Unreal migration are outside the chosen direction.

A future optional leaderboard needs shared scenario starts, fixed model versions,
explicit scoring and server-verified action histories. Editable local saves and
self-reported balances are not trustworthy ranked submissions. Keep the existing
offline personal worlds; do not impose an account to continue them. No leaderboard
or competitive backend is implemented by the buyer-market release.
