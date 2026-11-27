---
title: "Chat composer"
group: "Blocks"
order: 50
description: "Messages and a box to write them: Enter sends, @ mentions, / commands, : emoji, files, a limit."
layout: "/src/layouts/wide.tscl"
---

# Chat composer

<blockView name="chat-composer">

<iframe src="/view/chat-composer" title="Chat composer preview" loading="lazy" style="height: 560px"></iframe>

<<< ../../registry/blocks/chat-composer/chat-composer.tscl

<<< ../../registry/editor.css

</blockView>

## Use it

Copy `chat-composer.tscl` into `src/components/` and `editor.css` into `src/components/ui/`, and install `@clarusjs/editor`. Replace `post` (where a message goes), `find` (who `@` finds: answer `(search)` from your API with `$event.respond(promise)`, using `$event.signal` to cancel), the commands and `upload` with your own. It's made of the editor's parts, so change what you like: drop the toolbar, move the count, add a part of your own. Check what's sent on the server with `validate()` from `@clarusjs/editor/server` before you store it.

<needs name="chat-composer" />
