# ETS100 Desk

Windows desktop client for ETS100 account login, homework review, paper parsing,
per-question recording/XML attachment, OSS upload, and business synchronization.

## Requirements

- Windows 10/11
- Node.js 22 or newer
- pnpm
- FFmpeg with `libspeex` support

## Development

```powershell
pnpm install
pnpm dev
```

## Verification

```powershell
pnpm typecheck
pnpm test:run
pnpm build
```

## Packaging

```powershell
pnpm dist
```

The NSIS installer and portable executable are written to `release/`.

## Security

- The application never stores the account password.
- Session data is encrypted with Electron `safeStorage`.
- The renderer has no direct Node.js or filesystem access.
- Real evaluation submission is disabled by default.
