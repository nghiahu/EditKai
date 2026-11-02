# Editor UI smoke check

Run on 2026-11-02 in the in-app browser against `projects/demo` (12 s cut of the m1 demo, style m1, 720x1280), via `npm run editor -- projects/demo`. Interactions were driven with synthetic pointer/keyboard events from the page.

| Check | Result |
|---|---|
| Plan loads, layer list, five timeline rows and scene row render | pass |
| Base video loads (`readyState` 4, 720 wide, duration 12.07 s) | pass |
| Drag a title block by +90 px (1 s at 90 px/s): start 0.50 → 1.50, history 1 step, layer locked, Save enabled | pass |
| Save writes `plan.json` (`t1` start 1.5, `locked: true`), Save disabled afterwards | pass |
| Undo restores start 0.50, history 0 steps, still marked unsaved | pass |
| External write to `plan.json` while dirty: banner with "Giữ bản của tôi" / "Tải bản trên đĩa" | pass |
| "Tải bản trên đĩa" loads the disk version (new title shown), dirty cleared | pass |
| Pick a layer in the list: playhead seeks, preview shows caption and title card with the new title | pass |
| Saving an invalid plan shows the server's issues and leaves the file unchanged | not driven from the UI; covered by `tests/editor/server.test.ts` ("PUT rejects an invalid plan with 422"). Note: the reducer keeps edits schema-valid but can still create same-track overlaps or layers past the end; after Save the editor now calls `/api/validate` and shows those issues (fix added after the final review, checked by `tsc` and the server test only, not re-driven in the browser) |

Not checked: visual fidelity of screenshots (the pane clipped screenshots, so the DOM was inspected instead), Render button end to end (covered by `tests/editor/render-endpoint.test.ts` and `tests/stages/render.test.ts`), keyboard shortcuts.
