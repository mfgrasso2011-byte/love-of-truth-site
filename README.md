# love-of-truth-site

## Sermon archive and CMS

`sermons.html` contains the local sermon archive. The catalog currently lives in
`content/sermons.json`; audio continues to stream from the original New Covenant
OPC media URLs, so the repository does not contain hundreds of large MP3 files.

The free CMS is [Pages CMS](https://pagescms.org/), a GitHub-based editor configured
by `.pages.yml` in the repository root. To edit the archive:

1. Sign in at [app.pagescms.org](https://app.pagescms.org/) with the GitHub account
   that can edit this repository.
2. Give the Pages CMS GitHub App access to `mfgrasso2011-byte/love-of-truth-site`.
3. Open **Sermon archive**, edit or add an entry, and save. Pages CMS commits the
   updated JSON to GitHub and the normal Netlify deployment publishes it.

To refresh the catalog from a new set of downloaded WordPress speaker-feed pages,
run either migration script:

```sh
node scripts/migrate-sermons.js /path/to/feed-pages content/sermons.json
```

macOS also includes a Ruby-compatible version:

```sh
ruby scripts/migrate-sermons.rb /path/to/feed-pages content/sermons.json
```

## YouTube teaching page

`teaching.html` loads the latest public non-Short uploads from YouTube's public Atom feed
through a cached server-side endpoint. No YouTube API key, Google Cloud project,
or Netlify environment variable is required.

The channel defaults to Love of Truth (`UC4DTiOj4ncwTFGFWB8Rybvw`). To point the
page at another channel without changing code, set `YOUTUBE_CHANNEL_ID` locally
or in Netlify.

### Preview without an API key

From the project directory, start any static file server and open the preview URL:

```sh
python3 -m http.server 8000
```

```text
http://localhost:8000/teaching.html?preview=1
```

Preview mode renders representative local data and the complete responsive page.
The sample cards open the existing Sailing to Chayah YouTube video, so playback
still requires an internet connection. The live public feed is available through
the Netlify function after deployment.
