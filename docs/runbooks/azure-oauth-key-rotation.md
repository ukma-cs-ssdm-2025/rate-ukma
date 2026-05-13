# Azure OAuth Key Rotation

Runbook for rotating Microsoft Azure OAuth client credentials used for user authentication (Microsoft login).

## When to Use

- Azure client secret is expiring or has expired
- Auth errors in backend logs: `AADSTS7000222` (expired client secret) or `invalid_client`
- Users unable to log in via Microsoft

## Prerequisites

- Access to [Azure Portal](https://portal.azure.com) (App registrations)
- SSH access to the target server (`rate-ukma-staging` or `rate-ukma-live`)

## Current App Registrations

| Environment | App Name | Application (client) ID |
|-------------|----------|------------------------|
| Live | `rate-ukma` | `13640e87-8aa9-4124-b984-3e3cfeb6310b` |
| Staging | `Rate UKMA Staging (14.04.2026)` | `819a55dd-5c56-4dad-bb32-ed1a710d9b21` |

All team members are added as **owners** on both app registrations, so anyone on the team can rotate secrets without creating a new app.

## Steps

### Option A: Rotate Secret on Existing App (preferred)

Use this when the app registration already exists and is properly configured. This only requires updating the client secret — the client ID stays the same.

1. Go to **Azure Portal > App registrations > Owned applications**
2. Select the app for the target environment (see table above)
3. Go to **Certificates & secrets**
4. Click **New client secret**, set a description and expiry
5. **Copy the secret value immediately** (it won't be shown again)
6. Optionally delete the old expired secret
7. Proceed to [Step: Update Server Environment](#update-server-environment)

> With this approach, only `MICROSOFT_CLIENT_SECRET` needs updating on the server. `MICROSOFT_CLIENT_ID` remains unchanged.

### Option B: Create New App Registration (only if needed)

Use this only if the existing app registration is compromised, deleted, or needs to be replaced for another reason.

1. Go to **Azure Portal > App registrations > New registration**
2. Name the app (e.g., `Rate UKMA Staging (DD.MM.YYYY)` or `Rate UKMA Live (DD.MM.YYYY)`)
3. Under **Supported account types**, select **Accounts in any organizational directory (Multitenant)**
4. Under **Redirect URI**, add:
   - Staging: `https://staging.rateukma.com/accounts/microsoft/login/callback/`
   - Live: `https://rateukma.com/accounts/microsoft/login/callback/`
5. Click **Register**
6. **Add all team members as owners** (App registration > Owners > Add owners)
7. Create a client secret (Certificates & secrets > New client secret)
8. **Copy the secret value immediately** (it won't be shown again)

> **If multi-tenant selection is not available during registration**, update the app Manifest:
> 1. Set `"accessTokenAcceptedVersion": 2`
> 2. Set `"signInAudience": "AzureADMultipleOrgs"`
> 3. Save (if saving both at once fails, save `accessTokenAcceptedVersion` first, then change `signInAudience`)

With this approach, both `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` need updating on the server. Update this runbook's app registration table as well.

### Update Server Environment

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

### Recreate the Backend Container

A simple `docker compose restart` reuses the old container config and will **not** pick up new env vars. You must recreate:

```bash
cd /opt/rateukma/src
docker compose --profile prod up -d --force-recreate backend
```

### Verify

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
