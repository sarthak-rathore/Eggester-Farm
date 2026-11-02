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

## Owner controls (Admin)
Orders, Customers (block, reset password, delete), Money, Products (price, MRP, GST %, show/hide),
Offers (GST and delivery, coupons and automatic offers, extra charges, payment options),
Support (customer complaints and replies), Account (farm details, shop headline and announcement,
password, backup). Every table can be downloaded as CSV.
