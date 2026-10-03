# Firestoners - Princeton webring

Firestoners is a webring of personal websites by Princeton students.
Each member links to the previous and next site in the ring, with a small pixel badge of Firestone Library.

## How to join

You need a personal website on HTTPS and a GitHub account.

1. Open [firestoners.com](https://firestoners.com) and select **Join**.
2. Enter your name, member ID, website, major, and class year.
   You can also add a short message (optional, up to 160 characters).
   Your member ID is your short ring link, for example `#alex-chen`.
   Use lowercase letters, numbers, and dashes.
3. Select a light or dark badge, then select **Copy**.
4. Paste the HTML into the footer of your website and publish it.
5. Select **Send request**.
   GitHub opens the **Join the ring** issue form with your details filled in.
6. Confirm that you added the widget, then submit the issue.

A bot checks your request right away.
If the form is valid and your site links to firestoners.com, it adds you to the ring and closes the issue.
You appear on the graph about a minute later.
If something is missing, the bot comments on the issue and tells you what to fix.
Fix it, then edit or comment on the issue, and the bot checks again.
The badge must be in the HTML that your site serves.

### Without the join form

Fill in the [Join the ring issue form](https://github.com/zh1kang/webring/issues/new?template=join.yml) directly.
Or fork this repository, add yourself to the end of `data/members.json`, and open a pull request:

```json
{
  "id": "alex-chen",
  "name": "Alex Chen",
  "website": "https://your.site",
  "major": "Computer Science",
  "year": 2027,
  "message": "Builds tiny synths, writes about type"
}
```

Websites must use HTTPS and cannot contain credentials, ports, query strings, or fragments.

### The badge links

The badge links work without JavaScript.
The copied HTML identifies you by your encoded website.
Your member ID works in the same position:

```text
https://firestoners.com/#https%3A%2F%2Fyour.site?nav=prev
https://firestoners.com/#alex-chen
https://firestoners.com/#alex-chen?nav=next
```

For a dark website, use the dark badge, which uses `icon.white.svg`.
To change your details or leave the ring, open an issue or a pull request that edits `data/members.json`.

Maintainers: see [maintaining the ring](docs/maintaining.md).
