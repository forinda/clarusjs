---
title: "File upload"
group: "Form"
order: 13
description: "Pick or drop files: a list with image previews and remove buttons, checked by type, size and count."
---

# File upload

<p class="lead">Pick or drop files: a list with image previews and remove buttons, checked by type, size and count.</p>

<fileUploadDemo />

## Usage

A real `<input type="file">` sits behind the drop zone, so without JavaScript it still picks files and sends them with its form (`enctype="multipart/form-data"`). The island keeps that input's files equal to the list, so the form sends exactly what's shown, and `(change)` gives you the `File[]` after each change, to upload them yourself.

<<< ../../registry/file-upload-demo.tscl

## Examples

### Images, with limits

`accept="image/*"`, `maxSize` (bytes) and `maxFiles`: a file that doesn't fit is refused, and an alert says why.

<fileUploadImagesDemo />

<<< ../../registry/file-upload-images-demo.tscl

### One file

`[multiple]="false"`: a new pick replaces the last.

<fileUploadSingleDemo />

<<< ../../registry/file-upload-single-demo.tscl

## Source

Copy it into `src/components/ui/` as `file-upload.tscl`.

<sourceFlavor name="file-upload">

<<< ../../registry/file-upload.tscl

<<< ../../registry/file-upload.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `file-upload`, `file-drop`, `file-label`, `file-hint`, `file-input`, `file-error`, `file-list`, `file-item`, `file-preview`, `file-name`, `file-size` and `file-remove`; state attribute `data-dragging` while files are dragged over it.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="file-upload" />
