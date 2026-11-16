# Zenitude Concierge — website

The website for **Zenitude Concierge** (Premier Concierge & Butler Services, Mauritius).
It is a static site built with plain **HTML, CSS and JavaScript**: no PHP, no build step and no dependencies. It is ready to connect to **Firebase**.

## Run it
- **Quickest:** double-click `index.html`. The whole site and the admin work straight from the folder.
- **Local server** (closer to real hosting): run `npx serve .` or `python -m http.server 8000`, then open http://localhost:8000
- **Host it anywhere static:** Firebase Hosting, GitHub Pages, Netlify, or any web host. Just upload the folder.

## Pages
| File | Page |
|---|---|
| `index.html` | Home |
| `team.html` | The team. The first visible member is featured; hover over the others to read their bios. |
| `destination.html?slug=mauritius` | One page per destination (`mauritius`, `rodrigues`, `reunion`, `madagascar`) |
| `experience.html?slug=air` | One page per experience (`air`, `land`, `sea`) |
| `privacy.html`, `terms.html` | Legal pages (editable in the admin) |
| `404.html` | Not-found page |
| `admin/` | Admin panel |

Every page is drawn from one content object. New destinations or experiences added in the admin get a page automatically.

## Project structure
```
index.html, team.html, destination.html, experience.html, privacy.html, terms.html, 404.html
assets/
  css/site.css            all styles (the emblem cursor is set at the top)
  js/templates.js         renders every page from the content
  js/site.js              interactions: menu, animations, slider, compass, contact form
  js/store.js             ZenStore: the ONLY file that reads or writes data
  js/firebase-config.js   paste the Firebase web config here
  img/                    logos, emblem, cursor, favicons
data/content.js           default content (text, team, destinations…)
admin/                    admin panel (index.html, admin.js, admin.css)
firebase.json, firestore.rules, storage.rules   Firebase Hosting and security rules
```

## How data works (`assets/js/store.js`)
All pages and the admin go through `window.ZenStore`. It has two modes:

| | **Demo mode** (now: no Firebase config) | **Firebase mode** (config added) |
|---|---|---|
| Content | `data/content.js`; admin edits are kept in *this browser* | Firestore `site/content` |
| Admin login | none (demo banner shown) | Firebase Auth email + password; must be listed in `admins/{uid}` |
| Images | compressed and kept in this browser | Firebase Storage `uploads/` |
| Contact form | opens the visitor's email app, addressed to the public email | saved in Firestore `enquiries` and shown in the admin inbox |
| Backups | last 15 saves (in the browser) | `site/content/history` |

**Publishing edits in demo mode:** in the admin, edit and save, then open **Backups & export → Download content.js**. Replace `data/content.js` in this repository with the downloaded file and push. (Uploaded images are embedded inside the file, so keep them few and small. Better: put photos in the repo and refer to them by path, or connect Firebase.)

## Connecting Firebase (later)
1. Create a project at https://console.firebase.google.com and add a **Web app**.
2. Enable **Authentication → Email/Password**, **Firestore Database** and **Storage**.
3. Paste the web config into `assets/js/firebase-config.js`.
4. Install the CLI and deploy the rules (and hosting, if you use it):
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add            # choose the project
   firebase deploy --only firestore:rules,storage
   firebase deploy --only hosting   # optional: host the site on Firebase
   ```
5. **Authentication → Users → Add user** (your admin email). Copy the user's **UID**.
6. **Firestore → Start collection `admins`**, then add a document whose ID is that UID, with a field `email`.
7. Open `/admin`, sign in, and press **Save** once. This copies the content into Firestore, and from then on the live site reads from there.

The Firebase adapter is written against the official Firebase JS SDK (v10, compat). It has not been run against a real project yet, so test steps 5–7 on a test project first.

**Security (enforced by the rules files, not by the website code):**
- Anyone can read the website content. Only admins can change it.
- Visitors can only *create* enquiries, with the field types and lengths checked. Only admins can read, update or delete them.
- Only admins can upload or delete images (images only, under 10 MB).
- The admin list cannot be changed from the website; it is managed only in the Firebase console.
- Recommended later: enable **App Check** to reduce spam on the contact form.

## Before going live
- **Photos:** team and destination photos still load from the old WordPress site (`zenitudeconcierge.com/wp-content/...`). Before WordPress is removed, add them to `assets/` (or Firebase Storage) and update the paths in the admin.
- **Wording to check:** the Mauritius and Rodrigues text, the Air/Land/Sea text and the four coast descriptions are new starter copy. Réunion and Madagascar are adapted from the current site.
- **Legal pages:** the Privacy Policy and Terms pages contain placeholder text. Get the final text approved, then paste it in through the admin (Legal pages).
