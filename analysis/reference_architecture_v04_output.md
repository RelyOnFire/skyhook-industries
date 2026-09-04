# Skyhook Reference Architecture v0.4 - model output

## Screening baseline

Total physical tether length: 4000 km
Symmetric arm length: 2000 km
Lower-tip altitude at capture comparison: 100 km
Lower-tip inertial speed comparison: 4.1 km/s
COM altitude before capture: 2100 km
COM circular speed before capture: 6.860 km/s
Rotation period: 75.9 min
Tip-module screening allowance: 5.0 t per end
Central functional screening allowance: 30.0 t

## HASTOL order-of-magnitude sanity check

HASTOL derated characteristic velocity 2.03 km/s -> allowable specific strength: 2.060 MJ/kg
v0.4 modeled 510 km grapple-side tether mass ratio: 71.2x payload
v0.4 modeled 90 km station-side contribution with 110x-payload station: 22.8x payload
v0.4 modeled total tether ratio: 94.0x payload
Boeing/NIAC reported tether ratio: approximately 91x payload

## Symmetric two-working-arm structural mass multiplier

| Allowable specific strength | One arm mass / terminal design mass | Two-arm tether mass / terminal design mass | Center/tip area ratio |
| ---: | ---: | ---: | ---: |
| 4.0 MJ/kg | 15.00x | 30.00x | 6.11x |
| 6.0 MJ/kg | 6.22x | 12.44x | 3.34x |
| 8.0 MJ/kg | 3.71x | 7.42x | 2.47x |
| 10.0 MJ/kg | 2.59x | 5.19x | 2.06x |

## Symmetric facility dry-mass sweep

Assumes both arms are payload-rated, 5 t terminal module per end, and 30 t central functional allowance.

| Allowable | Payload | Ideal tether mass | Screening dry facility mass | Dry mass / payload |
| ---: | ---: | ---: | ---: | ---: |
| 4.0 MJ/kg | 5 t | 300.0 t | 340.0 t | 68.0x |
| 4.0 MJ/kg | 10 t | 449.9 t | 489.9 t | 49.0x |
| 4.0 MJ/kg | 15 t | 599.9 t | 639.9 t | 42.7x |
| 4.0 MJ/kg | 20 t | 749.9 t | 789.9 t | 39.5x |
| 6.0 MJ/kg | 5 t | 124.4 t | 164.4 t | 32.9x |
| 6.0 MJ/kg | 10 t | 186.6 t | 226.6 t | 22.7x |
| 6.0 MJ/kg | 15 t | 248.8 t | 288.8 t | 19.3x |
| 6.0 MJ/kg | 20 t | 311.0 t | 351.0 t | 17.5x |
| 8.0 MJ/kg | 5 t | 74.2 t | 114.2 t | 22.8x |
| 8.0 MJ/kg | 10 t | 111.3 t | 151.3 t | 15.1x |
| 8.0 MJ/kg | 15 t | 148.4 t | 188.4 t | 12.6x |
| 8.0 MJ/kg | 20 t | 185.5 t | 225.5 t | 11.3x |
| 10.0 MJ/kg | 5 t | 51.9 t | 91.9 t | 18.4x |
| 10.0 MJ/kg | 10 t | 77.8 t | 117.8 t | 11.8x |
| 10.0 MJ/kg | 15 t | 103.8 t | 143.8 t | 9.6x |
| 10.0 MJ/kg | 20 t | 129.7 t | 169.7 t | 8.5x |

## Allowable specific strength needed to keep screening dry mass <= 300 t

| Payload | Required allowable specific strength |
| ---: | ---: |
| 5 t | 4.24 MJ/kg |
| 10 t | 5.09 MJ/kg |
| 15 t | 5.86 MJ/kg |
| 20 t | 6.60 MJ/kg |

## Instantaneous post-capture COM sensitivity - 15 t payload

This is the combined center-of-mass osculating orbit immediately after an ideal velocity-matched capture. It is not a minimum tether-tip altitude or a full dynamics result.

| Allowable | Dry facility | COM shift toward payload | COM speed loss | Osculating COM perigee |
| ---: | ---: | ---: | ---: | ---: |
| 4.0 MJ/kg | 639.9 t | 45.8 km | 63 m/s | 1665 km |
| 6.0 MJ/kg | 288.8 t | 98.8 km | 136 m/s | 1196 km |
| 8.0 MJ/kg | 188.4 t | 147.5 km | 204 m/s | 793 km |
| 10.0 MJ/kg | 143.8 t | 188.9 km | 261 m/s | 471 km |

## Single-working-arm / counterarm trade - 10 t payload

The working arm is payload-rated; the counterarm is not. Added balance mass is solved from dry first-moment balance. Physically admissible pickup-arm lengths are >= 2,000 km so the opposite tip never dips below the 100 km screening altitude during a full rotation.

| Allowable | Working arm | Added counter-tip balance | Dry facility | Counter-tip minimum altitude |
| ---: | ---: | ---: | ---: | ---: |
| 6.0 MJ/kg | 2000 km | 7.2 t | 216.3 t | 100 km |
| 6.0 MJ/kg | 2400 km | 38.4 t | 266.9 t | 900 km |
| 6.0 MJ/kg | 2800 km | 108.9 t | 356.3 t | 1700 km |
| 8.0 MJ/kg | 2000 km | 6.2 t | 143.2 t | 100 km |
| 8.0 MJ/kg | 2400 km | 27.6 t | 172.0 t | 900 km |
| 8.0 MJ/kg | 2800 km | 71.3 t | 223.5 t | 1700 km |
| 10.0 MJ/kg | 2000 km | 5.4 t | 111.1 t | 100 km |
| 10.0 MJ/kg | 2400 km | 21.8 t | 131.3 t | 900 km |
| 10.0 MJ/kg | 2800 km | 53.5 t | 167.2 t | 1700 km |

## Zero-ballast asymmetric balance test - 10 t payload

| Allowable | Working-arm length that balances with no added ballast | Opposite-tip minimum altitude | Geometry valid? |
| ---: | ---: | ---: | ---: |
| 6.0 MJ/kg | 1796 km | -308 km | no |
| 8.0 MJ/kg | 1778 km | -343 km | no |
| 10.0 MJ/kg | 1769 km | -362 km | no |
