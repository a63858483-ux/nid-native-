# Nid (native)

The native iOS client for Nid, built with Expo SDK 57 and expo-router. It talks only to the existing Nid server (`https://chat.xiaoketata.top`) through the same endpoints the web app uses. It never calls any model API directly, and no password or token lives in this repository: you sign in inside the app and the token is kept in the iOS Keychain.

- Bundle id: `top.xiaoketata.nid.native` (installs next to the web-app build)
- Target: iOS 26

## Builds

GitHub Actions → **iOS build (unsigned)** → Run workflow:

- `dev`: a development client. Open it and enter the Metro URL to load code live.
- `release`: a standalone app.

Each run also builds a demo copy for the simulator and uploads screenshots. Install the `.ipa` with Sideloadly.

## Develop

```bash
npm ci
npx expo start --dev-client
```

API notes for this SDK version are in `docs/expo57-api-notes.md`.
