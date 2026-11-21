# Security notes

This project is a static site. It has no server-side endpoints, authentication, database, or visitor-submitted form data.

- Third-party font downloads have been removed; CSS, scripts, icons, and media are served locally.
- The site uses a restrictive Content Security Policy and standard browser security headers in `vercel.json`.
- External profile links use `rel="noopener noreferrer"` when opened in a new tab.
- The theme preference is stored locally in the visitor’s browser; storage failures are handled without breaking the page.
- The downloadable résumé and contact details are intentionally public portfolio content. Remove or redact them before deployment if you do not want them public.

The site has been reviewed for unsafe dynamic HTML, external script loading, and unnecessary network requests. This is a code-level review, not a third-party penetration test.
