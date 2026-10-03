# Maintaining the ring

The site is built with Next.js App Router and React and is exported as static files.

## Run locally

Requires Node 22 or newer.

```sh
npm ci
npm run dev -- --port 4173
npm test
npm run validate
npm run build
```

For a local production preview, stop the development server, run `npm run build`, then `npm run preview`.
The preview serves the exported site at `http://127.0.0.1:4173/`.

## Deployment

The site deploys on Vercel, from the Vercel project `firestoners` connected to `zh1kang/webring`.
Every push to `main` deploys production at `https://firestoners.com`; other branches get preview URLs.
Vercel runs `npm run build` and serves the static export in `out`.
The **Check ring** workflow runs the tests, data validation, and build on every pull request and push to `main`.

One-time GitHub setup for member requests: create the issue label `join-request`.
The issue form applies it only when the label exists.

To host below a subpath instead, set `NEXT_PUBLIC_BASE_PATH` (no trailing slash) at build time.

## How members are added

The join form opens the issue form in `.github/ISSUE_TEMPLATE/join.yml`.
The issue form applies the `join-request` label for every author, including authors without triage access.
The **Add member** workflow runs when a labelled issue is opened, edited, reopened, labelled, or gets a comment:

1. It parses the issue form and validates the member, including duplicate IDs and websites.
2. It loads the website and checks that the served HTML links to `firestoners.com`, through the badge links, the icon, or the widget script.
3. It appends the member to `data/members.json` on `main` and closes the issue with the member's ring link.
4. Vercel deploys the new ring after that push.

When a step fails, the workflow comments on the issue once with the reason and changes nothing.
The next edit or comment on the issue runs the check again.
The push only fast-forwards `main`; when another push wins a race, the workflow reads the new ring and retries.
A rerun on a member who is already in the ring only closes the issue.
To add a member by hand, add the `join-request` label to their issue, or edit `data/members.json` directly.
To remove a member, delete their entry from `data/members.json`.
Pushes by `GITHUB_TOKEN` do not start **Check ring**; the member data is validated before the push.
A failed Vercel build does not replace the live site.

## Member data

`data/members.json` is an array of members.
Array order defines the ring.
Append members to keep existing neighbours stable where possible.

| Field | Rule |
| --- | --- |
| `id` | Lowercase letters, numbers, and dashes, up to 40 characters |
| `name` | Up to 80 characters |
| `website` | HTTPS, with no credentials, ports, query strings, or fragments |
| `major` | Up to 60 characters |
| `year` | A four-digit class year |
| `message` | Optional, up to 160 characters |

The **Add member** workflow fetches each submitted website once per check, from a GitHub-hosted runner.
Sites that render the badge only with client-side JavaScript fail the check; their owners can add the badge to the served HTML.

## Widget

The widget uses an original 32 by 32 pixel icon of Firestone Library, drawn by `scripts/pixel-icon.mjs`.
The dark variant, `icon.white.svg`, has no outer outline.
The widget needs no external stylesheet, and its links work without JavaScript.
The included script supports Left and Right arrow keys while the widget has focus.
Previous and next links wrap around the member array, like the [Waterloo CS webring](https://github.com/JusGu/uwatering).
Unknown members produce an inline message and never redirect.

## Interaction

The graph follows the camera choreography of the Paradigm Erdős sequence, but it draws only the members of the ring.
One stage value drives six stages: the first site alone, the other members growing out of it, the lift of the ring into a box, an orbit and a side view of its layers, the flat top view, and the ring links drawing from member to member.
Autoplay holds on the members and on the top view, then collapses and loops.
Members sit on a ring in ring order, clockwise from the top, and each member lifts to its own layer.
Select a stage label to jump to that stage and pause; select anywhere else to resume.
Drag the background to orbit the camera; it eases back after release.
Select a node to show its label beside the graph, with links to visit the site or move to the previous or next member.
Selection, hover, search, and keyboard focus pause the sequence.
Press `/` or Command K to search.
Escape closes the search, the member label, and the join dialog.
Drag a box over the title to select its points, or press Command A, then drag or use arrow keys to reshape it; Reset appears after a change.
Reduced motion skips the crest drawing and shows a still graph.

## Reference details

The FIRESTONERS SVG is generated from Averia Serif Libre Bold by `scripts/outline-wordmark.py`.
Fonts are served locally through `next/font/local`, and their licenses are included beside the font files.
