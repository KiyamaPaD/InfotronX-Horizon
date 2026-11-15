# Cookies and local storage

*Last updated: 15 November 2026.*

## Short version

Mars Atlas **does not set cookies** and does not use advertising or analytics trackers. It keeps a few choices in your browser's **local storage**, which is needed for the site to remember your layout and, for signed-in users, an offline copy of their missions. Because this is strictly necessary and does not track you, we do not show a cookie banner.

## What is stored

| Key | What it keeps | Why |
| --- | --- | --- |
| `mars-atlas.missions.v1` | A copy of the signed-in user's missions, tagged with their account. Removed when they sign out. Guests never get this | Offline copy for a signed-in user |
| `mars-guest-session` (session storage) | That you chose to continue as a guest | Do not ask again until you close the tab |
| `mars-prefs` | Which blocks you folded or opened, and where | Remember your layout |
| `mars-line-style` | Your line thickness, colour style and marker size | Remember your map look |
| `mars-perf` | Your graphics choice (automatic, lighter or full) | Keep the 3D view smooth on your computer |
| `mars-quick-waypoint` | Whether to ask for details when you add a waypoint | Respect your choice |
| `mars-qa-checklist` | Ticks on the test checklist page | Let testers keep their progress |
| `mars-atlas.workflow-step` | The last step you used (Explore, Plan, Analyze, All tools) | Return to where you were |
| `mars-panel-left`, `mars-panel-right` | Whether a side panel is hidden | Remember your layout |
| `mars-tutorial-seen` | That you have seen the tour | Do not repeat it |
| `mars-home-skip` | Your choice to skip the welcome screen | Respect your choice |
| Supabase session (starts with `sb-`) | Your sign-in session, only if you sign in | Keep you signed in |

None of these are sent to us unless you sign in and save a mission to the cloud.

## Other services you contact

Loading the site also contacts NASA Mars Trek (map tiles), the NASA Image and Video Library (photos of places on Mars, only when you open a place in the 3D view), Google Fonts, jsDelivr and esm.sh. They may log your IP address. See the [Privacy Policy](PRIVACY.md).

## Control

You can clear these any time in your browser (site data / local storage). Clearing deletes missions that were saved only on this device, so export a backup first from Mission Center.

If we ever add analytics or other optional storage, we will ask for your consent first and list it here.
