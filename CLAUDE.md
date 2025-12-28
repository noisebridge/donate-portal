# Project Goal

This site is a basic donation portal for the Noisebridge hackerspace.

# Scripts

* `bun run dev` - Start dev server
* `bun run lint:fix` - Lint and automatically apply fixes
* `bun run check` - Run TypeScript compiler
* `bun run test` - Run unit tests
* `bun run test:e2e` - Run integration tests

# Database

This site does not have its own database. All persistence comes from Stripe. You
can access a `Stripe` instance as the default export of `src/services/stripe.tsx`.

# Auth

All auth is performed with either OAuth or Magic Links. Auth state is maintained
with signed keys using the `@fastify/cookie` package. All auth must be done
without requiring any server-side data storage beyond what information Stripe
can hold.

# Project Configuration

## Runtime & Package Manager

- **Use Bun instead of Node.js** for all runtime operations
- Invoke Bun using the full path: `~/.bun/bin/bun`
- Use `~/.bun/bin/bun` for running scripts, installing packages, and executing commands

### Quick Reference

| Task | Command |
|------|---------|
| Run a script | `~/.bun/bin/bun run <script>` |
| Install packages | `~/.bun/bin/bun install` |
| Add a package | `~/.bun/bin/bun add <package>` |
| Dev server | `~/.bun/bin/bun run dev` |


## Server-side processing

Perform server-side processing for routes `src/routes.tsx`.
Only perform request and response processing in `src/routes.tsx`. Delegate
more complex business logic to other modules such as:

* Service modules: `src/services/**/*.ts` - API clients
* Manager modules: `src/managers/**/*.ts` - Business logic containers

## Views & Templating

- Use **@kitajs/html** for JSX-based page design (not React)
- Place all page components in `src/views/`
- Place components that are not top-level pages in `src/components`
- All pages are **server-side rendered (SSR)**
- Wrap page contents with the `Layout` higher-order component for the default layout

Example page structure:
```tsx
// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import { Layout } from '~/components/layout'

export function HomePage() {
  return (
    <Layout>
      <h1>Welcome</h1>
      <p>Page content here</p>
    </Layout>
  )
}
```

## Client-Side JavaScript

- Put page-specific JS in `src/assets/js/{page}.mjs`
- You can build JS modules to be shared across pages in `src/assets/js/`
- **Always include `// @ts-check` at the top of every `.mjs` file**
- Use **JSDoc comments** for all type annotations
- Do not use TypeScript for client-side code; use typed JavaScript instead

Example client-side file:
```javascript
// @ts-check

/**
 * @param {string} message
 * @returns {void}
 */
function showAlert(message) {
  alert(message)
}
```

## CSS

Put global styles in `src/assets/css/main.css`

Put page-specific styles in `src/assets/css/{page}.css`
