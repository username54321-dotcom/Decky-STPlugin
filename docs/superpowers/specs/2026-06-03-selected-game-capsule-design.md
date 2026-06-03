# Selected Game Capsule in Download Form

## Problem

When a game is selected from the search dropdown, the download form shows only the game name as plain text. The capsule image URL is already stored in `selectedImg` state but never displayed. Users lose visual confirmation of which game they selected.

## Solution

Replace the plain-text resolved name row in `DownloadForm.tsx` with a horizontal flex row showing the capsule thumbnail alongside the game name.

## Scope

**Single file change:** `src/download/DownloadForm.tsx` — replace lines 93-97 (the `resolvedName` block).

No new files, no new state, no new IPC calls, no backend changes.

## Design

### Layout

```
┌──────────────┬─────────────────────┐
│  Capsule     │  Game Name          │
│  120×45px    │  "Counter-Strike 2" │
└──────────────┴─────────────────────┘
```

### Component behavior

Replace the current `<PanelSectionRow>` containing only `<div className={staticClasses.Label}>{resolvedName}</div>` with a flex container:

- **Capsule image:** `<img src={selectedImg}>` at 120×45px, `object-fit: cover`, 3px border radius
- **Error handling:** On `<img>` `onError`, hide the image (`display: none`) and show a `<FaGamepad />` fallback icon centered in a same-sized placeholder box — matching the `InstalledAppCard` pattern
- **Fallback URL:** If `selectedImg` is empty/falsy, construct URL from appid: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appidInput}/capsule_sm_120.jpg`
- **Game name:** Same `resolvedName` text, vertically centered, with text overflow ellipsis
- **Layout:** `display: flex`, `align-items: center`, `gap: 10px`

### Styling constants

Reuse existing values from `src/shared/styles.ts` (`CARD.capsuleWidth`, `CARD.capsuleHeight`) and `FaGamepad` from `react-icons/fa` — both already used in `InstalledAppCard.tsx`.

## Data flow (unchanged)

```
Search → handleSearchSelect → selectedImg state → displayed in form → passed to onStart
```

The `selectedImg` state is already populated by `handleSearchSelect` and passed to `onStart`. This change only adds the visual display step.

## Testing

Manual verification:
1. Search for a game → select it → capsule image appears next to name
2. Select a game with no image URL → fallback capsule URL loads from Steam CDN
3. Break the image URL → FaGamepad icon appears as fallback
4. Click download → download proceeds normally (no behavioral change)
