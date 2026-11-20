# Security policy

## Supported versions

clarusjs is in early development (proof of concept). Security fixes go into the latest release only.

| Version | Supported |
|---|---|
| latest `0.x` | yes |
| older | no |

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately through GitHub: open the repository's **Security** tab and choose
**[Report a vulnerability](https://github.com/forinda/clarusjs/security/advisories/new)**. Include:

- what the problem is and what an attacker could do with it;
- the clarusjs version (or commit) and your Node, Vite and browser versions;
- a minimal `.clarus` file, page or steps that reproduce it.

You can expect an acknowledgement within a few days and an assessment within two weeks. When a fix is ready, we
publish it with a GitHub security advisory and credit you, unless you'd rather stay anonymous.

## What counts

clarusjs compiles templates into code that runs on your server and in your users' browsers, so these matter most:

- **Escaping:** user data rendered as markup instead of text (in a `{{ }}` hole, an attribute, or island props).
- **Code injection:** template or script content that makes the compiler emit code the author didn't write.
- **Server/client boundary:** server-only code, loaders or data ending up in client bundles.
- **Server handler:** request handling that leaks data between requests or crashes on crafted input.

Bugs in an application built with clarusjs are that application's responsibility, unless clarusjs caused them.
The development server (`pnpm dev`, the Vite dev middleware) is not meant to face the internet and is out of scope.
