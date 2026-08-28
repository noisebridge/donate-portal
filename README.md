# donate.noisebridge.net

Donation portal for Noisebridge hackerspace.

![Screenshot](screenshot.png)

## Setup

### Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

### Install `watchexec`

**macOS:**

```bash
brew install watchexec
```

**Linux:**

```bash
# Arch
pacman -S watchexec

# Debian/Ubuntu/Fedora — download binary from GitHub releases
curl -fsSL https://github.com/watchexec/watchexec/releases/latest/download/watchexec-*-x86_64-unknown-linux-gnu.tar.xz \
  | tar -xJ --strip-components=1 -C /usr/local/bin/

# Or via cargo
cargo install watchexec-cli
```

### Install dependencies

```bash
bun install
bunx playwright install firefox
```

### Set up `.env` file

Create a `.env` file in the root of the repository with the following variables:

| Variable | Required | Description |
|---|---|---|
| `SERVER_HOST` | Yes | `127.0.0.1:3000` for local dev |
| `STRIPE_PUBLIC` | Yes | Stripe publishable key |
| `STRIPE_SECRET` | Yes | Stripe secret key (use test key for local dev) |
| `STRIPE_PORTAL_CONFIG` | Yes | ID like `bpc_...` from `./scripts/stripe-setup.ts` |
| `GITHUB_CLIENT_ID` | Yes | Create an OAuth app on GitHub |
| `GITHUB_SECRET` | Yes | Create an OAuth app on GitHub |
| `GOOGLE_CLIENT_ID` | Yes | Create an OAuth app in the Google Cloud Console |
| `GOOGLE_SECRET` | Yes | Create an OAuth app in the Google Cloud Console |
| `KEYCLOAK_ISSUER` | Yes | Keycloak issuer URL |
| `KEYCLOAK_CLIENT_ID` | Yes | Keycloak client ID |
| `KEYCLOAK_SECRET` | Yes | Keycloak client secret |
| `COOKIE_SECRET` | Yes | Randomly generated string |
| `RESEND_KEY` | Yes | From https://resend.com |
| `TOTP_SECRET` | Yes | Randomly generated string |
| `ALERTS_USERNAME` | Yes | HTTP basic auth username for alerts endpoint |
| `ALERTS_PASSWORD` | Yes | HTTP basic auth password for alerts endpoint |
| `FRONTEND_DSN` | Yes | Sentry DSN for frontend error tracking |
| `BACKEND_DSN` | Yes | Sentry DSN for backend error tracking |
| `DISABLE_RATE_LIMIT` | No | `true` for local dev and e2e tests |
| `STRIPE_WEBHOOK_SECRET` | No | Get from `stripe listen --forward-to localhost:3000/webhook` |
| `EMAIL_SENDER` | No | Where to send emails from (defaults to `onboarding@resend.dev`) |
| `TRUSTED_PROXIES` | No | Comma-separated IPs/CIDRs of trusted proxies (defaults to `loopback,linklocal,uniquelocal`) |
| `RATE_LIMIT_ALLOW_LIST` | No | JSON array of IPs exempt from rate limiting |
| `NODE_ENV` | No | Set to `production` in production |
| `PORT` | No | Port number (defaults to `3000`) |
| `REPO_SLUG` | No | GitHub repo slug for commit links |
| `GIT_COMMIT` | No | Deployed commit SHA |

### Run setup script

```shell
bun run stripe-setup
```

## Development

### Run!

```bash
bun run dev
```

### Test!

```bash
bun run test
bun run test:e2e
```

### Format & Lint!

```bash
bun run lint:fix
```

## License

AGPLv3
