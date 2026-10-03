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

One-time GitHub setup for member requests:

1. In Settings > Actions > General > Workflow permissions, enable **Allow GitHub Actions to create and approve pull requests**.
   The workflow creates pull requests; it does not approve them.
2. Create the issue labels `join-request` and `approved`.

To host below a subpath instead, set `NEXT_PUBLIC_BASE_PATH` (no trailing slash) at build time.

## Approve a member

The join form opens the issue form in `.github/ISSUE_TEMPLATE/join.yml`.
The issue form applies the `join-request` label for every author, including authors without triage access.

1. Review the join issue.
2. Visit the website and test its ring widget.
3. Add the `approved` label to the open issue.
4. **Prepare approved member** parses the issue form, validates the member, rejects duplicate IDs and websites, and opens a pull request that adds the member.
5. Review and merge the pull request.
6. Vercel deploys the new ring after the merge.

Approval and merge stay with you.
The member workflow has one concurrency group and branch per issue, and it reconciles a branch left behind by a partial run.
To reopen a closed, unmerged member pull request, remove and reapply the `approved` label.
If a request changes after its pull request was created, close it and submit a new request, or edit the member in the pull request.
If two requests conflict after another merge, update the older pull request from `main` and rerun validation before merging.
GitHub may not trigger pull-request checks for a pull request created by `GITHUB_TOKEN`; **Check ring** runs again on `main` after the merge.
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

No service fetches submitted URLs automatically.
Review the site and its widget yourself before approval.

## Widget

The widget uses an original 32 by 32 pixel icon of Firestone Library, drawn by `scripts/pixel-icon.mjs`.
The dark variant, `icon.white.svg`, has no outer outline.
The widget needs no external stylesheet, and its links work without JavaScript.
The included script supports Left and Right arrow keys while the widget has focus.
Previous and next links wrap around the member array, like the [Waterloo CS webring](https://github.com/JusGu/uwatering).
Unknown members produce an inline message and never redirect.

## Interaction

The graph is a port of the Paradigm Erdős sequence, drawn with webring nodes.
One stage value drives the origin, the twelve unit neighbours, the lift of a 12-fold cyclotomic lattice into a box, a side view of its layers, the cut-and-project top view, and the unit-distance graph.
Autoplay holds on the neighbours and on the centre, then collapses and loops.
Members take lattice points from the centre outward, so the first member is the origin.
The lattice and its edges draw on a canvas; members are buttons on top of it.
Select a stage label to jump to that stage and pause; select anywhere else to resume.
Drag the background to orbit the camera; it eases back after release.
Select a node to show its label beside the graph, with links to visit the site or move to the previous or next member.
Selection, hover, search, and keyboard focus pause the sequence.
Press `/` or Command K to search.
Escape closes the search, the member label, and the join dialog.
Drag a box over the title to select its points, or press Command A, then drag or use arrow keys to reshape it; Reset appears after a change.
Reduced motion skips the crest drawing and shows a still graph.

## Reference details

See [design references](design-references.md) for inspected behavior, source notes, and verification limits.
The FIRESTONERS SVG is generated from Averia Serif Libre Bold by `scripts/outline-wordmark.py`.
Fonts are served locally through `next/font/local`, and their licenses are included beside the font files.
