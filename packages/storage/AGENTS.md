# Storage Package

This package owns server-side object storage access for TaleLabs.

## Rules

- Keep R2/S3 credentials server-side. Never import this package directly into browser-only dashboard code.
- Use the wrapper exports instead of importing AWS SDK commands from app code. App code should call `createUploadUrl`, `createDownloadUrl`, `deleteObject`, and `copyObject`.
- Keep object keys tenant-safe. Organization-owned objects should include the `organizationId` in their key prefix to avoid cross-organization collisions.
- Keep provider-specific details in this package so moving from Cloudflare R2 to S3, Tigris, or another S3-compatible provider only changes this package.
- Do not commit ad hoc upload test scripts or temporary files.

## Checks

Before finishing changes here, run:

```bash
npm run check-types -w @talelabs/storage
npm run build -w @talelabs/storage
```
