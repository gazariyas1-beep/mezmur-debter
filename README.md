# Mezmur Debter Tewahedo site

- `index.html` is the whole site. `videos.json` is the list of hymns (updated automatically every hour).
- `lyrics.json` holds lyrics. Format: `{ "VIDEO_ID": ["first stanza", "*chorus line starts with a star"] }`
  The VIDEO_ID is the part after `v=` in the YouTube link.
- `img/` holds the paintings and the top picture.

## Set up (one time)
1. Create an empty repo on GitHub, then in this folder run:
   git init && git add . && git commit -m "first version" && git branch -M main
   git remote add origin https://github.com/YOUR-NAME/YOUR-REPO.git && git push -u origin main
2. Netlify: Add new site > Import an existing project > GitHub > pick the repo. Leave build command and publish folder empty > Deploy.
3. GitHub: Actions tab > "Update videos" > Run workflow (do this once now; it fills in every title).

After that, new uploads appear on the site by themselves within about an hour.
To test on your computer, run `python -m http.server` in this folder and open http://localhost:8000
