---
title: "Comment box"
group: "Blocks"
order: 51
description: "Write or preview a comment, with Markdown shortcuts and mentions; Comment posts it, Cancel clears it."
layout: "/src/layouts/wide.tscl"
---

# Comment box

<blockView name="comment-box">

<iframe src="/view/comment-box" title="Comment box preview" loading="lazy" style="height: 600px"></iframe>

<<< ../../registry/blocks/comment-box/comment-box.tscl

<<< ../../registry/editor.css

</blockView>

## Use it

Copy `comment-box.tscl` into `src/components/` and `editor.css` into `src/components/ui/`, and install `@clarusjs/editor`. Replace `post` and `find` with your own. Here Enter is a new line (`[enterSends]="false"`) and Ctrl/⌘+Enter, or Comment, posts. Preview shows the draft as it will look, through the `content` behaviour. Check what's sent on the server with `validate()` from `@clarusjs/editor/server` before you store it.

<needs name="comment-box" />
