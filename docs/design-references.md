# Design references

## Typography and composition

The FIRESTONERS outline uses [Averia Serif Libre](https://fonts.google.com/specimen/Averia+Serif+Libre) Bold, as requested.
Like the [Otherkind](https://www.otherkind.design/) wordmark, each letter is kerned until it overlaps its neighbour, and all letters are unioned into one shape.
Headings use [Fraunces](https://fonts.google.com/specimen/Fraunces), and the interface uses [Geist](https://fonts.google.com/specimen/Geist).
The fonts are self-hosted and include their SIL Open Font Licenses.
The SVG editor selects points with an orange, Windows-style selection box, moves them by drag or arrow keys, and shows Reset after a change.
Regenerate the outline with `scripts/outline-wordmark.py`, Python fontTools, and skia-pathops.

## Paradigm Erdős sequence

The live [Erdős view](https://www.paradigm.xyz/#erdos) was observed through a complete animation cycle.
The host site changes visual tabs automatically, so a second local instance of its existing `shadow-lattice` element was observed to keep the full cycle on screen.
Timed screenshots and the deployed animation source are saved under the ignored `output/references` directory.

The sequence reveals an origin and its neighbours, expands and lifts a point lattice into a wireframe volume, changes camera angle, flattens into a radial field, reveals links outward from the centre, then collapses and restarts.
The source defines the camera polar targets as 0, 55, 55, 90, and 0 degrees and the azimuth as 0, 45, and 90 degrees.
Its stage speed changes between 1, .7, .9, .5, and .24 against a 16-second base time.
The neighbour, centre, and final holds are 1.5, 2.15, and 1.1 seconds.
The final collapse takes 1.248 seconds before the origin fades back in.

The local graph is a port of this sequence, drawn with webring nodes.
It builds the same 12-fold cut-and-project lattice: integer points of Z^4, kept when their internal-space image lies in a disk of radius 2.8, capped at the 1,200 points nearest the origin.
Each point lifts by its internal coordinate, and edges join points at unit distance, ordered from the centre outward.
The reveal, zoom, point size, centre fade, box, edge front, holds, collapse, and orthographic camera follow the deployed source.
The lattice and edges draw on a canvas; members are DOM buttons on the first lattice points, so the first member is the origin and the next twelve are its unit neighbours.
The stage labels jump to a stage and pause, as on Paradigm, and a drag on the background orbits the camera, which eases back after release.
Selection, hover, keyboard focus, and search pause the sequence.
Reduced motion shows the static final graph.

The member label follows the callout on Paradigm's [crypto networks](https://www.paradigm.xyz/#crypto-networks) globe.
A dashed leader (6px dash, 6px gap there; 3px here) runs outward from the node along the radius, and the label anchors to its left or right side.
Paradigm types each label line at 22ms per character, with 100ms between lines; the local label uses the same rates.
The local label adds square brackets around the node and the label, and the website v3 rising ink fill on the member name.

Search copies Paradigm's search overlay: a grey 6px blur, a centred white card with a mono prefix, 32px result rows with the location on the right, `[↓] [↑]` hints, and `Close [esc]`.

## Princeton crest and Waterloo

The intro uses the actual book-and-chevron geometry from [Princeton seal.svg](https://commons.wikimedia.org/wiki/File:Princeton_seal.svg).
The master asset is `public/crest.svg`; `scripts/prepare-crest.py` generates its animation path data.
Six ink columns drop in, staggered from right to left, as on [Design Waterloo](https://www.designwaterloo.com/), observed through an archived snapshot.
The crest draws only as a white outline in the centre of the screen, without fill.
At 1.8 seconds the columns lift, staggered over 300ms, and the crest is clipped to the columns behind it, so the lift wipes it away in place.
Both column moves use one in-out bezier curve, `cubic-bezier(.76, 0, .24, 1)`, instead of Design Waterloo's ease-out timing.

## Widget and application

The 32 by 32 Firestone Library pixel icon follows the view from the plaza: the tower with its stair turret, spire, and cross, the tracery hall, and the two arched entrances.
It appears in the header, favicon, join dialog, and footer widget, with a light variant for dark sites.
The widget retains scoped arrow-key navigation and ordinary previous/home/next links.
All application code remains in the cloned `zh1kang/webring` repository at `/Users/caleb/webring`.
The Next.js static export uses `out` and deploys on Vercel at `firestoners.com`.
Join requests use a GitHub issue form, and an `approved` label opens the member pull request.
