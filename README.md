# love-of-truth-site
# love-of-truth-site

## YouTube teaching page

`teaching.html` loads the latest public uploads from YouTube's public Atom feed
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
