---
title: "Calendar"
group: "Blocks"
order: 40
description: "Month, week and day views of your events, with a mini calendar, category filters, and a dialog to add, edit and delete them."
layout: "/src/layouts/wide.tscl"
---

# Calendar

<blockView name="calendar-app">

<iframe src="/view/calendar-app" title="Calendar preview" loading="lazy" style="height: 980px"></iframe>

<<< ../../registry/blocks/calendar-app/calendar-app.tscl

<<< ../../registry/blocks/calendar-app/calendar-board.tscl

<<< ../../registry/blocks/calendar-app/data.ts

<<< ../../registry/calendar.tscl

<<< ../../registry/calendar-dates.ts

<<< ../../registry/dialog.css

</blockView>

## Use it

Copy `calendar-app.tscl` into `src/pages/` (as `calendar.tscl`), `calendar-board.tscl` and `data.ts` beside it, and the components under Code into `src/components/ui/`. Replace `sampleEvents` in `data.ts` with your events (load them in the page, or fetch them), and save what the dialog changes where you keep them. The views:

- **Month:** each day's events (all-day ones filled), "+N more" opens a busy day; a day's empty space adds an event on it.
- **Week and Day:** a 24-hour grid that opens on the morning; events that overlap sit side by side; a click on empty time adds an event at that hour.
- **The dialog** is a native `<dialog>` with a plain form: a title, a date, all day or a start and end, and a category; it says what's missing, and Delete is there when editing.
- **Today** is the visitor's: the board moves there once it's live. The categories beside it show or hide theirs.

<needs name="calendar-app" />
