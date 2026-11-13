# Kesariya Farms: shop + farm management (phases 1 and 2)

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

### Logins
Owner: email + password. Manager / worker / viewer: phone + PIN (Settings > Who Can Log In). Manager = everything except Settings, Worker = Today's Update and Tasks only, Viewer = Overview and Reports only. These are checked in the browser, like the rest of phase 2.

### Upgrading from the earlier version
The first time this version opens, farm records in the browser are reset to fresh demo data (customer accounts are kept). Download a backup first if you entered real records.

## Customers
Wholesale only: egg trays of 30, minimum order and bulk price tiers per product, stock taken live from the egg stock.
