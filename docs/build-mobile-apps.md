# Building the Elauxi iOS and Android apps

Elauxi is a native React Native (Expo) app. Expo's cloud service **EAS Build** turns the code into:

- an **APK** you can install directly on any Android phone (for testing),
- an **AAB** for Google Play,
- an **iOS build** for TestFlight and the App Store.

Builds run on Expo's servers, so you do **not** need a Mac or Android Studio. Run every command below in
VS Code's terminal (PowerShell), inside the `mobile` folder.

## 0. One-time setup

1. Create a free account at https://expo.dev/signup
2. Install the EAS command-line tool:

```bash
npm.cmd install -g eas-cli
```

3. Log in:

```bash
eas.cmd login
```

4. Connect the project to your Expo account (answer **Yes** to create the project):

```bash
eas.cmd init
```

This adds an `extra.eas.projectId` line to `app.json`. Keep it.

## 1. Android test app (APK) — free, about 15 minutes

```bash
eas.cmd build --platform android --profile preview
```

- Answer **Yes** when it asks to generate a new Android keystore (Expo stores it safely for you).
- When it finishes it shows a link and a QR code. Open it on your Android phone, download the APK and install it
  (allow "Install unknown apps" for your browser if asked).

## 2. Google Play (AAB)

Needs a Google Play Console account ($25 one time): https://play.google.com/console

```bash
eas.cmd build --platform android --profile production
```

Then in Play Console: create the app **Elauxi**, go to **Testing → Internal testing → Create release**, and upload the
`.aab` file from the build page. After internal testing, promote the release to Production.
(Later you can upload automatically with `eas.cmd submit --platform android`.)

## 3. iPhone (TestFlight and App Store)

Needs an Apple Developer account ($99/year): https://developer.apple.com/programs/enroll/

```bash
eas.cmd build --platform ios --profile production
```

- Log in with your Apple ID when asked and let EAS create the certificates for you.

Then send it to TestFlight:

```bash
eas.cmd submit --platform ios --latest
```

Open **App Store Connect → TestFlight**, add yourself as a tester and install the **TestFlight** app on your iPhone.
When you're happy, fill in the App Store listing and submit for review.

## App identity

| | Value |
| --- | --- |
| App name | Elauxi |
| iOS bundle ID / Android package | `com.htec.elauxi` |
| Icon, splash | `mobile/assets/` (from the Elauxi logo) |
| Server | `https://appbyahmad-production.up.railway.app` (in `app.json` → `extra.apiUrl`) |

The bundle ID can never change after the first upload to a store.

## Updating the app later

Change the code, then run the same build command again. Version numbers go up automatically.
Before each store release, test with a `preview` build first.

## In-app purchases

App Store and Google Play subscriptions work only in these real builds (not in Expo Go).
Set them up with `docs/revenuecat-setup.md`.
