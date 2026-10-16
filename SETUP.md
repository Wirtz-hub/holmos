# Setting up HolmOS

This gets HolmOS live on the internet with your own login, then connects Meta and Google Ads.
Budget about an hour, most of it in Meta's and Google's developer settings. Everything
here is on free plans.

You'll collect a handful of **settings** (keys and IDs) along the way. Each one goes into
Vercel under **Project → Settings → Environment Variables**. The file `.env.example` lists
them all.

---

## 1. Database and login (Supabase)

1. Go to [supabase.com](https://supabase.com), sign up, and create a **new project**.
   Pick the **Frankfurt (EU)** region so client data stays in the EU. Save the database
   password somewhere safe (HolmOS doesn't need it, but Supabase may ask for it later).
2. **Turn off public sign-ups** so nobody else can create an account:
   *Authentication → Sign In / Providers →* switch off **Allow new users to sign up**.
3. **Create your own login:** *Authentication → Users → Add user → Create new user.*
   Use your email and a strong password, and tick **Auto confirm user**.
4. **Create the tables:** open *SQL Editor → New query*, paste in everything from
   `supabase/migrations/0001_phase1_crm_and_ads.sql`, and press **Run**.
   It should say "Success. No rows returned". Because you created your login first,
   you're automatically the admin.
5. **Copy three settings** from *Project Settings → API Keys* (and the project URL from
   *Project Settings → Data API*, or the **Connect** button on the project home page):

   | Setting | Where it comes from |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL, looks like `https://abcd1234.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The **publishable** key (`sb_publishable_…`). Older projects call it the **anon** key. |
   | `SUPABASE_SECRET_KEY` | The **secret** key (`sb_secret_…`). Older projects call it **service_role**. Keep this one private. |

6. **Make one more setting yourself:** `TOKEN_ENCRYPTION_KEY`. Use your password
   manager to generate a random password of **40+ characters** (letters and numbers).
   HolmOS uses it to lock away your Meta and Google logins. Don't change it later, or
   you'll have to reconnect Meta and Google.

## 2. Put it online (Vercel)

1. Put this `holmos` folder on GitHub (the easiest way is the free **GitHub Desktop** app:
   *File → Add local repository →* choose the folder → *Publish repository*, kept **private**).
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, **Add New → Project**, and
   import the repository. Vercel recognises it as Next.js; leave the build settings alone.
3. Before pressing **Deploy**, open **Environment Variables** and add the four settings from
   step 1. Deploy.
4. When it's live, copy its address (e.g. `https://holmos-xyz.vercel.app`) and add it as
   `APP_URL` (no slash at the end). Then *Deployments → ⋯ → Redeploy* so it takes effect.
5. Open the address and sign in. You should see an empty pipeline. 🎉

> Later, if you use your own domain (e.g. `os.holmnordic.com`), update `APP_URL` and the
> redirect addresses in steps 3 and 4 below.

## 3. Connect Meta Ads

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps → Create app**.
   - **App details:** name it "HolmOS" and use your email.
   - **Use cases:** pick **Create & manage ads with Marketing API**.
   - **Business:** choose the HolmNordic business portfolio.
   - Click through the remaining screens and create the app.

   This use case adds **Marketing API** and **Facebook Login for Business** to the app for you.
2. *Use cases → Create & manage ads → Customize*: make sure **ads_read** and
   **business_management** are listed (add them if not).
3. *Facebook Login for Business → Settings*: switch on **Client OAuth login** and
   **Web OAuth login**. Under **Valid OAuth Redirect URIs** add
   `https://YOUR-APP-ADDRESS/api/oauth/meta/callback`, plus
   `http://localhost:3000/api/oauth/meta/callback` if you'll also test on your computer. Save.
4. *Facebook Login for Business → Configurations → Create configuration*: name it "HolmOS",
   choose **User access token**, give it access to **Ad accounts**, and tick the permissions
   **ads_read** and **business_management**. Copy the **Configuration ID**.
5. *App settings → Basic*: copy the **App ID** and **App secret**.
6. Add to Vercel and redeploy:

   | Setting | Value |
   |---|---|
   | `META_APP_ID` | App ID |
   | `META_APP_SECRET` | App secret |
   | `META_LOGIN_CONFIG_ID` | Configuration ID from step 4 |

7. In HolmOS go to **Ad accounts → Connect Meta** and log in with Facebook. Every ad
   account you can reach — your own and the ones clients have shared with your Business
   portfolio — appears in the list.

The app can stay in **Development** mode: you're its admin, so it works for your own login.
Meta logins last about 60 days. HolmOS warns you 10 days before and a **Reconnect** button
renews it in one click — your client assignments are kept.

## 4. Connect Google Ads

Google needs two things: a Google Cloud "app" for the login, and a Google Ads **developer token**.

**The login (Google Cloud):**

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project
   called "HolmOS".
2. *APIs & Services → Library*: search for **Google Ads API** and press **Enable**.
3. *Google Auth Platform* (older screens: *OAuth consent screen*): set it up as
   **External**, app name "HolmOS", your email as support and developer contact.
4. Under **Audience**, press **Publish app** so it's "In production". (Left in "Testing",
   Google logs you out every 7 days.) When you connect, Google will say the app is
   unverified — click **Advanced → Go to HolmOS**. That's expected for a private tool.
5. *Clients → Create client* → type **Web application**. Under **Authorized redirect URIs**
   add `https://YOUR-APP-ADDRESS/api/oauth/google/callback` (plus
   `http://localhost:3000/api/oauth/google/callback` to test on your computer). Copy the
   **Client ID** and **Client secret**.

**The developer token (Google Ads):**

6. Sign in to your Google Ads **manager account** (MCC) — create one free at
   [ads.google.com/home/tools/manager-accounts](https://ads.google.com/home/tools/manager-accounts/)
   if you don't have one, and link your clients' accounts to it.
7. In the manager account: *Admin → API Center*. Fill in the form and copy the
   **Developer token**.
8. Check the **access level** shown next to the token:
   - **Explorer access** already works with real client accounts (up to 2,880 requests a day,
     plenty for a handful of clients). You're done.
   - **Test account access** only works with test accounts. On the same page, **apply for
     Basic access** (describe it as "internal reporting tool for my agency's own clients").
     Google's review takes from a couple of days to a few weeks. Until it's approved, HolmOS
     will say the token only works with test accounts.

9. Add to Vercel and redeploy:

   | Setting | Value |
   |---|---|
   | `GOOGLE_CLIENT_ID` | Client ID |
   | `GOOGLE_CLIENT_SECRET` | Client secret |
   | `GOOGLE_ADS_DEVELOPER_TOKEN` | Developer token |

10. In HolmOS go to **Ad accounts → Connect Google** and sign in with the Google account
    that has access to your manager account.

## 5. Pages, forms and bookings (Phase 2)

Landing pages, forms and booking pages work as soon as the database update below is run.
Emails, reminders and Google Calendar are optional extras, each set up once.

### 5a. Update the database

1. Open `supabase/migrations/0002_phase2_funnels_forms_booking.sql` in Notepad, press
   **Ctrl+A**, then **Ctrl+C**.
2. In Supabase open *SQL Editor → New query*, click in the empty box, press **Ctrl+V**, then
   **Run**. It should say "Success. No rows returned".

It only adds things, so the live site keeps working while you do it. Run it **once**: a second
run stops with "already exists", which is harmless.

### 5b. Emails: booking confirmations, reminders, new-answer alerts (Resend)

HolmOS sends email through [Resend](https://resend.com). Its free plan is plenty for an agency.
Without it, everything still works — people just don't get emails.

1. Sign up at [resend.com](https://resend.com).
2. *Domains → Add Domain*. Use a **sub-domain** such as `mail.holmnordic.com`, so your normal
   email isn't affected. Pick the **EU (Ireland)** region.
3. Resend shows three DNS records (one TXT, two CNAME). holmnordic.com's DNS is at
   **Simply.com**: log in, open holmnordic.com → **DNS**, and for each record press
   **Tilføj DNS record**. Pick the **Type**, put Resend's **Name** in **Navn** (Simply adds
   `holmnordic.com` itself) and Resend's **Content** in **Værdi** — clicking a value in Resend
   copies it. Leave TTL as it is. Back in Resend press **I've added the records**. It can take
   up to an hour to turn green. Leave **Enable Receiving** off.
4. *API Keys → Create API Key*: name "HolmOS", permission **Sending access**, and choose the
   domain from step 2. Copy the key — Resend only shows it once.
5. Add to Vercel and redeploy:

   | Setting | Value |
   |---|---|
   | `RESEND_API_KEY` | The key from step 4 (starts with `re_`) |
   | `EMAIL_FROM` | Who emails come from, e.g. `HolmNordic <booking@mail.holmnordic.com>` — the part after @ must be the domain from step 2 |

The **Bookings** page shows whether emails are on.

### 5c. Booking reminders (Vercel cron job)

Every morning (about 6–7 am Danish time) Vercel runs HolmOS's reminder job, which emails
everyone with a meeting in the next 24 hours. It needs emails (5b) and one more setting:

1. Use your password manager to generate a random password of **40+ characters**
   (letters and numbers only).
2. Add it to Vercel as `CRON_SECRET` and redeploy. Vercel then shows the job under
   *Settings → Cron Jobs*.

On Vercel's free plan a cron job can run at most once a day, so reminders go out the morning
of the meeting. On the Pro plan you can change the schedule in `vercel.json` to `0 * * * *`
(every hour) so reminders arrive about 24 hours ahead.

### 5d. Google Calendar

Connecting your Google Calendar means your own Google events block booking times, and every
new booking lands in your calendar — with a Google Meet link if you choose that.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project
   called "HolmOS" (if you already made one for Google Ads, use that).
2. *APIs & Services → Library*: search for **Google Calendar API** and press **Enable**.
3. *Google Auth Platform* (older screens: *OAuth consent screen*): set it up as **External**,
   app name "HolmOS", your email as support and developer contact.
4. *Data Access → Add or remove scopes*: tick `.../auth/calendar.events` and
   `.../auth/calendar.readonly`, then **Update** and **Save**.
5. *Audience*: press **Publish app** so it's "In production". (Left in "Testing", Google logs
   you out every 7 days.) When you connect, Google will say the app is unverified — click
   **Advanced → Go to HolmOS**. That's expected for a private tool.
6. *Clients → Create client* → type **Web application**. Under **Authorized redirect URIs** add
   `https://YOUR-APP-ADDRESS/api/calendar/google/callback`. Copy the **Client ID** and
   **Client secret**. (Later, Google Ads uses the same client: just add its redirect address
   from section 4.)
7. Add to Vercel and redeploy:

   | Setting | Value |
   |---|---|
   | `GOOGLE_CLIENT_ID` | Client ID |
   | `GOOGLE_CLIENT_SECRET` | Client secret |

8. In HolmOS go to **Bookings → Connect Google Calendar** and sign in. Leave both calendar
   permissions ticked. Then choose which calendars count as busy, and which one new bookings
   go into.

### 5e. A page on a client's own domain (optional)

Each page can also live on its own domain, like `tilbud.yourclient.dk`. The page's
**Address & domain** tab walks through it:

1. Type the domain there and save.
2. In Vercel: *Settings → Domains → Add Domain*, type the same domain.
3. Where that domain is registered, add the DNS record Vercel shows — usually a **CNAME** named
   `tilbud` pointing to `cname.vercel-dns.com` (for a bare domain: an **A** record to
   `76.76.21.21`).
4. When Vercel shows "Valid Configuration", the page is live there with https. The
   **Check the domain** button tells you whether the DNS change has arrived.

On that domain only the page is reachable — never your HolmOS login or client data.

## 6. Websites and contact lists for clients

HolmOS can build a whole website for a client — from a ready-made template or written by AI
— and the people who fill in its forms go to **that client's own contact list**, not your
pipeline.

### 6a. Update the database

1. Open `supabase/migrations/0003_client_contacts.sql` in Notepad, press **Ctrl+A**, then
   **Ctrl+C**.
2. In Supabase open *SQL Editor → New query*, click in the empty box, press **Ctrl+V**, then
   **Run**. It should say "Success. No rows returned".

Run it **once**, like 5a. Until it has run, pages and forms can't be created.

### 6b. Free stock photos (Unsplash)

Website templates and the AI pick pictures from [Unsplash](https://unsplash.com), and the
page editor gets a **Find** button for searching photos. Free; the photographer is credited
at the bottom of the page automatically. Without it, websites start without pictures and you
upload your own.

1. Sign up at [unsplash.com/join](https://unsplash.com/join).
2. Open [unsplash.com/oauth/applications](https://unsplash.com/oauth/applications) →
   **New Application**, tick the boxes to accept the API rules, and name it "HolmOS".
3. On the application's page, scroll to **Keys** and copy the **Access Key** (not the Secret key).
4. Add to Vercel and redeploy:

   | Setting | Value |
   |---|---|
   | `UNSPLASH_ACCESS_KEY` | The Access Key |

A new application may make 50 photo requests an hour — enough for about three new websites
an hour plus searching. When HolmOS is in use, press **Apply for production** on the same page
(free) to raise it to 1,000 an hour.

### 6c. AI that writes websites (Gemini and/or Claude)

**Write it with AI** under *Pages & funnels → New page* writes a made-to-measure website from a
short description and, if there is one, the client's current website. You choose the AI each
time. Set up one or both:

**Gemini (Google) — free.** Google's free tier has a daily limit and Google may use what you
send to improve its products, so don't paste private customer information.

1. Go to [aistudio.google.com](https://aistudio.google.com) and sign in with your Google account.
2. Click **Get API key → Create API key**. Create it in a **new project** — not the HolmOS
   project you made for Google Calendar, which has a payment card on it (keys there are billed).
3. Copy the key and add it to Vercel as `GEMINI_API_KEY`, then redeploy.

**Claude (Anthropic) — paid, best writing.** About 1–3 kr. per website. This is separate from
a Claude.ai subscription.

1. Sign up at [console.anthropic.com](https://console.anthropic.com).
2. *Billing*: add a card and buy credit (the smallest amount is plenty to start).
3. *API keys → Create key*, name it "HolmOS", and copy it — it's only shown once.
4. Add it to Vercel as `ANTHROPIC_API_KEY`, then redeploy.

The AI only uses facts you give it or that are on the client's current website. It doesn't
invent reviews, prices or numbers; sections it has nothing for are left out. Always read the
text through before you publish.

### 6d. Putting a website on the client's domain

For a whole website on the client's main domain (e.g. `kundensfirma.dk`):

1. In the page's **Address & domain** tab, type `kundensfirma.dk` and save.
2. In Vercel: *Settings → Domains → Add Domain*, add `kundensfirma.dk` and choose to also add
   `www.kundensfirma.dk` redirecting to it.
3. Where the client's domain is registered (Simply.com, One.com, GoDaddy…): change the **A**
   record for the domain itself (`@`) to `76.76.21.21`, and set **www** as a **CNAME** to
   `cname.vercel-dns.com`. Delete any other A records for `@`. **Don't touch the MX records**
   — they carry the client's email.
4. When Vercel shows "Valid Configuration", the website is live there with https. The old
   website stops showing as soon as the DNS change arrives, so publish first.

## 7. Day-to-day use

- **Lead finder:** type a trade and a town (any country), e.g. *tandlæge* + *Aarhus*. Each
  business gets a score out of 100 for how much it looks like it needs help (no website, not
  made for phones, no Meta pixel, few reviews…), best first. **Contact & email** finds who to
  talk to and writes a first email; **Add to pipeline** puts them in *New* with everything
  found in the notes. **CSV** downloads the list.
- **Pipeline:** *Add lead*, then drag cards between New → Contacted → Qualified → Proposal → Won/Lost.
  Every move is logged in the client's activity automatically.
- **Client page:** contact details, deal value, notes, and a log for calls, emails and meetings.
  Set **What counts as a result?** to leads, purchases or bookings — the dashboard uses it.
- **Giving a client their ad accounts:** on **Ad accounts**, pick the client in the dropdown
  next to an account. That's it. Moving it to another client later works the same way.
- **Dashboards:** each client's dashboard shows only their assigned accounts — spend,
  impressions and reach, clicks and click-through rate, results and cost per result — for any
  date range.
- **Numbers look off?** On the dashboard's "By ad account" table, open
  *What Meta/Google reported* to see exactly which conversions were counted. Under
  *Advanced result settings* on the client page you can point Meta at a custom conversion,
  or tell Google to count every conversion.
- **Websites for clients:** *Pages & funnels → New page → Website* (pick the trade) or
  **Write it with AI**. Set **Belongs to** to the client. You get four pages with a menu and
  footer; change words and pictures like any page, then put it on their domain (6d).
- **A client's contacts:** everyone who fills in a form on a page that belongs to a client
  lands on *Clients → the client → Contacts*, with what they wrote. **Download for Excel**
  gives the whole list. Pages and forms that belong to you still go to your pipeline.
- **Pages & funnels:** *New page*, pick a template, then change the words and pictures. Drag
  blocks from the left onto the page, click a block to edit it, and add steps for a multi-step
  funnel. Changes save by themselves, but visitors only see them after you press **Publish**.
  **Preview** shows your latest version before you publish. The page lives at `/f/its-address`.
- **Forms:** change the questions, then use them in a page's Form block, or paste the code from
  *Share & embed* into any website (WordPress, Wix, Webflow…). Each answer adds the person to
  the pipeline — or, if their email or phone is already there, updates that client — and shows
  in their activity log.
- **Bookings:** make a booking page per type of meeting (length, opening hours, breaks between
  meetings, how much notice you need). Share its link, put it on a page with the Booking block,
  or embed it on a website. Bookings show on the Bookings page and in the client's activity
  log; people can cancel with the link in their confirmation email, and you can cancel from
  the Bookings page.

## 8. Lead finder: Google Maps (optional, recommended)

The **Lead finder** works straight away using OpenStreetMap, which is free but knows fewer
businesses, has no reviews, and is sometimes slow or busy. With a Google Maps key it finds
almost every business, with phone, website and Google reviews, in a second or two.

Google gives a free amount of map searches every month (one search gives up to 20
businesses, so normal use stays free). It still needs a payment card on the project.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and pick the HolmOS
   project you made for Google Calendar (it already has billing set up).
2. *APIs & Services → Library*, search for **Places API (New)** and click **Enable**.
3. *APIs & Services → Credentials → Create credentials → API key*. Copy it.
4. Click the new key → **API restrictions → Restrict key** → tick **Places API (New)** → Save.
5. Optional but wise: *Billing → Budgets & alerts*, make a budget of e.g. 50 kr. so Google
   emails you long before anything costs money.
6. Add the key to Vercel as `GOOGLE_MAPS_API_KEY`, then redeploy.

**Contact & email** on a lead uses the same AI as the website writer (6c): it reads the
business's website, finds the owner or manager if the site names them, and writes a short
first email from you. Always read it before sending.

## Running it on your own computer (optional)

Only needed for development. Install [Node.js](https://nodejs.org) (version 20 or newer), then
in this folder: copy `.env.example` to `.env.local`, fill it in, and run `npm install` followed by
`npm run dev`. Open http://localhost:3000. For Meta and Google to work locally, also add the
`http://localhost:3000/api/oauth/…/callback` addresses in steps 3 and 4, and
`http://localhost:3000/api/calendar/google/callback` in step 5d.
