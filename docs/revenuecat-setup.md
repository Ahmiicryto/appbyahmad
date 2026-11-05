# Selling Premium in the app (RevenueCat)

Apple and Google require subscriptions bought inside a phone app to go through their own payment systems.
RevenueCat connects both stores to your server. Stripe stays for the web version.

You need: an Apple Developer account ($99/year), a Google Play Console account ($25 once), and a free RevenueCat account.

## 1. Create the products in the stores

Use the **same product IDs** in both stores. They must match the IDs on admin → Plans & payments
(the defaults are `premium_monthly` and `premium_yearly`).

- **App Store Connect** → your app → Monetization → Subscriptions → create a group "Premium" → add
  `premium_monthly` ($12.99, 1 month, 7-day free trial) and `premium_yearly` ($89.99, 1 year, 7-day free trial).
- **Google Play Console** → your app → Monetize → Subscriptions → create `premium_monthly` and `premium_yearly`
  with a base plan and a 7-day free trial offer.

The store charges its own price, so keep the prices in the stores and on admin → Plans the same.

## 2. Set up RevenueCat

1. app.revenuecat.com → create a project → add an **App Store** app (bundle ID `com.htec.appbyahmad`) and a
   **Play Store** app (package `com.htec.appbyahmad`). Follow RevenueCat's steps to connect each store.
2. **Products** → import both products from each store.
3. **Entitlements** → create one called `premium` → attach all four products.
4. **Offerings** → the "default" offering → add a Monthly package and an Annual package with the products.

## 3. Connect RevenueCat to your admin

In RevenueCat → Project settings → **API keys**, copy:

| RevenueCat | Admin → Settings → In-app purchases |
| --- | --- |
| Apple public key (`appl_…`) | Apple public SDK key |
| Google public key (`goog_…`) | Google public SDK key |
| Secret API key (`sk_…`, create a v1 secret key) | Secret API key |

Then make up a long password (16+ characters) and type it into **Webhook password**. Save.

In RevenueCat → Integrations → **Webhooks** → add a webhook:

- URL: `https://appbyahmad-production.up.railway.app/api/billing/revenuecat/webhook`
- Authorization header value: the same password you just saved.

Also fill in **Terms of use link**, **Privacy policy link** and **Support email** in admin → Settings → App.
Apple rejects subscription apps without them.

## 4. Test

Store purchases don't work in Expo Go (it only shows a preview). Build a test version with EAS:

```bash
npm install -g eas-cli
```

```bash
cd mobile
```

```bash
eas build --profile development --platform ios
```

Use an Apple **Sandbox** tester or a Google **license tester** account to buy without being charged.
After a test purchase, admin → Users should show that user as Premium, and Plans & payments shows the payment.
