# Update Button Layout Fix Design

## Problem
The "View Release" and "Install Now" buttons in the update notification area are overlapping or misaligned due to:
1. Using `ButtonItem` (designed for full-width block layout) inside a flex row container
2. Inconsistent `layout` prop usage between buttons
3. No width constraints on flex children

## Solution
Replace `ButtonItem` components with native `<button>` elements styled to match Steam UI, placed inside a properly constrained flex container.

## Scope
Fix both locations where update notification buttons appear:
1. **SettingsPanel.tsx** (lines 120-157) - Settings page update card
2. **index.tsx** (lines 33-75) - Main panel update banner

## Design Details

### Component Changes

#### SettingsPanel.tsx
- Remove `ButtonItem` import (if not used elsewhere)
- Replace flex container with proper sizing constraints
- Use native `<button>` elements with:
  - `flex: 1` for equal width distribution
  - Consistent padding and border-radius matching Steam UI
  - Proper hover/active states
  - Disabled state styling for "Installing..." state

#### index.tsx  
- Same pattern as SettingsPanel.tsx
- Maintain existing button text ("View", "Install", "Dismiss")
- Ensure consistent styling with Settings panel

### Styling Approach
- Inline styles (consistent with existing codebase pattern)
- Color palette:
  - Primary action: `rgba(0, 255, 0, 0.2)` background with green border
  - Secondary action: `rgba(255, 255, 255, 0.1)` background with subtle border
  - Hover states: Slightly lighter backgrounds
- Typography: Match existing Steam Deck font sizes and weights
- Spacing: Use `gap: 8px` between buttons, consistent with existing `SPACING` tokens

### Responsive Considerations
- Add `flexWrap: "wrap"` to container for narrow QAM panels
- Set `minWidth: 0` on buttons to allow proper flex shrinking
- Skip CSS media queries (not supported in inline styles) - flexWrap handles narrow panels adequately

### Error Handling
- Maintain existing disabled state during installation
- Preserve button functionality (View Release opens URL, Install triggers download)
- No changes to update status hook or backend logic

## Testing
- Verify buttons display correctly in both locations
- Test hover and active states
- Test disabled state during installation
- Check narrow panel behavior (if possible)
- Ensure no regression in update functionality

## Success Criteria
1. Buttons are properly aligned side-by-side without overlap
2. Buttons have consistent sizing and spacing
3. Visual appearance matches Steam UI aesthetic
4. Functionality remains unchanged
5. Works in both Settings panel and main panel banner