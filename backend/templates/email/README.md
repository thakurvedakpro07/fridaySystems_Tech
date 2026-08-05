# ResolveHQ transactional email architecture

All 9 transactional emails share one design system: `base.html` (the shell) plus a small
set of reusable includes in `components/`. Sending itself is unchanged and lives entirely
in `backend/support_app/services/email_service.py` — this directory is presentation only.

## Where to edit things

| What                          | Where |
|-------------------------------|-------|
| Brand colors, fonts, dark mode | `base.html`, inside the single `<style>` block (search for `#5B5CEB`) |
| Logo mark                     | `base.html`, the "Logo header" table — currently a plain `R` monogram on a rounded brand-color square (no image hosting needed). Swap for a hosted `<img>` once a real logo asset exists. |
| Footer (tagline, support email, socials, copyright) | `base.html`, the "Footer" table near the bottom |
| Button style                  | `components/_button.html` |
| Info-card ("meta box") style  | `components/_info_card.html` |
| Security notice copy/style    | `components/_security_notice.html` |

## Component library (`components/`)

Plain Django `{% include %}` partials — no custom template tags, so they work with vanilla
Django template rendering:

- `_button.html` — bulletproof CTA button. Outlook desktop gets a real `<v:roundrect>` VML
  button (its Word engine ignores CSS `border-radius` and can mis-clip `<a>` tap targets);
  every other client gets a plain nested-table + `display:block` anchor, no flexbox anywhere.
  Params: `button_url`, `button_label` — **do not** put a trailing arrow in `button_label`,
  the component appends its own arrow in a `vertical-align:middle` span so it stays centered
  regardless of the recipient's font substitution (baking "→" into the label text let Gmail
  web/Android/iOS each place it at a different baseline — see the dark-mode note below for
  the related text-color bug this component also fixes).
- `_info_card.html` — the shared "ticket / status / role" summary box. Takes up to 6 rows as
  flat params (`row1_label`, `row1_value`, optional `row1_badge_color` + `row1_badge_bg`,
  `row2_*`, … `row6_*`) rather than a list-of-dicts, because Django's `{% include %}` can't
  take a dict/list literal without a custom tag — this keeps the component framework-free.
  Omit a `rowN_label` to skip that row.
- `_security_notice.html` — expiration + "ignore if not you" + "never share this link" +
  support contact box, used by `password_reset.html` and `verify_email.html`. Params:
  `expires_in` (e.g. `"1 hour"`), optional `requested_at` (row is hidden if not passed).
- `_divider.html` — plain horizontal rule.
- `_link_fallback.html` — the muted "or paste this link" line under a CTA button. Param:
  `link_url`.

Includes are **not** scoped with `only`, so they can see ambient context that
`email_service.py`'s `_send()` already injects into every template (`app_url`,
`support_email`) without every call site having to pass those explicitly.

**Important:** Django template tags cannot span multiple lines — `{%.*?%}` tokenizing does
not match across newlines, so a wrapped multi-line `{% include ... with ... %}` silently
renders as literal text instead of raising an error (found the hard way while building this).
Keep every `{% %}` tag, however many `with` params it has, on a single physical line.

## Adding a brand-new transactional email

1. Create `templates/email/<name>.html`, `{% extends "email/base.html" %}`, fill in
   `{% block subject %}`, `{% block preheader %}` (the hidden inbox-preview snippet), and
   `{% block content %}` composed from the components above.
2. Add a `send_<name>(...)` function in `email_service.py` calling `_send(to=..., subject=...,
   template="email/<name>.html", context={...})` — same pattern as every existing function.
3. That's it — no other file needs to change. The base shell, dark mode, footer, and
   Outlook/Gmail-safety rules apply automatically.

## Plain-text emails

Every email automatically gets a plain-text alternative: `_send()` renders the HTML template
and derives plain text via Django's `strip_tags()` — this is unchanged from before this
redesign, by design (see project decision log). Because of this, **keep block-level elements
(`<p>`, `<tr>`, component includes) on their own source line** — `strip_tags()` only preserves
whitespace/newlines that already exist between tags in the source, so one-element-per-line
keeps the stripped plain-text readable instead of collapsing everything onto one line.

## Dark-mode link-color gotcha (found 2026-07-29, real Gmail test)

`base.html`'s dark-mode block has a generic `.card a { color: #8B8FF0 !important; }` rule so
plain inline links (in body copy, footer, etc.) get a readable light-purple on the dark card
background. That rule also matches the CTA button's own `<a>` — without a more specific
override, the button's white text got recolored to that same light purple in dark mode,
which is what caused the "text color inconsistent" symptom in real Gmail. Fixed by giving the
button anchor `class="btn-link"` and adding `.card a.btn-link { color: #ffffff !important; }`
(and the `[data-ogsc]` equivalent) **after** the generic rule, so it wins on specificity.
If you add another component with its own `<a>` that must stay a fixed color regardless of
the generic link-color override, follow the same pattern: a dedicated class + a more specific
override placed after `.card a` in the dark-mode block.

## Known degradations (by design, not bugs)

- `border-radius` and `box-shadow` are ignored by Outlook desktop (Word rendering engine) —
  the card renders as a plain square white box there instead of a rounded/shadowed one.
- Dark mode (`prefers-color-scheme` + Gmail's `[data-ogsc]` hook) is best-effort — email
  client dark-mode support is genuinely inconsistent; clients that don't support it just show
  the light-mode design, which is the intended fallback.
- The logo is a plain-text monogram, not an image — this avoids any "images blocked by
  default" broken-image-icon problem in clients that block remote images, at the cost of not
  looking like a real logo yet.
