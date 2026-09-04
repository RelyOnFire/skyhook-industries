# Skyhook Industries design audit — taste-skill + redesign-skill

Date: 2026-09-04
Branch: `polish-audit`

This audit uses Leonxlnx's `taste-skill` and `redesign-skill` as critics, not as binding design systems. Skyhook already has an approved visual direction: cinematic orbital scale paired with aerospace-report structure. Recommendations that strengthen finish, accessibility, mobile behavior or credibility are accepted. Rules that would erase that identity are rejected.

## Accept and implement

| Finding | Decision | Rationale |
| --- | --- | --- |
| Interactive elements need stronger focus states | Accept | Keyboard focus should be visible on navigation, CTAs, source records and the mobile menu. |
| Hover/pressed feedback is sparse | Accept | Small interaction feedback makes the site feel finished without adding decorative motion. |
| Smooth scrolling ignores reduced-motion preference | Accept | Accessibility fix; the visual design does not depend on forced motion. |
| Full-screen hero uses a hard viewport height | Accept | Use a `100dvh`-based minimum so mobile browser chrome and landscape layouts are safer. |
| Mobile typography/spacing needs a dedicated pass | Accept | The desktop composition should collapse intentionally, not merely fit. |
| Long headings and paragraphs can wrap more cleanly | Accept | `text-wrap: balance/pretty` improves polish without changing voice. |
| Technical numerals should use tabular figures | Accept | Fits the report language and improves alignment. |
| Paper-theme mobile menu should match the light surface | Accept | Avoids an unnecessary dark popup on otherwise paper-themed pages. |
| Active-page state is visual only | Accept | Add `aria-current="page"` to the active desktop/mobile navigation item. |
| Social metadata can be more complete | Accept | Add site name and Twitter title/description/image metadata. |

## Consider later

| Finding | Decision | Rationale |
| --- | --- | --- |
| Replace the current system sans stack with a distinctive self-hosted typeface | Consider | Typography is a high-value future brand decision, but should use a deliberately licensed font rather than a dependency added just to satisfy an audit. |
| Replace the CSS Earth with finished hero artwork | Consider | The composition is strong. A better asset could improve it, but only if it remains physically legible and does not become generic space art. |
| Add scroll-driven motion | Consider | Motion should explain orbital rotation, capture or momentum exchange. Decorative animation is not enough reason. |
| Make the About principles grid more asymmetric | Consider | The two-column grid is one of the more conventional blocks, but it is clear and not currently harmful. |
| Publish a raster social card | Consider / high priority | PNG/WebP has broader social-crawler compatibility than SVG. Add when the binary asset workflow is convenient. |
| Restore the purchased legacy favicon/mark | Consider / planned | Test it at favicon, wordmark and large-brand sizes when the original SVG is available. |

## Reject

| Skill rule | Decision | Why it does not fit Skyhook |
| --- | --- | --- |
| Ban numbered section eyebrows | Reject | `01 / Geometry`, figure numbers and gate numbers are part of the aerospace-report language, not arbitrary decoration. |
| One visual theme per page; no dark/light section flips | Reject | The dark orbital sections and warm technical-paper sections are the core design device: spectacle resolves into engineering. |
| Avoid custom SVG diagrams | Reject | Orbital geometry and velocity diagrams are informational figures. Generic icon libraries or stock imagery would be worse. |
| Require both OS light and dark modes | Reject | Skyhook has an authored visual narrative rather than a neutral application theme. |
| Ban em dashes globally | Reject | Punctuation should follow editorial need, not an aesthetic prohibition. |
| Force hero copy to a fixed word/line count | Reject | The current hero was explicitly selected for its rhythm and explanatory value. Mobile wrapping should be optimized instead. |
| Avoid bordered long lists | Reject selectively | Research bibliography rows and engineering gates use rules as document structure, not card decoration. |
| Replace sparse sections with stock imagery | Reject | Generic aerospace stock would reduce credibility. Real technical figures or no image are preferable. |
| Remove mono technical labels/crosshair language as an AI tell | Reject selectively | These elements are justified by the advanced-concepts / engineering-report art direction. |
| Avoid serif body copy | Reject | Georgia is intentionally used as the report/editorial voice against the sans/mono technical frame. |

## Design lock

The current direction remains:

- cinematic black orbital sections for scale and motion;
- warm technical-paper sections for assumptions, evidence and program detail;
- concrete verbs and physical nouns over startup abstraction;
- mono labels and figure/gate numbering where they carry technical meaning;
- custom diagrams for system mechanics;
- one restrained orange engineering-risk accent plus steel/blue technical tones;
- no generic stock-space imagery, glassmorphism, AI-purple or equal three-card feature rows.

The purpose of future polish is to make this system more precise, not more fashionable.
