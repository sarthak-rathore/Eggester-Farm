# Eggester: shop + farm management (phases 1 and 2)

- Customer shop: `/`  (basket, accounts, checkout, order tracking, invoices)
- Owner dashboard: `/#/admin`

## Demo logins (for testing)
- Owner: `admin@kesariyafarms.in`, password `Admin@123`
- Customer: `demo@customer.com`, password `Demo@123` (comes with two sample orders)
Set `VITE_SHOW_DEMO_LOGINS=false` and change `VITE_ADMIN_EMAIL` / `VITE_ADMIN_PASSWORD` before going live.

## Deploy
Push to GitHub, then on vercel.com: Add New > Project > import repo > Deploy. No settings needed.

## Add your own details later
Copy `.env.example` to `.env` locally, or add the same names in Vercel under
Project > Settings > Environment Variables, then redeploy. Everything is optional:
farm details, owner login, delivery fee, UPI ID, Razorpay key, Supabase (phase 3).
Admin > Settings shows which are connected.

## Known limits until phase 3
Data lives in each browser. Accounts, orders and payments are stored locally, so the owner does not
see customers' orders on another device (WhatsApp carries the order). Razorpay payments are not
verified server-side yet. Passwords are hashed in the browser: fine for a demo, not for production.

## The owner dashboard (simple edition)
Open `/#/admin`. Four big buttons are always visible (bottom bar on phones):
- **My Farms**: every batch (Batch A, B...). Tap one to open it. Inside, a second menu has: Overview, Today's Update, Production, Sales, Expenses, Stock Management, Feed Management, Mortality, Health & Medicine, Purchases, Staff & Labor, Tasks & Reminders, Documents & Records, Reports & Analytics.
- **Overall Farm Overview**: all farms together, with filters for farm, batch, date range, month, year, expense type and egg type.
- **Reports & Analytics**: day by day, month by month profit, eggs, sales by customer, expenses, feed, deaths, stock. Download for Excel or print.
- **Settings**: farms & batches, owner & address, staff, suppliers, customers, own fields, alerts, logins (manager / worker / viewer), backup & restore, account, shop prices, customer messages.

### Enter once, everything updates
The farmer only fills **Today's Update** (eggs, birds, feed, sales, expenses, purchases, feed made). The app then does the rest:
- 1 tray = 30 eggs, 1 box = 9 trays = 270 eggs. Selling 3 boxes lowers eggs, trays and boxes, adds the sale, revenue, profit, stock and reports.
- Raw materials (Kg / Quintal / Ton / Litre) -> "Make feed" lowers raw stock, raises feed stock and works out the feed cost. Raw purchases are the expense, so cost is never counted twice.
- Buying feed, raw material, trays or boxes adds to stock and to expenses. Medicine adds an expense and an optional reminder.
- Sales can be marked "money pending" and show under Sales > Money to receive.
- Every saved line can be deleted from "Already saved" at the bottom of Today's Update, and stock and money correct themselves.

### Demo mode and going live
`VITE_DEMO_MODE` in your environment decides everything:
- `on` (default): sample farms, orders, prices, coupons and customers are created, and the owner login is filled in for you. Just press Log in.
- `off`: **all sample data is removed automatically** the next time the site opens (real customer accounts are kept), no sample data is ever created again, the shop starts without prices, and the owner logs in with a **one-time code (OTP)**. A first-run checklist (add farm, add batch, set egg price) guides the owner.

Photos and the farm name are not demo data and stay.

### Customer side switch
`VITE_CUSTOMER_MODE` controls customer login, the customer account page, the basket and online orders:
- not set / `off` (default in live mode): these all disappear. The public page shows the farm, photos and prices, and each product says "To order, contact us" with Call, WhatsApp and Email buttons (shown when the number or email is set). The owner dashboard is unchanged and still reachable from "Owner login" in the footer.
- `on` (or `true`, `1`, `yes`): the full shop opens again with customer accounts, basket and checkout.
- Demo mode always has it on, so you can test everything.

### Logo, icons and contact
The logo is in `public/brand/` (transparent version for dark backgrounds, favicon, app icon, share image). Icons are the Lucide icon set, no emojis. Contact email is Eggesterfarm@gmail.com and the Google Maps link is set in `src/config.js` (or `VITE_FARM_MAP_URL`). Add the phone number in Settings > Owner & Address or `VITE_FARM_PHONE` / `VITE_FARM_WHATSAPP` so the Call and WhatsApp buttons appear.

### Owner OTP login (demo off)
The code is created and checked on the server (`/api` functions on Vercel), so no password or secret is ever inside the website files. Add these in Vercel > Settings > Environment Variables, then redeploy:
- `VITE_DEMO_MODE=off`
- `OTP_SECRET` (32+ random characters, for example `openssl rand -hex 32`)
- Email codes: `OTP_CHANNEL=email`, `ADMIN_EMAIL`, `RESEND_API_KEY`, `OTP_FROM_EMAIL` (a sender on a domain you verified at resend.com)
- SMS codes: `OTP_CHANNEL=sms`, `VITE_OTP_CHANNEL=sms`, `ADMIN_PHONE` (10 digits), `FAST2SMS_API_KEY`

Codes are 6 digits, work once for 5 minutes, lock after 5 wrong tries, and a stranger cannot learn which email or number is the owner's. A login lasts 12 hours. If a setting is missing the owner only sees "Login is not set up yet"; the exact missing names are in Vercel > Logs. To try OTP on your own computer use `vercel dev` (plain `npm run dev` has no server functions).
Manager and worker logins (phone + PIN) are separate and are checked on the device.

### Public home page
Full-screen photo slideshow, scroll-aware menu with a reading-progress bar and phone menu, live "trays ready today" badge, shop, why-us, farm-to-doorstep steps, count-up numbers, a 13-photo gallery with a full-screen viewer (arrows, swipe, Esc), help, contact and footer. All photos are in `public/photos/` (WebP). To add photos, drop a file in that folder and add one line to `photos.gallery` in `src/config.js`.

### Safety and speed
- Security headers, caching and a strict content policy are in `vercel.json`. Passwords and PINs are stored with PBKDF2 (old accounts still work). 5 wrong logins lock that login for 5 minutes. Backups never contain passwords. Errors show friendly messages only; technical details go to the browser console / server log.
- The shop loads about 70 KB of code; charts load only when a chart screen opens. Photos are WebP with long caching. Motion is smooth and is turned off automatically for people who prefer reduced motion.
- `npm test` runs 17 checks: every owner screen opens, demo data vanishes when demo is off, OTP flow, and a full day of entries updating stock, sales and money.
- Records are saved on the device and update instantly on every open screen and tab. Seeing the same live data on several phones needs the online database (phase 3).

### Upgrading from the earlier version
The first time this version opens, farm records in the browser are reset to fresh demo data (customer accounts are kept). Download a backup first if you entered real records.

## Customers
Wholesale only: egg trays of 30, minimum order and bulk price tiers per product, stock taken live from the egg stock.
