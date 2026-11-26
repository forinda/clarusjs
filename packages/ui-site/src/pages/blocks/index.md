---
title: "Blocks"
group: "Blocks"
order: 1
description: "Whole pages built from the components: copy one into your app and it works."
layout: "/src/layouts/wide.tscl"
---

# Blocks

<p class="lead">Whole pages built from the components: a login, a checkout, a dashboard, a calendar. Copy one into <code>src/pages/</code>, the components it lists into <code>src/components/ui/</code>, and it looks done and works. Then swap in your data and your submit. They style themselves with your <code>theme.css</code>, so a theme from the header's Theme button restyles them too.</p>

<blockFilter>

<blockRow name="login">
  <iframe src="/view/login" title="Login preview" loading="lazy" style="width: 100%; height: 560px; border: 1px solid var(--rule); border-radius: 12px"></iframe>
</blockRow>

<blockRow name="checkout">
  <iframe src="/view/checkout" title="Checkout preview" loading="lazy" style="width: 100%; height: 760px; border: 1px solid var(--rule); border-radius: 12px"></iframe>
</blockRow>

<blockRow name="dashboard">
  <iframe src="/view/dashboard" title="Dashboard preview" loading="lazy" style="width: 100%; height: 820px; border: 1px solid var(--rule); border-radius: 12px"></iframe>
</blockRow>

<blockRow name="calendar-app">
  <iframe src="/view/calendar-app" title="Calendar preview" loading="lazy" style="width: 100%; height: 900px; border: 1px solid var(--rule); border-radius: 12px"></iframe>
</blockRow>

</blockFilter>
