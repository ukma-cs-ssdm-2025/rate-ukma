# Azure OAuth Key Rotation

Runbook for rotating Microsoft Azure OAuth client credentials used for user authentication (Microsoft login).

## When to Use

- Azure client secret is expiring or has expired
- Auth errors in backend logs: `AADSTS7000222` (expired client secret) or `invalid_client`
- Users unable to log in via Microsoft

## Prerequisites

- Access to [Azure Portal](https://portal.azure.com) (App registrations)
- SSH access to the target server (`rate-ukma-staging` or `rate-ukma-live`)

## Steps

### 1. Create New App Registration in Azure Portal

1. Go to **Azure Portal > App registrations > New registration**
2. Name the app (e.g., `Rate UKMA Staging (DD.MM.YYYY)` or `Rate UKMA Live (DD.MM.YYYY)`)
3. Under **Supported account types**, select **Accounts in any organizational directory (Multitenant)**
4. Under **Redirect URI**, add:
   - Staging: `https://staging.rateukma.com/accounts/microsoft/login/callback/`
   - Live: `https://rateukma.com/accounts/microsoft/login/callback/`
5. Click **Register**

> **If multi-tenant selection is not available during registration**, you can set it after via the app Manifest (see Troubleshooting below).

### 2. Create Client Secret

1. Go to the newly created app > **Certificates & secrets**
2. Click **New client secret**, set a description and expiry
3. **Copy the secret value immediately** (it won't be shown again)
4. Note down the **Application (client) ID** from the app's Overview page

### 3. Configure Manifest (if needed)

If the app was created as single-tenant (`AzureADMyOrg`), update the manifest:

1. Go to the app > **Manifest**
2. Set `"accessTokenAcceptedVersion": 2`
3. Set `"signInAudience": "AzureADMultipleOrgs"`
4. Save

> If saving both at once fails, save `accessTokenAcceptedVersion` first, then change `signInAudience`.

### 4. Update Server Environment

The master `.env` file lives at `/opt/rateukma/.env` on each server. The deploy script copies it to `/opt/rateukma/src/.env` on each deploy (see `scripts/ci/deploy.sh`, line 88).

Update **both** files to avoid issues before the next deploy:

```bash
ssh <server>  # rate-ukma-staging or rate-ukma-live

# Edit the master env file
nano /opt/rateukma/.env

# Update:
# MICROSOFT_CLIENT_ID=<new-client-id>
# MICROSOFT_CLIENT_SECRET=<new-secret-value>

# Copy to the active env file
cp /opt/rateukma/.env /opt/rateukma/src/.env
```

### 5. Recreate the Backend Container

A simple `docker compose restart` reuses the old container config and will **not** pick up new env vars. You must recreate:

```bash
cd /opt/rateukma/src
docker compose --profile prod up -d --force-recreate backend
```

### 6. Verify

```bash
# Confirm new values are loaded
docker inspect $(docker ps -q -f name=backend) --format '{{range .Config.Env}}{{println .}}{{end}}' | grep MICROSOFT

# Watch logs during a login attempt
docker logs -f $(docker ps -q -f name=backend) 2>&1 | grep -i "microsoft\|auth\|error"
```

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `AADSTS7000222` | Client secret expired | Rotate keys (this runbook) |
| `AADSTS50194` | App not configured as multi-tenant, but `TENANT_ID=common` | Set `signInAudience` to `AzureADMultipleOrgs` in manifest |
| `invalid_client` after deploy | Container still using old env | `--force-recreate`, not just `restart` |
| Env vars unchanged after `docker compose restart` | `restart` reuses existing container config | Must use `up -d --force-recreate` |

## Important Notes

- **Secrets are NOT managed via GitHub Actions.** They live directly on the server in `/opt/rateukma/.env`. Updating GitHub secrets/variables has no effect on these values.
- The deploy pipeline (`scripts/ci/deploy.sh`) copies `/opt/rateukma/.env` to `/opt/rateukma/src/.env` during each deploy, so the master file persists across deployments.
- If the server is reprovisioned, the `.env` file must be manually recreated.
