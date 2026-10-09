# Admin guide

The studio admin lives at **`/admin`** on the storefront domain. Each team member signs in with their own account;
what they can see and do depends on their role. Every permission is also enforced by the server.

| Role | Can manage |
|---|---|
| Owner | Everything, including team members, roles and permissions |
| Administrator | Everything except team management |
| Catalog Manager | Products, categories, collections, occasions, attributes, size charts, media, import/export |
| Enquiry Manager | Enquiries, orders, customers, CSV export of enquiries |
| Content Editor | Homepage, pages, lookbooks, testimonials, navigation menus, SEO redirects, media |

Owners can adjust each role's permissions and require two-factor authentication for a role (**Team & Roles → Roles**).
Every user can enable 2FA under **Account & security** (authenticator app + one-time recovery codes).

## First-time setup checklist

1. **Settings → Brand**: brand name, tagline, description; upload logos (primary, for dark backgrounds, for light backgrounds,
   mobile), favicon and default social sharing image. Logos keep their original proportions. Until uploaded, the site shows a
   typographic wordmark.
2. **Settings → WhatsApp**: the business number in international format (e.g. `+91XXXXXXXXXX`); use *Test link* to confirm.
3. **Settings → Storefront**: the public **site URL** (used in product links inside WhatsApp messages), announcement bar,
   newsletter and consultation switches, shipping note.
4. **Settings → Contact / Social**: email, phone, address, hours, map link, social profiles.
5. **Pages**: rewrite *Our Story*; review *Privacy Policy* with your adviser; complete and publish *Shipping & Delivery*,
   *Returns & Exchanges* and *Terms* (they start as drafts).
6. **Media Library → folder `placeholders`**: replace every placeholder image; then remove the fictional demo products
   (search for the tag *Sample*) and the demo lookbook.
7. **Team & Roles**: invite colleagues; they receive a link to set their password.

## Products

**Products → New product.** Save a draft at any time; *Publish now* requires at least one category, one image and a price
(unless *Price on request*). *Schedule…* publishes automatically at a chosen time.

- **Price mode** controls the storefront button: *Fixed* → “Order on WhatsApp”, *Starting from* → “Enquire on WhatsApp”,
  *Price on request* → “Request Price on WhatsApp” (no price is ever shown or sent).
- **Sizes & colours**: pick sizes and colours and click *Generate combinations*. Each row is a real variant with its own SKU,
  stock, policy (*Track stock*, *Made to order*, *Don’t track*), optional price override and image. Remove rows for
  combinations you don’t make — shoppers can never select them.
- **Custom size** lets shoppers choose *Custom Size* and request a fitting consultation (measurements are optional and private).
- **Images**: upload or pick from the library, drag to reorder (the first is the listing image, the second appears on hover),
  write alt text for each, and optionally tag an image with a colour.
- **Duplicate** creates a draft copy with new SKUs. **Archive** removes a product from the storefront (its page returns
  *no longer available*). **Move to trash** is reversible from the *Trash* tab.
- Changing the URL slug of a live product automatically creates a 301 redirect.
- **Import / Export**: download the template, upload a CSV (one row per variant). Every upload is a **dry run** first showing
  creates, updates and per-row errors; click *Import* to apply. Re-importing the same file updates the same products (matched by SKU).

## Categories, collections, occasions, attributes

- Categories nest under departments (Women, Men, Bridal, Accessories). Deleting a category never deletes products.
  *Hide when empty* keeps categories without live products out of menus.
- Collections are independent edits with optional season dates and curated product order (drag to reorder).
- Attributes (fabric, work type, …) can be marked *filterable* to appear as storefront filters; assign them to categories.
- Size charts can be attached to categories (default) or individual products, with an optional downloadable PDF guide.

## Enquiries → orders

An enquiry is created each time a visitor starts a WhatsApp enquiry. It records **what** they selected — not whether they
actually sent the message. Typical flow:

1. **Enquiries** (Open tab): assign to yourself, set a follow-up date, add internal notes, update the status
   (New → Contacted → Awaiting Response → Qualified …). Overdue follow-ups are highlighted and emailed each morning (09:00 IST)
   to the assignee.
2. When the customer confirms, click **Create order**. Items are pre-filled from the enquiry; enter the **agreed** prices,
   shipping and payment details.
3. Set the order to **Confirmed** — this deducts tracked stock once and marks the enquiry *Order Confirmed*. Record payments
   manually (*Partially paid*, *Paid*) and progress the order (*In Production → Ready → Dispatched → Delivered*). Cancelling
   returns stock; a cancelled order cannot be reopened.

**Privacy**: contact details are stored only when the visitor agreed to the privacy notice. Use **Customers → Anonymize** for
deletion requests. Personal details on old enquiries are erased automatically after the retention period
(**Settings → Privacy**).

## Homepage, pages and menus

- **Homepage Builder**: add sections from the predefined designs, edit their content, show/hide, schedule, and drag to
  reorder. Changes are drafts until you click **Publish**; *Preview* opens the draft homepage; *Discard changes* reverts to
  what is live.
- The **Testimonials** section only shows testimonials that are approved **and** have confirmed client consent — never write
  testimonials on a client’s behalf.
- **Navigation Menus**: edit the header (with mega-menu column headings and images) and footer menus. Links to unpublished
  pages or categories are hidden automatically.
- **SEO & Marketing**: manage redirects (301/302/410), default meta description, Google Search Console verification and the
  GA4 measurement ID (loaded only after visitors accept cookies).

## Reports & activity

The dashboard and **Reports** separate **measured** signals (page views, enquiry intents) from **confirmed** business
(orders recorded by staff). **Activity Logs** record every administrative change with who and when.
