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

## What the owner manages (Admin)
- Dashboard: flock, feed and nutrition, eggs and stock, money, orders and buyers, with graphs by day, month or year and a filter per flock
- Flocks: each batch of chicks (count, cost, supplier), with mortality and production per batch
- Daily log: feed given, birds died, eggs collected and broken, per flock per day
- Feed: stock in kg and days left, purchases, feed types with protein and energy
- Egg stock: trays produced, sold and in stock (derived), plus manual adjustments
- Orders, Customers, Money (automatic ledger plus other costs), Products (bulk tray prices), Offers, Support, Account
Every table can be downloaded as CSV.

## Customers
Wholesale only: egg trays of 30, minimum order and bulk price tiers per product, stock taken live from the egg stock.
