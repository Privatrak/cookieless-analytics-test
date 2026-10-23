# Cookieless analytics tools, tested in a real browser

What nine cookieless analytics tools store in the browser, send, and record on their own, measured with each tool's standard install code on the same test page in Chrome. Also: which common ad blocker lists stop them.

Tools: Plausible, Fathom, Simple Analytics, Umami, Pirsch, Matomo, PostHog, Mixpanel and Privatrak.

We build [Privatrak](https://privatrak.com), one of the nine. The test treats every tool the same way, and the raw results are in [`results/`](results) so you can check them. The write-up is on our blog: [We tested 9 cookieless Google Analytics alternatives](https://privatrak.com/blog/cookieless-analytics-tools).

Run on 24 October 2026 in Chrome 155 on macOS, with the tools' scripts as served on 23 October.

## Results

| Tool                                      | Script (gzip)                       | Left in the browser after the visit                                                                                                                                                          | Recorded without extra code                                                                     | Personal data in URLs kept out |
| ----------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------ |
| Plausible                                 | 2.6 KB                              | nothing                                                                                                                                                                                      | page views                                                                                      | 0 of 9                         |
| Fathom                                    | 2.0 KB                              | nothing                                                                                                                                                                                      | page views                                                                                      | 6 of 9, none in the path       |
| Simple Analytics                          | 3.7 KB                              | nothing                                                                                                                                                                                      | page views                                                                                      | 6 of 9, none in the path       |
| Umami                                     | 2.3 KB                              | nothing                                                                                                                                                                                      | page views                                                                                      | 0 of 9                         |
| Pirsch                                    | 3.4 KB                              | nothing                                                                                                                                                                                      | page views, file download, outbound link                                                        | 0 of 9                         |
| Matomo                                    | 21.7 KB                             | cookies `_pk_id` (13 months), `_pk_ses` (30 minutes)                                                                                                                                         | page views, file download, outbound link                                                        | 0 of 9                         |
| Matomo with `disableCookies`              | 21.7 KB                             | nothing                                                                                                                                                                                      | same as Matomo, without a visitor ID                                                            | 0 of 9                         |
| PostHog                                   | 103.8 KB                            | cookie and localStorage `ph_<token>_posthog` (1 year), 4 sessionStorage keys                                                                                                                 | page views, clicks on buttons, links and the picture, form submit, rage click                   | 1 of 9, only the referrer      |
| PostHog with `cookieless_mode: 'always'`  | 103.8 KB                            | nothing                                                                                                                                                                                      | same as PostHog, without a visitor ID                                                           | 0 of 9                         |
| Mixpanel                                  | 32.9 KB + 102.5 KB session recorder | localStorage `mp_<token>_mixpanel` with a visitor ID (no expiry) and `__mpq_<token>_ev` (queue of unsent events), 2 sessionStorage keys, IndexedDB `mixpanelBrowserDb` and `mixpanelFlagsDb` | page views, clicks on buttons, links and the picture, rage click, dead click, session recording | 0 of 9                         |
| Mixpanel with `disable_persistence: true` | same                                | localStorage `__mpq_<token>_ev`, still holding an unsent click with a device ID                                                                                                              | same as Mixpanel, with a new ID on every page load                                              | 0 of 9                         |
| Privatrak                                 | 13.9 KB                             | nothing                                                                                                                                                                                      | page views, clicks on buttons and links, form submit, rage click, dead click                    | 9 of 9                         |

The last column counts the nine addresses with personal data in the [address test](#personal-data-and-ids-in-the-address) that reached the tool without it.

PostHog and Mixpanel recorded the clicks on the picture as clicks. Privatrak records clicks only on controls (links, buttons and elements with a control role); on the picture it recorded no click but a dead click and a rage click, because it watches elements that look clickable (images, icons, underlined text, a pointer cursor) for those. PostHog's cookieless mode also has to be switched on in the project settings, or its server ignores the events.

Mixpanel's clicks come with its session recording (`record_heatmap_data`), which its quickstart code switches on for every visit; with `record_sessions_percent: 0` it recorded page views only. It also reported the PDF download as a dead click.

Script sizes are the files gzipped at level 9 here, not as each CDN serves them.

"Left in the browser" is what the browser held after this one visit. For the six tools that left nothing, we also read their scripts: Plausible, Fathom, Umami and Pirsch read a localStorage entry that lets a site owner exclude their own visits (`plausible_ignore`, `blockFathomTracking`, `umami.disabled`, `disable_pirsch`), and Fathom writes it only when the owner calls `blockTrackingForMe()`. Simple Analytics touches no browser storage. Privatrak writes sessionStorage only while an account holder uses its Element Picker. Features the visit didn't use, such as surveys or feature flags, may store or send more.

### Ad blocker lists

| Tool             | uBlock Origin (default lists)    | EasyList + EasyPrivacy           | AdGuard Base + Tracking Protection |
| ---------------- | -------------------------------- | -------------------------------- | ---------------------------------- |
| Plausible        | blocked                          | blocked                          | blocked                            |
| Fathom           | blocked                          | blocked                          | blocked                            |
| Simple Analytics | blocked                          | blocked                          | blocked                            |
| Umami            | blocked                          | blocked                          | blocked                            |
| Pirsch           | blocked                          | blocked                          | blocked                            |
| Matomo Cloud     | blocked                          | blocked                          | blocked                            |
| PostHog          | script blocked, send address not | script blocked, send address not | blocked                            |
| Mixpanel         | blocked                          | blocked                          | blocked                            |
| Privatrak        | not blocked                      | not blocked                      | not blocked                        |

Hosted setups only. Most of these tools can be proxied through your own domain, which we didn't test. Privatrak is most likely unlisted because it is new. The matching rules are in [`results/blocking.json`](results/blocking.json).

## Personal data and IDs in the address

A second run (`npm run urls`, results in [`results/urls/`](results/urls)) opens two kinds of addresses and records the page address and referrer exactly as each tool sent them. `npm run analyze` prints both tables.

### Personal data and secrets

Every tool sent a page view for every address; the question is what that page view contained.

- **leaked:** the value arrived as it was.
- **redacted:** the address arrived with a placeholder (`:redacted`, `:id`) where the value was.
- **dropped:** the address arrived with that part cut off, the parameter or everything after the `#`.
- **no referrer:** the page view arrived with no referrer at all (empty, or PostHog's `$direct`).

| Address                                                | Plausible | Fathom      | Simple Analytics | Umami  | Pirsch | Matomo | PostHog     | Mixpanel | Privatrak |
| ------------------------------------------------------ | --------- | ----------- | ---------------- | ------ | ------ | ------ | ----------- | -------- | --------- |
| `?email=someone@example.com`                           | leaked    | dropped     | dropped          | leaked | leaked | leaked | leaked      | leaked   | redacted  |
| `?u=someone@example.com`                               | leaked    | dropped     | dropped          | leaked | leaked | leaked | leaked      | leaked   | redacted  |
| `/reset-password?token=…`                              | leaked    | dropped     | dropped          | leaked | leaked | leaked | leaked      | leaked   | redacted  |
| `/app?t=<JSON Web Token>`                              | leaked    | dropped     | dropped          | leaked | leaked | leaked | leaked      | leaked   | redacted  |
| `/unsubscribe/someone@example.com`                     | leaked    | leaked      | leaked           | leaked | leaked | leaked | leaked      | leaked   | redacted  |
| `/users/48213/settings`                                | leaked    | leaked      | leaked           | leaked | leaked | leaked | leaked      | leaked   | redacted  |
| `/orders/<UUID>`                                       | leaked    | leaked      | leaked           | leaked | leaked | leaked | leaked      | leaked   | redacted  |
| `/callback#access_token=…`                             | leaked    | dropped     | dropped          | leaked | leaked | leaked | leaked      | leaked   | redacted  |
| `/account?email=…`, then a click on (sent as referrer) | leaked    | no referrer | dropped          | leaked | leaked | leaked | no referrer | leaked   | redacted  |

### Data worth keeping

- **kept:** the value arrived as it was.
- **dropped:** the parameter was cut off the address.
- **rewritten:** part of it was replaced with a placeholder.

| Address                        | Plausible | Fathom  | Simple Analytics | Umami | Pirsch | Matomo | PostHog | Mixpanel | Privatrak |
| ------------------------------ | --------- | ------- | ---------------- | ----- | ------ | ------ | ------- | -------- | --------- |
| `/search?q=running+shoes`      | kept      | kept    | dropped          | kept  | kept   | kept   | kept    | kept     | kept      |
| `/products?page=2&sort=price`  | kept      | dropped | dropped          | kept  | kept   | kept   | kept    | kept     | kept      |
| `/products/blue-running-shoes` | kept      | kept    | kept             | kept  | kept   | kept   | kept    | kept     | kept      |
| `/blog/2026/10/launch-notes`   | kept      | kept    | kept             | kept  | kept   | kept   | kept    | kept     | rewritten |
| `/docs/v2/install`             | kept      | kept    | kept             | kept  | kept   | kept   | kept    | kept     | kept      |

Matomo, PostHog and Mixpanel with their cookieless settings gave the same results as their standard setup, except that PostHog in cookieless mode also sent the email address in the referrer. Mixpanel also sent the full address, query and `#` part included, in the URL of every session recording upload (`/record/?$current_url=…`).

Mixpanel sends a page view when the page unloads, so the analysis assigns each page view to the last address opened before it, not to the moment it was sent. Privatrak's **rewritten** is the date: it turns every path segment made only of digits into `:id`, so the address arrives as `/blog/:id/:id/launch-notes`.

## The visit

One page with a working button, a button that does nothing, a picture with a pointer cursor that does nothing, a link to a PDF, a link to another page, a link to another site and a newsletter form. For each tool, a script:

1. opens the page and waits 6 seconds
2. clicks the working button
3. clicks the broken button 4 times quickly
4. clicks the picture 4 times quickly
5. clicks the PDF link (a download)
6. follows the internal link, then goes back
7. follows the outbound link, then goes back
8. submits the form (POST)
9. opens `/welcome?email=someone%40example.com&utm_source=newsletter`
10. reads cookies, localStorage, sessionStorage and IndexedDB, then closes the page

## How nothing reaches the vendors

Chrome runs with `--host-resolver-rules=MAP * 127.0.0.1:8443`, so every hostname resolves to a local HTTPS server ([`src/server.ts`](src/server.ts)). That server serves the test page under `https://cookieless-test.example`, serves each tool's script from `./scripts`, and answers every other request with a plain success while logging it. Each tool uses a made-up site ID.

We used a local server rather than Playwright's request interception because interception does not see requests sent while a page unloads, which is when several trackers send their last batch.

Chrome's own background requests (update checks, autofill) reach the server too; they are answered with an empty response and not recorded.

## Choices worth knowing about

- **Plausible** gives each site its own script (`pa-*.js`) with that site's settings. We used its official npm package, `@plausible-analytics/tracker` 0.4.6, with documented defaults: outbound links, file downloads and form submissions off.
- **PostHog** waits for its server's remote config before it records clicks. We answered with what its server builds for a new project ([`remote_config.py`](https://github.com/PostHog/posthog/blob/master/posthog/models/remote_config.py) from a new team's defaults in `team.py`): autocapture on, heatmaps off, dead-click detection (`captureDeadClicks`) off, network timing on, no session recording.
- **Privatrak** reads `/api/config` before sending anything. We answered with a new project's defaults.
- **Matomo** is matomo.js 5.5.1 with the standard tracking code, and once more with `disableCookies`.
- **PostHog** ran once more with `cookieless_mode: 'always'`.
- **Mixpanel** is mixpanel-js 2.84.0 with the loader and `mixpanel.init` options from its JavaScript quickstart (`track_pageview`, `persistence: "localStorage"`, `record_sessions_percent: 100`, `record_heatmap_data`), and once more with `disable_persistence: true`. Its separate `autocapture` option is off by default and stayed off. The server answers its batches with `{"status": 1}`, as Mixpanel's API does; Mixpanel keeps an unconfirmed batch and sends it again.
- The user agent is set to a fixed desktop Chrome string, and `navigator.webdriver` is false, so no tool skips the visit as automated.

## Running it

Node 22.18 or later (it runs the TypeScript directly), Google Chrome and `openssl`.

```sh
npm install
npm run setup      # downloads the scripts and filter lists, makes a certificate, installs Chrome for Playwright
npm run visit      # runs the visit for every tool: results/<tool>.json
npm run urls       # runs the address test for every tool: results/urls/<tool>.json
npm run analyze    # summarises both into results/summary.json and results/urls/summary.json, and prints the tables
npm run blockcheck # checks the scripts and send addresses against the filter lists: results/blocking.json
```

Run one tool with `npm run visit -- posthog`. The tools' scripts are not in this repository because they belong to their vendors; `npm run setup` downloads the current versions, so a later run may differ from the results here.

`npm test` runs the unit tests, which cover the parsing of every tool's requests and the analysis. With `npm run lint`, `npm run typecheck` and `npm run format:check`, these are the checks CI runs.

## How the code is organised

- [`src/tools/`](src/tools): one folder per tool. `snippet.html` is the install code exactly as the vendor publishes it (a cookieless setting has its own snippet file), and `index.ts` says where the tool's scripts come from, answers the requests its server would need to answer, and reads the tool's requests into events. [`src/tools/index.ts`](src/tools/index.ts) lists them all.
- [`src/test-site.ts`](src/test-site.ts): the test page and its elements.
- [`src/visit.ts`](src/visit.ts) and [`src/url-test.ts`](src/url-test.ts): the two tests, as a list of steps and a list of addresses.
- [`src/server.ts`](src/server.ts) and [`src/browser.ts`](src/browser.ts): the local server and the browser setup.
- [`src/analysis/`](src/analysis): the summaries, from the recorded runs alone.
- [`src/commands/`](src/commands): the `npm run` commands.

## License

MIT, for the code in this repository. The analytics scripts it downloads are their vendors' own.

## Add a tool

Missing a tool? Open an issue with the [Add a tool](../../issues/new?template=add-a-tool.md) template: the tool's standard install code, where its script comes from, and anything it needs from its server before it sends data. We add it to the next run with the same page, the same visit and the same checks. Vendors are welcome to suggest their own tool or to point out where a result is wrong.
