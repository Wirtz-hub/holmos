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

> Later, if you use your own domain (e.g. `os.holmnordic.dk`), update `APP_URL` and the
> redirect addresses in steps 3 and 4 below.

## 3. Connect Meta Ads

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps → Create App**.
   Choose **Other**, then app type **Business**, name it "HolmOS", and link it to the
   HolmNordic Business portfolio.
2. In the app dashboard, add the products **Marketing API** and **Facebook Login for Business**.
3. *Facebook Login for Business → Settings*: under **Valid OAuth Redirect URIs** add
   `https://YOUR-APP-ADDRESS/api/oauth/meta/callback` and save.
4. *Facebook Login for Business → Configurations → Create configuration*: choose
   **User access token**, and tick the permissions **ads_read** and **business_management**.
   Copy the **Configuration ID**.
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
   add `https://YOUR-APP-ADDRESS/api/oauth/google/callback`. Copy the **Client ID** and
   **Client secret**.

**The developer token (Google Ads):**

6. Sign in to your Google Ads **manager account** (MCC) — create one free at
   [ads.google.com/home/tools/manager-accounts](https://ads.google.com/home/tools/manager-accounts/)
   if you don't have one, and link your clients' accounts to it.
7. In the manager account: *Admin → API Center*. Fill in the form and copy the
   **Developer token**.
8. A new token only works with *test* accounts. On the same page, **apply for Basic access**
   (describe it as "internal reporting tool for my agency's clients"). Approval usually takes
   a few days. Until then HolmOS will say the token only works with test accounts.

9. Add to Vercel and redeploy:

   | Setting | Value |
   |---|---|
   | `GOOGLE_CLIENT_ID` | Client ID |
   | `GOOGLE_CLIENT_SECRET` | Client secret |
   | `GOOGLE_ADS_DEVELOPER_TOKEN` | Developer token |

10. In HolmOS go to **Ad accounts → Connect Google** and sign in with the Google account
    that has access to your manager account.

## 5. Day-to-day use

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

## Running it on your own computer (optional)

Only needed for development. Install [Node.js](https://nodejs.org) (version 20 or newer), then
in this folder: copy `.env.example` to `.env.local`, fill it in, and run `npm install` followed by
`npm run dev`. Open http://localhost:3000. For Meta and Google to work locally, also add the
`http://localhost:3000/api/oauth/…/callback` addresses in steps 3 and 4.
