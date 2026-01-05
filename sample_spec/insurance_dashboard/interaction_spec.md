# Interaction Spec: Insurance Policy Coverage Dashboard

## 1. Coverage Map (Visualization)
**Goal**: provide an instant spatial understanding of coverage.

- **Zone Interaction**:
    - **Hover**: Highlights the zone (border glow/brightness increase) and triggers a tooltip.
    - **Tooltip Behavior**: Appears immediately on hover. Follows mouse or positioned intelligently near the zone.
        - *Content*: Zone Name, Peril Context, Status Icon, Summary Text (Why), Source Tag.
    - **Click**: (Optional for high-fidelity) Could pin the tooltip or deep-link to the relevant section in the Coverage Breakdown accordion.
- **Peril Toggles (Wind / Hail / Flood / All)**:
    - **Click**: Instantly updates the color state of all map zones.
    - **Transition**: Smooth color transition (300ms ease).
- **Confidence Meter**:
    - Static display in this mock, but implies data quality.
    - **Low Confidence Flow**: Hovering should suggest "Verify material" action.

## 2. Coverage Panels (Accordion)
**Goal**: Detailed usage of coverage with evidence.

- **Accordion Behavior**:
    - One section expanded at a time (auto-collapse others) OR allow multiple (user preference, usually one at a time is cleaner for vertical space). Let's go with **exclusive expansion** (clicking one closes others) to keep the view tidy.
    - **State**: Default "Wind" expanded (or first item).
- **Content**:
    - **Header**: Sticky visual summary (Icon + Verdict Pill + Key Numbers). High contrast.
    - **Body**: Bullets for Covered/Not Covered.
- **"Show Policy Evidence" Link**:
    - **Interaction**: Click opens a **Side Drawer** (overlaying the right side) or a Modal.
    - **Drawer Content**: Original PDF snippet highlighted.

## 3. Risk Indicators & Risk Now Card
**Goal**: Immediate context on current/forecasted threats.

- **Gauges**:
    - Simple visual meter (arc).
    - **Hover**: Shows precise reading details.
- **Timeline Strip (48h)**:
    - **Hover**: Moving mouse across the strip shows specific hourly forecast values in a small popover.

## 4. Interactive Timeline
**Goal**: Connect policy history with real-world events.

- **Scrubbing**:
    - **Drag Handle**: Draggable element along the horizontal axis.
    - **Feedback**: As the handle moves, the "Coverage at this time" pill updates in real-time.
    - **Snap**: Snaps to key events (dots on the line) for precision.
- **Filter Chips**:
    - **Click**: Toggles visibility of specific event markers on the timeline track.
- **Event Markers**:
    - **Hover/Click**: Shows event summary card (e.g., "Hailstorm - Claim Approved").

## Mobile Responsiveness
- **Order adjustment**: Risk Card triggers top visual context.
- **Map**: Becomes horizontally scrollable or simply scaled down. Tooltips become "Tap to view bottom sheet" or standard tap-tooltips.
- **Timeline**: Stacked or simplified horizontal scroll.
