# Zenitude Concierge — website

Static site: `index.html`, `styles.css`, `script.js`, `assets/`. No build step. Upload the folder to any host, or drop it into a WordPress theme or child theme.

## Cursor
The key emblem is the real system cursor (CSS `cursor:` with 1x/2x PNGs). It has a thin white outline so it stays visible on the dark green sections.
- `assets/cursor.png` / `cursor@2x.png`: default (charcoal)
- `assets/cursor-pointer.png` / `@2x`: over links and buttons (moss green)
- A soft gold ring follows the cursor on desktop. Remove `#cursorRing` to turn it off.

## Before going live
1. **Photos**: the hotel-rep, team and champagne-flute images are loaded from the current WordPress site
   (`zenitudeconcierge.com/wp-content/uploads/...`). Download them into `assets/` and update the 3 `src` paths in `index.html`.
   If an image fails to load, a branded green panel shows instead.
2. **Contact form**: no backend yet. On submit it opens the visitor's email app, pre-filled to info@zenitudeconcierge.com.
   For real submissions, point the form to Formspree, Netlify Forms or a WP endpoint (see the bottom of `script.js`).
3. **Testimonials**: these are short excerpts from the reviews on the current site. Paste in the full text if preferred.
4. **Experience and region copy** (Air/Land/Sea, the four coasts): written as a starting point. Ask management to confirm the services listed.
5. Privacy Policy and Terms links point to `/privacy-policy/` and `/terms/` (the same paths as the current site).
