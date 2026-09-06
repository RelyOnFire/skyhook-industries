/** Reference records are not engine configurations. Never dispatch by display name. */
export interface ArchitectureRecord {
  id: string;
  name: string;
  category: 'Mechanical configuration' | 'Mission system' | 'Structural construction';
  availability: 'runnable' | 'reference-only';
  summary: string;
  topology: string;
  missing: string;
  source: { title: string; url: string; locator: string };
}
const hastol = 'https://www.niac.usra.edu/files/studies/final_report/355Bogar.pdf';
const cislunar = 'https://www.niac.usra.edu/files/studies/final_report/7Hoyt.pdf';
export const ARCHITECTURES: readonly ArchitectureRecord[] = [
  {
    id: 'single-stage-rotovator', name: 'Single-stage rotovator', category: 'Mechanical configuration', availability: 'runnable',
    summary: 'A tether rotates around its center of mass while orbiting Earth. The lab runs a two-ended, rigid approximation with equal arms.',
    topology: 'One rotating body · two equal working arms',
    missing: 'Available: fixed dimensions, material changes, ideal payload transfers, chemical recovery or coast. This is not a reproduction of any complete historical design.',
    source: { title: 'Cislunar Tether Transport System', url: cislunar, locator: '1999 · introduction: momentum-exchange tethers' },
  },
  {
    id: 't4', name: 'Tillotson Two-Tier Tether', category: 'Mechanical configuration', availability: 'reference-only',
    summary: 'T4 couples a smaller spinning tether to the end of a larger spinning tether through a pivot. The secondary stage has two balanced arms.',
    topology: 'Primary arm → pivot → two-arm secondary rotor',
    missing: 'Needs coupled stage dynamics, independent rotation phases, pivot loads and stage mass accounting. Not two independent relay stations.',
    source: { title: 'HASTOL Phase I', url: `${hastol}#page=101`, locator: '2000 · p. 19 and Appendix 2, A2-15–17' },
  },
  {
    id: 'cardiorotovator', name: 'CardioRotovator', category: 'Mechanical configuration', availability: 'reference-only',
    summary: 'A rotating tether in an elliptical orbit, with spin phased to the orbit so pickup can occur near apogee.',
    topology: 'Elliptical orbit · phase-coupled rotation',
    missing: 'Needs eccentric initial orbits, phase targeting and clearance checks over the complete trajectory.',
    source: { title: 'HASTOL Phase I', url: `${hastol}#page=21`, locator: '2000 · pp. 17–19' },
  },
  {
    id: 'hyperskyhook', name: 'HyperSkyhook', category: 'Mechanical configuration', availability: 'reference-only',
    summary: 'A long tether held approximately along the local vertical rather than spinning rapidly end over end.',
    topology: 'Local-vertical tether · slower lower endpoint',
    missing: 'Needs gravity-gradient and attitude-control behavior outside the current continuously rotating model.',
    source: { title: 'HASTOL Phase I', url: `${hastol}#page=23`, locator: '2000 · pp. 19–20' },
  },
  {
    id: 'liftether', name: 'LIFTether', category: 'Mechanical configuration', availability: 'reference-only',
    summary: 'An atmospheric-interaction concept using aerodynamic drag to slow the grapple before the orbital station lifts the payload.',
    topology: 'Orbital facility · tether · aerodynamic grapple',
    missing: 'Needs atmosphere, drag, heating and flexible-line dynamics. The current lab stops before the atmospheric regime.',
    source: { title: 'HASTOL Phase I', url: `${hastol}#page=19`, locator: '2000 · pp. 15–17' },
  },
  {
    id: 'mxer', name: 'MXER', category: 'Mission system', availability: 'reference-only',
    summary: 'Momentum Exchange / Electrodynamic Reboost combines a payload-transfer tether with an electrically powered recovery system.',
    topology: 'Strength tether + conductor + electrical power',
    missing: 'Needs a field and circuit model, current collection, orientation-dependent force, electrical losses and power limits. A chemical run is not an MXER run.',
    source: { title: 'Design Concept for a Reusable/Propellantless MXER Tether Space Transportation System', url: 'https://ntrs.nasa.gov/citations/20060005548', locator: 'NASA NTRS · document 20060005548' },
  },
  {
    id: 'cislunar', name: 'Earth–Moon relay', category: 'Mission system', availability: 'reference-only',
    summary: 'Separate Earth-orbit and lunar-orbit tethers exchange outbound and return payloads. This is a transport network rather than one compound rotor.',
    topology: 'Earth tether → transfer trajectory → lunar tether',
    missing: 'Needs lunar gravity, transfer targeting, separate facility states and a finite return-traffic schedule.',
    source: { title: 'Cislunar Tether Transport System', url: cislunar, locator: '1999 · project summary and system architecture' },
  },
  {
    id: 'hoytether', name: 'Hoytether', category: 'Structural construction', availability: 'reference-only',
    summary: 'A redundant multiline network that redistributes load around damaged members. It can be part of several orbital architectures.',
    topology: 'Separated primary lines + secondary connections',
    missing: 'Needs load redistribution and damage modeling. Selecting a tapered cable does not simulate a Hoytether or establish debris survivability.',
    source: { title: 'The Hoytether: a multiline space tether structure', url: `${cislunar}#page=114`, locator: 'Hoyt & Forward · Appendix J, 1999 report' },
  },
];
