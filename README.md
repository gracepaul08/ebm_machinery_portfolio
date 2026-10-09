# EBM Machinery website

Responsive public product catalogue and a separate staff admin dashboard. The public site is plain HTML/CSS/JavaScript; Supabase provides authentication, database, and image storage. Staff enter WhatsApp orders in the dashboard. There is no customer checkout.

## Open and edit in VS Code

Open the `ebm-machinery` folder in VS Code. The main files are:

- `index.html`, `styles.css`, `script.js`: public website
- `catalog.js`: loads live products and business contact settings when Supabase is configured; otherwise the original static catalogue remains visible
- `admin.html`, `admin.css`, `admin.js`: protected dashboard interface and workflows
- `assets/`: supplied company logo, photographs, and videos
- `supabase/schema.sql`: database, row-level security policies, role checks, order function, storage setup, and initial products
- `supabase/bootstrap-admin.sql`: one-time first-admin setup
- `assets/supabase-config.js`: public project URL and publishable key

The dashboard supports product create/edit/delete, public visibility, prices, stock alerts, image uploads, WhatsApp order entry, order status, customer/order history, sales summary, business details, and staff roles. Staff and admins are distinguished in the database; staff cannot access admin-only business and team settings.

## Connect Supabase

1. Create a Supabase project and copy its Project URL and **publishable** key from the project API settings.
2. In Supabase SQL Editor, run `supabase/schema.sql` once.
3. In Supabase Authentication settings, disable public sign-ups. Create your own staff account with a strong password.
4. Edit `supabase/bootstrap-admin.sql`, replace the example email with your account email, then run that file once in the SQL Editor. This makes that account the first dashboard admin.
5. Edit `assets/supabase-config.js` and fill in `url` and `publishableKey`. These browser-visible values are designed to be public; never put a service-role/secret key in website files.
6. Upload the entire `ebm-machinery` folder to Netlify. Visit `/admin.html` and sign in. Create or invite additional accounts in Supabase Authentication, then grant roles under **Staff & roles**.

The site uses the Supabase JavaScript CDN, so visitors need an internet connection. The catalogue remains available as a static fallback if Supabase is not configured or its request fails. The dashboard requires a configured Supabase project.

## Publish on Netlify

For a quick publish, sign in to [Netlify Drop](https://app.netlify.com/drop) and drag the complete `ebm-machinery` folder into the drop area. For ongoing edits, connect this folder/repository to a Netlify site or upload a fresh copy from its Deploys page. No build command is required; the publish directory is this folder.

## Add and update products

Use **Products → Add product** in the dashboard. Leave price blank to show customers that they should ask for a quote. Stock is only checked against orders when **Track stock** is enabled. Images can be JPG, PNG, WebP, or SVG up to 5 MB. Staff record WhatsApp conversations under **Orders → Record WhatsApp order**; a recorded order saves a customer, price snapshot, order total, and stock deduction when stock tracking is active.

Prices, inventory, role assignments, and business settings are not invented in the initial data. Add or update them after setup.
