# donate.noisebridge.net

Donation portal for Noisebridge hackerspace.

![Screenshot](screenshot.png)

## Setup

### Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

### Install dependencies

```bash
bun install
```

## Development

### Set up environment variables

* `SERVER_HOST` - `127.0.0.1:3000` for local dev
* `STRIPE_SECRET` - Get a Stripe test key for local dev
* `GITHUB_CLIENT_ID` - Create an OAuth app on Github
* `GITHUB_SECRET` - Create an OAuth app on  Github
* `GOOGLE_CLIENT_ID` - Create an OAuth app in the Google Cloud Console
* `GOOGLE_SECRET` - Create an OAuth app in the Google Cloud Console
* `RESEND_KEY` - From https://resend.com
* `COOKIE_SECRET` - Randomly generated string
* `TOTP_SECRET` - Randomly generated string

### Run!

```bash
bun run dev
```

### Test!

```bash
bun test
```

### Format & Lint!

```bash
bun run lint:fix
```

## License

AGPLv3
