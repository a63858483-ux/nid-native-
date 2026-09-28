# Expo SDK 57 API cheat sheet (iOS 26 chat app)

Researched 2026-09-28 from docs.expo.dev (markdown versions, `/versions/v57.0.0/...` pages where they exist), plus the published npm tarballs `expo@57.0.25`, `expo-router@57.0.23`, `react-native-keyboard-controller@1.21.9` and `@shopify/flash-list@2.0.2`, which I used to check type definitions.

> **Important context:** SDK 58 is out (router 57→58 migration guide is dated 2026-09-10). Pages under `/versions/latest/` and the unversioned guides now show **SDK 58 first**. Every guide snippet has an "SDK 55–57" tab, so always copy from that one and never from the "SDK 58 and later" tab. The biggest trap is `expo-router/native-tabs`, which is SDK 58 only.

## SDK 57 pinned versions (from `expo@57.0.25/bundledNativeModules.json`)

| package | SDK 57 version |
|---|---|
| react-native | 0.86.3 (React 19.2.3, min Node 22.13.x) |
| expo-router | ~57.0.23 |
| react-native-reanimated | 4.5.1 (+ **react-native-worklets 0.10.1**) |
| react-native-screens | ~4.26.0 |
| react-native-gesture-handler | ~2.32.0 |
| react-native-safe-area-context | ~5.7.0 |
| react-native-svg | **15.15.4** |
| @react-native-masked-view/masked-view | 0.3.2 |
| @shopify/flash-list | **2.0.2** |
| react-native-keyboard-controller | **1.21.9** |
| expo-glass-effect | ~57.0.4 |
| expo-blur | ~57.0.3 |
| expo-image-picker | ~57.0.20 |
| expo-file-system | ~57.0.7 |
| expo-secure-store | ~57.0.4 |
| expo-haptics | ~57.0.3 |
| expo-dev-client | ~57.0.19 |
| expo-image | ~57.0.5 |
| expo-symbols | ~57.0.3 |
| @expo/ui | ~57.0.20 |

Platform minimums for SDK 57 (https://docs.expo.dev/versions/v57.0.0/): **iOS 16.4+, Xcode 26.4+**, Android compile/target SDK 36.

`expo-router@57.0.23` itself depends on `expo-glass-effect`, `expo-symbols`, `@expo/ui`, `react-native-drawer-layout ^4.2.2` and `@react-native-masked-view/masked-view ^0.3.2`, so those come in transitively.

Default template since SDK 55: routes live in **`src/app/`**, with the `@/*` alias pointing at `./src/*`. A plain `app/` also works. (https://docs.expo.dev/router/reference/src-directory.md)

---

## 1. Native tabs (expo-router)

Sources: https://docs.expo.dev/router/advanced/native-tabs.md · https://docs.expo.dev/versions/v57.0.0/sdk/router/native-tabs.md · https://docs.expo.dev/router/advanced/nesting-navigators.md

- **Import in SDK 57:** `import { NativeTabs } from 'expo-router/unstable-native-tabs';`
  The docs say: "The examples use `expo-router/native-tabs`, available in SDK 58 and later. In SDK 54 through 57, use `expo-router/unstable-native-tabs` instead." The 57.0.23 tarball ships only `unstable-native-tabs.d.ts`; there is no `native-tabs` entry.
- **Compound API (SDK 55+):** `NativeTabs.Trigger`, `NativeTabs.Trigger.Label`, `NativeTabs.Trigger.Icon`, `NativeTabs.Trigger.Badge`, `NativeTabs.BottomAccessory` (with `NativeTabs.BottomAccessory.usePlacement()` → `'regular' | 'inline'`). The SDK 54 separate `Icon`/`Label` imports are gone.
- **Build:** included in Expo Go, and the `expo-router` config plugin is already in the template (`"plugins": ["expo-router"]`). Nothing extra is needed.

```tsx
// src/app/_layout.tsx  (SDK 57)
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router'; // exported from expo-router since SDK 56
import { useColorScheme } from 'react-native';

export default function TabLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <NativeTabs minimizeBehavior="onScrollDown">
        <NativeTabs.Trigger name="chat">
          <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} md="chat" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="gear" md="settings" />
          <NativeTabs.Trigger.Badge>3</NativeTabs.Trigger.Badge>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
}
```

**`NativeTabs` props (iOS-relevant):** `minimizeBehavior`, `hidden` (default `false`), `tintColor`, `iconColor` (a color or `{ default, selected }`), `labelStyle` (a style or `{ default, selected }`), `badgeBackgroundColor`, `sidebarAdaptable` (iPad/mac), `titlePositionAdjustment`, `screenListeners`, `unstable_nativeProps`. The props `backgroundColor`, `blurEffect`, `shadowColor` and `disableTransparentOnScrollEdge` **have no effect on iOS 26**: Liquid Glass derives the tab bar from the content behind it.

**`minimizeBehavior` (iOS 26+):** `'automatic'` (default) | `'never'` | `'onScrollDown'` | `'onScrollUp'`.

**`NativeTabs.Trigger` props:** `name` (required in a layout), `hidden`, `disabled`, `disablePopToTop`, `disableScrollToTop`, `disableAutomaticContentInsets`, `disableTransparentOnScrollEdge`, `contentStyle` (only backgroundColor/padding/flex-alignment keys), `role` (`'search' | 'history' | 'bookmarks' | 'contacts' | 'downloads' | 'favorites' | 'featured' | 'more' | 'mostRecent' | 'mostViewed' | 'recents' | 'topRated'`), `listeners`, `unstable_nativeProps`. You can also render `NativeTabs.Trigger` **inside the tab screen** to customize its own tab; `name` is ignored there.

**`NativeTabs.Trigger.Icon`:** `sf`, `md` (Android Material Symbols), `src` (image / `getImageSourceSync`), `xcasset`, `drawable`. Each accepts a string or `{ default, selected }`. On iOS, `sf` takes precedence over `src`. `renderingMode`: `'template'` (default) | `'original'`, and it applies only to `src`/`xcasset`. **`NativeTabs.Trigger.Label`:** children is the string; `hidden` hides the label.

**Hiding the tab bar on one screen.** There is no per-screen option. Put `hidden` on `NativeTabs` and toggle it through context:

```tsx
// layout: const [hidden, setHidden] = useState(false);
//         <TabBarContext value={{ setIsTabBarHidden: setHidden }}><NativeTabs hidden={hidden}>…
// screen:
import { useFocusEffect } from 'expo-router';
import { use } from 'react';
useFocusEffect(() => { setIsTabBarHidden(true); return () => setIsTabBarHidden(false); });
```

(`NativeTabs.Trigger hidden` removes a tab entirely and makes it un-navigable. Changing it remounts the navigator and resets state, so don't use it for this.)

**Folder structure, with one Stack per tab.** Native tabs have no header. The docs say "you should nest a native `<Stack />` layout inside the native tabs to support both headers and pushing screens". The Trigger `name` equals the folder name (the docs' search example: `search/_layout.tsx` + `<NativeTabs.Trigger name="search">`). For sheets and zoom above the tabs, wrap everything in a root Stack:

```
src/app/
  _layout.tsx            ← root <Stack> (hosts (tabs) + formSheet/modal routes)
  settings-sheet.tsx     ← presentation: 'formSheet'
  (tabs)/
    _layout.tsx          ← <NativeTabs> with Trigger name="chat", name="me"
    chat/
      _layout.tsx        ← <Stack />
      index.tsx
      [id].tsx
    me/
      _layout.tsx        ← <Stack />
      index.tsx
```

**Gotchas / known limitations (from the docs):**
- Tabs are **not** auto-added. Each one needs a `NativeTabs.Trigger`.
- No nested native tabs. No dynamic adding or removing of tabs (it remounts and loses state). You cannot measure the tab bar height.
- On iOS the **first ScrollView** in a tab screen gets automatic content insets. To keep scroll-to-top and minimize-on-scroll working, the ScrollView must be the first child, or its wrapper needs `collapsable={false}`.
- **FlatList has limited support.** Scroll-to-top and minimize-on-scroll are not supported with it, and scroll-edge detection may fail. This matters for the chat list (see §13).
- White flash when switching tabs on iOS 26, and Liquid Glass header buttons flickering in dark mode: wrap the layout in `ThemeProvider` (from `expo-router`), or give `contentStyle={{ backgroundColor }}` on the Trigger.
- The default and selected image icons must share one rendering mode (this does not apply to SF Symbols).

---

## 2. Stack `formSheet` + in-screen composable options

Sources: https://docs.expo.dev/router/advanced/modals.md · https://docs.expo.dev/router/advanced/stack.md · https://docs.expo.dev/versions/v57.0.0/sdk/router/stack.md · https://docs.expo.dev/router/advanced/stack-toolbar.md

```tsx
// src/app/_layout.tsx
import { Stack } from 'expo-router';
export default function Root() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="settings-sheet"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.5, 1],   // ascending; 1 = full height → sheet is expandable
          sheetInitialDetentIndex: 0,      // number | 'last'
          sheetGrabberVisible: true,       // iOS only, default false
          sheetCornerRadius: 24,
          sheetLargestUndimmedDetentIndex: 'none', // number | 'none' | 'last'
          sheetExpandsWhenScrolledToEdge: true,    // iOS, default true
        }}
      />
    </Stack>
  );
}
```

- **`sheetAllowedDetents`:** `number[]` (fractions 0–1, ascending, checked in dev) or `'fitToContents'`. The default is `[1.0]`. iOS accepts any number of detents; Android allows at most 3.
- **Making the sheet expandable to full height:** include `1` as the last detent, e.g. `[0.5, 1]`. `sheetExpandsWhenScrolledToEdge` (iOS, default `true`) grows the sheet to the next detent when the user scrolls the content. For this to work, the ScrollView must be reachable by following the first child at each level from the screen component.
- **`flex: 1` works** inside sheets with numeric detents since SDK 55. It does **not** work with `'fitToContents'`, which needs explicit content size.
- Other sheet options: `sheetElevation` (Android), `sheetResizeAnimationEnabled`, `sheetShouldOverflowTopInset`, and `unstable_sheetFooter` (Android, experimental).
- Android form sheets render no native header and no nested stack. This doesn't matter for iOS.
- Deep-linked modals need an anchor: `export const unstable_settings = { anchor: 'index' };` in the stack layout.
- In SDK 57, `animationDuration` can't be customized for `formSheet`/`modal`/`pageSheet`.

**Setting options from inside the screen file:** yes, in two interchangeable ways (SDK 55+).
1. Options API: render `<Stack.Screen options={{ title, headerStyle, headerRight, … }} />` inside the page component.
2. **Composition components (status: alpha):** `Stack.Title` (`large`, `largeStyle`, `style`, `asChild`), `Stack.Header` (`blurEffect`, `style: {backgroundColor,color,shadowColor}`, `largeStyle`, `transparent`, `hidden`, `asChild`), `Stack.SearchBar`, `Stack.Screen.BackButton` (`displayMode`, `hidden`, `withMenu`, `src`), and `Stack.Toolbar` (`placement="left" | "right" | "bottom"`, default is `'bottom'`) with children `Stack.Toolbar.Button` (`icon` = SF Symbol name, `onPress`, `variant`, `tintColor`, `selected`, `hidesSharedBackground`, `separateBackground`, …), `Stack.Toolbar.Menu` / `Stack.Toolbar.MenuAction` (`isOn`, `destructive`, `subtitle`, …), `Stack.Toolbar.View`, `Stack.Toolbar.Spacer`, `Stack.Toolbar.SearchBarSlot`, `Stack.Toolbar.Label`, `Stack.Toolbar.Icon`, `Stack.Toolbar.Badge`.

```tsx
// src/app/(tabs)/chat/[id].tsx
import { Stack } from 'expo-router';
export default function Chat() {
  return (
    <>
      <Stack.Title>Antoine</Stack.Title>
      <Stack.Header blurEffect="systemMaterial" />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="ellipsis.circle" onPress={() => {}} />
      </Stack.Toolbar>
      {/* content */}
    </>
  );
}
```

Gotchas:
- If several instances render for the same screen, the last one wins.
- `Stack.Toolbar placement="left"|"right"` forces `headerShown: true`.
- `placement="bottom"` only works in **page** components, not in layouts.
- `Stack.Toolbar` is alpha on iOS since SDK 55.
- iOS 26 headers are Liquid Glass and cannot be turned off per screen. The only opt-outs are `ios.infoPlist.UIDesignRequiresCompatibility: true` (going away in iOS 27) or `expo-router/js-stack`.
- A large title doesn't collapse unless the ScrollView/FlatList is the first child (or its wrapper has `collapsable={false}`).
- I found no documentation that `presentation`/sheet options take effect when set from inside the sheet screen itself. All examples set them in the parent layout's `<Stack.Screen name=… options=…>`, so do the same.

---

## 3. Zoom transition (`Link.AppleZoom`)

Source: https://docs.expo.dev/router/advanced/zoom-transition.md · https://docs.expo.dev/versions/v57.0.0/sdk/router/link.md

Status: **alpha, iOS only, SDK 55+, requires iOS 18+.** On older iOS it silently falls back to a normal push. It's included in expo-router, so there is no extra package or plugin. `Link.AppleZoom`, `Link.AppleZoomTarget`, `Link.Trigger withAppleZoom` and `usePreventZoomTransitionDismissal` all exist in the v57 reference.

```tsx
import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable } from 'react-native';

// source screen
<Link href={{ pathname: '/photo/[id]', params: { id, width, height } }} asChild>
  <Pressable>
    <Link.AppleZoom>
      <Image source={src} style={{ width: 120, height: 160, borderRadius: 12 }} />
    </Link.AppleZoom>
  </Pressable>
</Link>

// destination screen (src/app/photo/[id].tsx)
<Link.AppleZoomTarget>
  <View style={computedSize}><Image source={src} style={{ width: '100%', height: '100%' }} /></View>
</Link.AppleZoomTarget>
```

- `Link.AppleZoom` props: single child, optional `alignmentRect={{x,y,width,height}}`, which usually isn't needed when you use `AppleZoomTarget`.
- `usePreventZoomTransitionDismissal()` disables swipe-to-dismiss, or restricts it with `{ unstable_dismissalBoundsRect: { minX, minY, maxX, maxY } }`. It has no effect on modal-presented screens.

Requirements and limitations:
- Must be inside a `Link` with `asChild`.
- Works **only with the router's Stack navigator**.
- `AppleZoom` and `AppleZoomTarget` each accept a **single child**.
- Avoid it between screens that **have a header**: there are known visual glitches.
- Combined with `Link.Preview`, the target must be modal (`fullScreenModal`).
- There is an ~1s delay on rapid open/close (upstream react-native-screens issue, expo#42797).
- Pass the image size as params so the destination can lay out on its first render.

---

## 4. Drawer

Source: https://docs.expo.dev/router/advanced/drawer.md · https://docs.expo.dev/router/migrate/sdk-55-to-56.md · types checked in `expo-router@57.0.23/build/react-navigation/drawer/types.d.ts`

- **Changed in SDK 56+:** the drawer is **bundled inside `expo-router`** (built on `react-native-drawer-layout`). **Do not install `@react-navigation/drawer`.** Since SDK 56, app code importing any `@react-navigation/*` package raises a bundler error. The migration table says: "`@react-navigation/drawer` → No direct equivalent. Use the `Drawer` layout instead."
- Install the peers: `npx expo install react-native-reanimated react-native-worklets react-native-gesture-handler`
- Import: `import { Drawer } from 'expo-router/drawer';`, which also exports `DrawerContentScrollView`, `DrawerItem`, `DrawerItemList`, `DrawerToggleButton`, `useDrawerStatus`, `useDrawerProgress`, `getDrawerStatusFromState`, and the types `DrawerContentComponentProps` etc.
- Opening it imperatively: `useNavigation().openDrawer()` (from `expo-router`).
- There's no config plugin. It needs the native gesture-handler/reanimated/worklets modules, which are in Expo Go and any dev build.

```tsx
// src/app/_layout.tsx
import { Drawer, DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';

function Sidebar(props: DrawerContentComponentProps) {
  return <DrawerContentScrollView {...props}>{/* custom rows */}</DrawerContentScrollView>;
}

export default function Layout() {
  return (
    <Drawer
      drawerContent={(props) => <Sidebar {...props} />}
      screenOptions={{
        drawerType: 'slide',          // 'front' | 'back' | 'slide' | 'permanent' — default 'slide' on iOS
        drawerStyle: { width: 300 },  // custom width / background
        swipeEdgeWidth: 40,
        swipeEnabled: true,
        overlayColor: 'transparent',
        headerShown: false,
      }}
    >
      <Drawer.Screen name="(tabs)" options={{ drawerLabel: 'Home' }} />
    </Drawer>
  );
}
```

Option names verified in the 57.0.23 types:
- **Navigator props:** `drawerContent`, `detachInactiveScreens`.
- **Screen options:** `drawerType`, `drawerStyle`, `drawerPosition` (`'left'|'right'`), `drawerContentStyle`, `drawerContentContainerStyle`, `drawerHideStatusBarOnOpen`, `drawerStatusBarAnimation`, `overlayColor`, `overlayAccessibilityLabel`, `sceneStyle`, `configureGestureHandler`, `swipeEnabled`, `swipeEdgeWidth`, `swipeMinDistance`, `keyboardDismissMode` (`'on-drag'|'none'`), `popToTopOnBlur`, plus all header options.

`drawerType: 'slide'`: "Both the screen and the drawer slide on swipe to reveal the drawer", which is the push-aside behavior you want.

**Coexisting with native tabs / Stack:** the Expo docs **do not document** a Drawer wrapping `NativeTabs`. The only documented nesting rules are "no nested native tabs" and "JS tabs inside native tabs are OK". Drawer → `(tabs)` group → per-tab Stack is a normal nesting in principle, but treat it as untested: prototype it early. With `drawerType: 'slide'`, the whole native `UITabBarController` gets translated as a JS-driven transform. The fallback is a custom sidebar: a Reanimated translateX on the content plus your own panel, above `NativeTabs`. Also note that a drawer swipe from the left edge fights the Stack's back-swipe gesture on pushed screens. Keep `swipeEnabled` on only for tab roots (set it per screen).

---

## 5. expo-glass-effect

Source: https://docs.expo.dev/versions/v57.0.0/sdk/glass-effect.md

- `npx expo install expo-glass-effect`. Included in Expo Go, no config plugin. Supported on iOS and tvOS. On anything other than iOS 26 it **falls back to a plain `View`**.
- `import { GlassView, GlassContainer, isLiquidGlassAvailable, isGlassEffectAPIAvailable } from 'expo-glass-effect';`

**`GlassView` props:**
- `glassEffectStyle`: `'regular'` (default) | `'clear'` | `'none'`, or a config object `{ style, animate?: boolean, animationDuration?: number /* seconds */ }`.
- `isInteractive`: boolean, default `false`.
- `tintColor`: string.
- `colorScheme`: `'auto'` (default) | `'light'` | `'dark'`.
- Plus all ViewProps.

**`GlassContainer` props:** `spacing` (number: the distance at which children start merging), plus ViewProps.

```tsx
{isGlassEffectAPIAvailable() ? (
  <GlassContainer spacing={10} style={{ flexDirection: 'row', gap: 6 }}>
    <GlassView style={{ width: 44, height: 44, borderRadius: 22 }} isInteractive />
    <GlassView style={{ flex: 1, height: 44, borderRadius: 22 }} glassEffectStyle="regular" tintColor="#F4D8DB55" />
  </GlassContainer>
) : <FallbackBar />}

// fade in/out: animate the style, NOT opacity
<GlassView glassEffectStyle={{ style: visible ? 'regular' : 'none', animate: true, animationDuration: 0.3 }} />
```

- **`isLiquidGlassAvailable()`** checks whether the compiled app uses Liquid Glass (OS version, compiler/Xcode, `UIDesignRequiresCompatibility`). It can still return true when the user has turned on Reduce Transparency, so also check `AccessibilityInfo.isReduceTransparencyEnabled()`.
- **`isGlassEffectAPIAvailable()`** is a runtime check. Some iOS 26 betas lacked the API and crashed (expo#40911). **Check it before rendering GlassView/GlassContainer.**

Known issues:
- **`opacity: 0` on a GlassView or any of its parents makes the glass not render at all** (expo#41024). Use `glassEffectStyle` with `animate` instead. If you must animate opacity, use the documented workaround: `Animated.createAnimatedComponent(GlassView)` with `useAnimatedProps` that switches `glassEffectStyle` to `'none'` near 0, while the opacity is animated on a wrapper `Animated.View`.
- `borderRadius`: all the doc examples set `borderRadius` directly in the GlassView `style`, and the page lists no borderRadius issue. (The `overflow: 'hidden'` requirement is a BlurView issue, not a GlassView one.)

---

## 6. expo-blur, masking, react-native-svg

Sources: https://docs.expo.dev/versions/v57.0.0/sdk/blur-view.md · https://docs.expo.dev/versions/v57.0.0/sdk/masked-view.md · https://docs.expo.dev/versions/v57.0.0/sdk/ui/drop-in-replacements/maskedview.md · https://docs.expo.dev/versions/v57.0.0/sdk/svg.md

`npx expo install expo-blur` (included in Expo Go, no plugin). `import { BlurView, BlurTargetView } from 'expo-blur';`

**`BlurView` props:**
- `intensity`: 1–100, default `50`. It can be animated with Reanimated.
- `tint`, default `'default'`, one of: `'light' | 'dark' | 'default' | 'extraLight' | 'regular' | 'prominent' | 'systemUltraThinMaterial' | 'systemThinMaterial' | 'systemMaterial' | 'systemThickMaterial' | 'systemChromeMaterial'`, plus the `…Light` and `…Dark` variants of each system material (e.g. `'systemThinMaterialDark'`).
- Android only: `blurMethod` (`'none' | 'dimezisBlurView' | 'dimezisBlurViewSdk31Plus'`), `blurReductionFactor`, `blurTarget` (ref to a `BlurTargetView`).

```tsx
<BlurView intensity={60} tint="systemThinMaterial" style={{ borderRadius: 20, overflow: 'hidden' }} />
```

Gotchas:
- **`borderRadius` is ignored unless you add `overflow: 'hidden'`.**
- The blur doesn't update if the BlurView renders **before** dynamic content like a FlatList. Render the `<BlurView/>` after the list in the tree.
- "Every tint adds a translucent color layer".

**Masking a BlurView to an arbitrary shape:**
- `@react-native-masked-view/masked-view` **is** in the SDK 57 list (0.3.2, included in Expo Go, `npx expo install @react-native-masked-view/masked-view`, no plugin). You can have only one of it or the deprecated `@react-native-community/masked-view` installed. Its Android support is experimental.
- **New in SDK 57 docs:** `@expo/ui` ships an API-compatible drop-in, `import { MaskedView } from '@expo/ui/community/masked-view'`. It is implemented with **SwiftUI `.mask`** on iOS, and `androidRenderingMode` is not supported. Props: `maskElement` (only the alpha channel matters) and `children`.
- **Neither Expo page documents or promises that a `BlurView`/`UIVisualEffectView` blurs correctly when it's a masked child.** On iOS, masking a visual-effect view through an ancestor's layer mask is a known way to break the live blur or render it as a flat tint. Treat "BlurView inside MaskedView" as **unverified and risky**, and test on device first. Safer options for a custom-shaped frosted bubble or tail:
  - (a) Blur a rounded rect with `overflow: 'hidden'` and draw the tail as a separate small shape.
  - (b) Try the `@expo/ui` SwiftUI MaskedView, which composites differently.
  - (c) Use a `GlassView` with `borderRadius` instead of blur.
  - (d) Fake it: clip an `expo-image` of the blurred wallpaper with react-native-svg `ClipPath`. That works for static backgrounds only.
- **react-native-svg for SDK 57: `15.15.4`**. Install with `npx expo install react-native-svg`. Included in Expo Go, no plugin. `import Svg, { Path, ClipPath, Defs } from 'react-native-svg';`

---

## 7. expo/fetch streaming

Source: https://docs.expo.dev/versions/v57.0.0/sdk/expo.md (`expo/fetch` API, Streams API, Encoding API) · types in `expo@57.0.25/build/winter/fetch/*.d.ts`

- Import: `import { fetch } from 'expo/fetch';`. This is part of the `expo` package, so there's nothing to install and no plugin.
- **Changed in SDK 57 docs:** "On Android and iOS, `expo/fetch` is also installed as the global `fetch`." Set `EXPO_PUBLIC_USE_RN_FETCH=1` to keep React Native's old global fetch. Named imports keep working either way.
- The `init` type (`FetchRequestInit`) accepts `body`, `headers`, `method`, **`signal`** (AbortSignal), `credentials`, `redirect`, `integrity`, `keepalive`, `mode`, `referrer`. The response has `body: ReadableStream<Uint8Array> | null`, `text()`, `json()`, `bytes()`, `arrayBuffer()`, `blob()`, `formData()`, `clone()`.
- `AbortController` is supported. The runtime also polyfills `AbortSignal.timeout()` and `AbortSignal.any()`. Aborting rejects the pending `reader.read()` with the abort reason.
- `TextDecoder` is global but **UTF-8 only** (not spec-compliant for other encodings). `TextDecoderStream` and `TextEncoderStream` exist. `ReadableStream`, `WritableStream` and `TransformStream` are globals.

```ts
import { fetch } from 'expo/fetch';

const ctrl = new AbortController();
const res = await fetch('https://example.com/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ message }),
  signal: ctrl.signal,
});
if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  let i;
  while ((i = buf.indexOf('\n\n')) >= 0) { handleSSE(buf.slice(0, i)); buf = buf.slice(i + 2); }
}
// ctrl.abort() to cancel
```

- `reader.read()` is the documented pattern. `for await (const chunk of res.body)` is not documented: the runtime only guarantees `Symbol.asyncIterator` exists as a symbol. Use `getReader()`.
- Known limitation, from your own memory notes rather than the Expo docs: when iOS backgrounds the app, it kills in-flight connections, so the SSE stream dies. Keep the existing `/api/chat/busy` resume logic.
- Uploading an `expo-file-system` `File` directly also works: `body: file` or `FormData.append('data', file)`.

---

## 8. expo-image-picker + expo-file-system (new API)

Sources: https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker.md · https://docs.expo.dev/versions/v57.0.0/sdk/filesystem.md

**Image picker:** `npx expo install expo-image-picker`. `import * as ImagePicker from 'expo-image-picker';`

Config plugin: iOS **needs** the usage strings in a real build.

```json
{ "expo": { "plugins": [["expo-image-picker", {
  "photosPermission": "Nid uses your photos so you can send them in chat.",
  "cameraPermission": "Nid uses the camera so you can send photos.",
  "microphonePermission": false
}]] } }
```

(`microphonePermission: false` also blocks Android's RECORD_AUDIO, which the plugin otherwise adds by default.)

```ts
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['images'],            // MediaType | MediaType[]: 'images' | 'videos' | 'livePhotos'
  allowsMultipleSelection: true,     // iOS 14+; mutually exclusive with allowsEditing
  selectionLimit: 9,                 // 0 = system max
  orderedSelection: true,            // iOS 15+
  quality: 0.8,
});
if (!result.canceled) {
  for (const a of result.assets) { /* a.uri, a.width, a.height, a.fileName, a.mimeType, a.fileSize, a.type, a.assetId */ }
}
```

- **`mediaTypes` format:** use a string or array of `'images' | 'videos' | 'livePhotos'`. The `ImagePicker.MediaTypeOptions.*` enum is **deprecated**. The default is `'images'`.
- **Permissions:** the docs say "No permissions request is necessary for launching the image library". The library UI is PHPicker-based on iOS 14+: `preferredAssetRepresentationMode` maps to `PHPickerConfigurationAssetRepresentationMode`. **Exception:** picking **videos** with the default `allowsEditing: false` + `videoExportPreset: Passthrough` makes iOS show a permission dialog *after* selection. Call `requestMediaLibraryPermissionsAsync()` first if you allow videos. For images only, you can skip it.
- Other options: `allowsEditing`, `aspect` (Android only; the iOS crop is always square), `base64`, `exif`, `shouldDownloadFromNetwork` (iCloud, iOS), `preferredAssetRepresentationMode`, `presentationStyle`, `videoMaxDuration`, `videoQuality`, `legacy`/`defaultTab`/`shape` (Android).
- `asset.uri` points into a **cache** directory, so copy it to persist it.
- Known issue: the crop rect is sometimes wrong for high-res images on iOS (a UIImagePickerController bug).

**File system:** since SDK 54 the `File`/`Directory`/`Paths` API is the main export. The old API lives at `expo-file-system/legacy`. `npx expo install expo-file-system`. A plugin is only needed for `supportsOpeningDocumentsInPlace` / `enableFileSharing` (Files-app access to Documents).

```ts
import { File, Directory, Paths } from 'expo-file-system';

const mediaDir = new Directory(Paths.document, 'media');
mediaDir.create({ intermediates: true, idempotent: true });   // no throw if it already exists

export async function persistPicked(asset: ImagePicker.ImagePickerAsset) {
  const src = new File(asset.uri);
  const ext = src.extension || '.jpg';                          // extension includes the dot
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const dest = new File(mediaDir, name);
  await src.copy(dest);            // SDK 57: copy() returns Promise<void>; copySync() is the sync variant
  return name;                     // store the RELATIVE name, rebuild with new File(mediaDir, name)
}
```

- **Changed from SDK 54:** in the v57 reference, `File.copy()`, `File.move()`, `Directory.copy()` and `Directory.move()` **return `Promise<void>`**, and `copySync`/`moveSync` are the synchronous versions. SDK 54 docs had `copy()` synchronous. `rename()` is still synchronous.
- `RelocationOptions`: `{ overwrite?: boolean }` (default false). `DirectoryCreateOptions`: `{ idempotent?, intermediates?, overwrite? }`. `FileCreateOptions`: `{ intermediates?, overwrite? }`.
- `Paths.document` is not purged by the system. `Paths.cache` can be purged. Constructors take path segments or a Directory/File as the first argument, and they throw only if the wrong class is used for an existing path.
- My own iOS note, not in the Expo docs: the absolute container path changes between installs and updates, so persist relative names, not `file.uri`.

---

## 9. expo-secure-store

Source: https://docs.expo.dev/versions/v57.0.0/sdk/securestore.md

`npx expo install expo-secure-store`. `import * as SecureStore from 'expo-secure-store';`

```ts
await SecureStore.setItemAsync('auth_token', token);           // Promise<void>
const t = await SecureStore.getItemAsync('auth_token');          // Promise<string | null>
await SecureStore.deleteItemAsync('auth_token');                 // Promise<void>
// sync variants exist: SecureStore.getItem / SecureStore.setItem (block JS thread)
// options: { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK, requireAuthentication, authenticationPrompt, keychainService, ... }
```

- **Config plugin:** only needed for `requireAuthentication` / Face ID (it sets `NSFaceIDUsageDescription`) and the Android backup config. For a plain token store it isn't required, and it's harmless to add:
  `["expo-secure-store", { "faceIDPermission": "Allow $(PRODUCT_NAME) to use Face ID.", "configureAndroidBackup": true }]`
- Keys may contain only letters and digits plus `.`, `-` and `_`.
- Large values can be rejected. Some iOS versions refused values over ~2048 bytes.
- **iOS Keychain data survives uninstall/reinstall with the same bundle id.** Android data does not.
- To skip the App Store export-compliance prompt: `ios.config.usesNonExemptEncryption: false`.
- Keychain constants: `AFTER_FIRST_UNLOCK`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, `ALWAYS*`, `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`, `WHEN_UNLOCKED`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. For a token that background tasks need, use `AFTER_FIRST_UNLOCK`.

---

## 10. expo-haptics

Source: https://docs.expo.dev/versions/v57.0.0/sdk/haptics.md

`npx expo install expo-haptics` (no plugin on iOS). `import * as Haptics from 'expo-haptics';`

```ts
Haptics.selectionAsync();                                             // Promise<void>
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);               // Light | Medium (default) | Heavy | Rigid | Soft
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);  // Success | Warning | Error
Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm);   // Android-only, preferred there
```

- Enum values are lowercase strings, e.g. `ImpactFeedbackStyle.Light = "light"`.
- On iOS the Taptic Engine **does nothing** in Low Power Mode, when disabled in Settings, while the camera is active, or **while dictation is active**.

---

## 11. expo-dev-client: unsigned CI build + tunnel

Sources: https://docs.expo.dev/versions/v57.0.0/sdk/dev-client.md · https://docs.expo.dev/more/expo-cli.md · https://docs.expo.dev/develop/development-builds/development-workflows.md · https://docs.expo.dev/guides/local-app-development.md · https://docs.expo.dev/versions/v57.0.0/ (Xcode table)

- Install with `npx expo install expo-dev-client`. With it installed, `npx expo start` targets the dev build automatically (the `--dev-client` flag forces it).
- Config plugin (optional):

```json
["expo-dev-client", {
  "launchMode": "most-recent",          // or "launcher"
  "ios": { "defaultLaunchURL": "https://metro.example.com" },
  "addGeneratedScheme": true
}]
```

  `defaultLaunchURL` makes the app launch straight into that URL. With `most-recent`, it's the fallback when the last project can't be reached.
- **Xcode:** SDK 57 requires **Xcode 26.4+**, and the minimum iOS is 16.4. On GitHub Actions, pick a `macos-26` image and run `sudo xcode-select -s /Applications/Xcode_26.4.app` (or newer).

**Unsigned build without EAS.** The Expo docs only cover `npx expo prebuild` / `npx expo run:ios`, and they say Release builds made that way "are not signed". The raw `xcodebuild` flags below are **standard Xcode, not from the Expo docs**:

```bash
npm ci
npx expo prebuild -p ios --clean          # generates ios/ (runs pod install)
cd ios
xcodebuild -workspace Nid.xcworkspace -scheme Nid -configuration Debug \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" build
mkdir -p Payload && cp -R build/Build/Products/Debug-iphoneos/Nid.app Payload/
zip -qry Nid-devclient-unsigned.ipa Payload
```

- A Debug configuration is what makes it a dev client: it contains the launcher and no embedded JS bundle.
- The unsigned ipa has to be re-signed or sideloaded (AltStore, Sideloadly, etc.) before it will install.
- The device needs **iOS Developer Mode** enabled to run development builds (https://docs.expo.dev/guides/ios-developer-mode.md).

**Connecting through a public https tunnel:**
- Built-in: `npm i -g @expo/ngrok` then `npx expo start --tunnel`. This serves the app from `https://xxxx.exp.direct`. Drawbacks: slower, public URL (with entropy), third-party ngrok flakiness, and it can't be combined with `--offline`.
- Your own tunnel (cloudflared etc.): `EXPO_PACKAGER_PROXY_URL=https://metro.example.com npx expo start --dev-client`. This env var "force[s] the URL to be any value", so the manifest and bundle URLs point at the tunnel host instead of the LAN IP. Without it, the manifest would reference `http://<lan-ip>:8081` and the phone couldn't fetch the bundle.
- On the device, the dev launcher shows "Enter URL manually": type `https://metro.example.com`. Other ways in: bake it into `ios.defaultLaunchURL`, or deep link with `{scheme}://expo-development-client/?url=<urlencoded https URL>` (the scheme defaults to `exp+{slug}`).
- The tunnel must forward WebSockets for HMR and the dev menu, and it should route to port 8081.

---

## 12. Keyboard handling for a chat composer

Sources: https://docs.expo.dev/guides/keyboard-handling.md · https://docs.expo.dev/versions/v57.0.0/sdk/keyboard-controller.md · library docs https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-chat-scroll-view · types checked in `react-native-keyboard-controller@1.21.9`

- **Recommended:** the Expo keyboard guide points to `react-native-keyboard-controller` for anything beyond basic `KeyboardAvoidingView`, and its chat example uses `useKeyboardHandler`.
- It's in the SDK 57 list at **1.21.9**: `npx expo install react-native-keyboard-controller`. It needs `react-native-reanimated` (and worklets). There's no config plugin.
- **Expo Go:** the docs contradict each other. The v57 reference page says "Included in Expo Go", while the guide says "not included in Expo Go … create a development build". You're on a dev build either way.
- Provider at the root:

```tsx
import { KeyboardProvider } from 'react-native-keyboard-controller';
export default function Root() { return <KeyboardProvider><Stack /></KeyboardProvider>; }
```

**Exports in 1.21.9:** `KeyboardAvoidingView`, `KeyboardStickyView`, `KeyboardAwareScrollView`, `KeyboardToolbar`, **`KeyboardChatScrollView`**, and hooks such as `useKeyboardHandler` and `useReanimatedKeyboardAnimation`.

**Chat pattern:** `KeyboardChatScrollView` as the list's scroll component, with the composer in a `KeyboardStickyView`.

```tsx
import { KeyboardChatScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSharedValue } from 'react-native-reanimated';

const ChatScroll = forwardRef<ScrollView, ScrollViewProps>((props, ref) => (
  <KeyboardChatScrollView ref={ref} automaticallyAdjustContentInsets={false}
    contentInsetAdjustmentBehavior="never" keyboardLiftBehavior="whenAtEnd"
    offset={bottomInset} extraContentPadding={composerExtra} {...props} />
));

<FlashList data={messages} renderItem={…} renderScrollComponent={ChatScroll}
  maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }} />
<KeyboardStickyView offset={{ closed: 0, opened: bottomInset }}>
  <Composer onHeightDelta={(d) => (composerExtra.value = d)} />
</KeyboardStickyView>
```

- **`KeyboardChatScrollView` props:** `inverted`, `offset`, `keyboardLiftBehavior` (`'always'` default | `'whenAtEnd'` | `'persistent'` | `'never'`), `freeze`, `extraContentPadding` (SharedValue, for a growing multiline input), `blankSpace` (SharedValue, for the AI-chat "push sent message to top" case), `onEndVisible`, `onContentInsetChange`, `applyWorkaroundForContentInsetHitTestBug`, `ScrollViewComponent`.
- **`KeyboardStickyView` props:** `offset={{ closed, opened }}`, `enabled`.
- Gotchas from the library docs:
  - With an `inverted` virtualized list, increase `drawDistance`.
  - `blankSpace` insets don't respond to touch on RN 0.81+ unless you apply the hit-test workaround.
  - On new-arch iOS, a React state update right before a keyboard event can skip the animation (the fix is the `DISABLE_COMMIT_PAUSING_MECHANISM` flag).
  - Call `scrollToEnd` on the chat scroll view's ref, not the list's.
  - Reanimated 4.5 is ≥ 4.3, so the Android commit-hook flag is on by default.
  - The library docs site is at v1.22.0. The `KeyboardChatScrollViewRef` type used in their example is **not exported in 1.21.9**, so type the ref as `ScrollView`.
  - Inside native tabs with the tab bar hidden on the chat screen, `offset` equals the safe-area bottom.

---

## 13. Bottom-anchored chat list

Sources: https://docs.expo.dev/versions/v57.0.0/sdk/flash-list.md · https://shopify.github.io/flash-list/docs/v2-changes · https://shopify.github.io/flash-list/docs/usage · types in `@shopify/flash-list@2.0.2`

- The Expo docs make **no explicit recommendation** for chat lists. The keyboard guide's chat example uses a plain `FlatList`, and the native-tabs page warns that FlatList has limited support there (no scroll-to-top or minimize-on-scroll, and scroll-edge detection can fail).
- **`@shopify/flash-list` is in the SDK 57 list at `2.0.2`** (included in Expo Go): `npx expo install @shopify/flash-list`. v2 is new-architecture only, which is fine on RN 0.86.
- FlashList v2 chat approach, **without `inverted`**: `maintainVisibleContentPosition` is **enabled by default** in v2, and its sub-keys are `disabled`, `autoscrollToTopThreshold`, `autoscrollToBottomThreshold`, `animateAutoScrollToBottom` (default true) and `startRenderingFromBottom`. The v2 notes say: "Chat apps without inverted will also be possible." Load older messages with `onStartReached` + `onStartReachedThreshold`, and raise `drawDistance` if you prepend many rows.

```tsx
<FlashList
  data={messages}                       // oldest → newest (natural order, no reversing)
  keyExtractor={(m) => m.id}
  renderItem={({ item }) => <Bubble m={item} />}
  maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }}
  onStartReached={loadOlder}
  onStartReachedThreshold={0.2}
  drawDistance={800}
  renderScrollComponent={ChatScroll}    // KeyboardChatScrollView wrapper from §12
/>
```

- **`inverted` does not exist in 2.0.2.** It isn't in `FlashListProps` and isn't referenced anywhere in the 2.0.2 dist. The current FlashList docs site does document `inverted` (implemented as a scaleY transform), but that's a newer release than the SDK-pinned one. Stick with `maintainVisibleContentPosition`, or upgrade FlashList outside the SDK pin at your own risk.
- `estimatedItemSize` and friends are deprecated and ignored in v2. Use `useRecyclingState` or `useLayoutState` for per-bubble local state (for example, an expanded thinking block) so recycling doesn't leak state between messages.
- If you use FlatList instead: `inverted` plus reversed data is the classic approach. Pair it with `KeyboardChatScrollView inverted` and `disableTransparentOnScrollEdge` on the tab trigger.
