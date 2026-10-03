# House style

What every tutorialize video follows, and why. Drawn from screencast research: one outcome per video, 1–3 minutes preferred by learners, zoom only when it helps, and script-driven demos that can be re-recorded.

1. **One task per video**, 60–120 s, 180 s at most. A second task gets its own video, and the end card can point to it.
2. **Steps in the exact order the viewer will do them.** No detours, no feature tours.
3. **Navigate like a user**: reach the page by clicking the app's own menus, never by jumping to a URL mid-video. Sign-in happens off camera in `setup`.
4. **Human cursor**: it glides along a gentle curve to each target, with a ripple on every click.
5. **Calm pacing**: about 1–1.5 s between actions and a hold after each visible result. A step stays on screen until its narration would end (3 words per second).
6. **One caption per step**: imperative and short ("Click Save note"), 6 words or fewer, with a "Step n of N" badge. Use the app's real labels.
7. **Narration** of 30 words or fewer per step adds to the screen rather than reading it out. Without a voice it still sets the timing.
8. **Zoom with purpose**: on the main buttons that open or commit something, on toasts, and on the final proof. Never on navigation (menus, tabs, search). Forms stay zoomed while the camera glides between fields, zoom out after the last field, then zoom in on the submit button. Zooms are capped at 1.6×, eased, kept inside the frame and clear of the caption bar.
9. **End on proof**: the result that shows the task worked, held zoomed to the end, then an end card recapping it. Name a next task only when there genuinely is one.
10. **Demo data only.** Mocks or a seeded local backend; never a real account.

The lint (`cli.ts lint`) checks rules 1 (estimated length), 6, 7 and 9. If it fails, shorten the text. Never relax the rule.
