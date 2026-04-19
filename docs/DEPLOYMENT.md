# TIP Generator - Deployment Guide

**Last Updated:** 2026-04-19  
**Status:** Infrastructure Ready - Phase 1 Development

---

## Infrastructure Overview

### Blue-Green Deployment

**BLUE Node (CT190)**
- **Hostname:** tip-blue
- **IP Address:** 10.92.3.24
- **Resources:** 4GB RAM, 2 cores, 50GB disk
- **Path:** /opt/tip-generator
- **Access:** `ssh root@10.92.3.90`

**GREEN Node (CT191)**
- **Hostname:** tip-green
- **IP Address:** 10.92.3.91
- **Resources:** 4GB RAM, 2 cores, 50GB disk
- **Path:** /opt/tip-generator
- **Access:** `ssh root@10.92.3.91`

### Network & Routing

**HAProxy Configuration:**
- **VIP:** 10.92.3.33 (managed by CT136/CT139)
- **Backend:** `tip_blue` and `tip_green`
- **Health Check:** GET /health (expects 200)
- **Domains:**
  - Production: https://tip.cloudigan.net
  - Blue Direct: http://blue-tip.cloudigan.net
  - Green Direct: http://green-tip.cloudigan.net

**NPM Reverse Proxy:**
- Forwards tip.cloudigan.net → HAProxy VIP (10.92.3.33:8000)

**Internal DNS:**
- tip-blue.cloudigan.net → 10.92.3.90
- tip-green.cloudigan.net → 10.92.3.91
- tip.cloudigan.net → 10.92.3.3 (NPM)

### Database

**PostgreSQL (Shared HA Cluster):**
- **Primary:** CT131 @ 10.92.3.21:5432
- **Standby:** CT151 @ 10.92.3.31:5432
- **Database:** `tip_generator`
- **User:** `tip_user`
- **Password:** `TipGen2026!Secure`
- **Connection String:**
  ```
  postgresql://tip_user:TipGen2026!Secure@10.92.3.21:5432/tip_generator
  ```

### Authentication

**Authentik OAuth2/OIDC:**
- **Provider ID:** 4
- **Application ID:** f1e56917-7cca-4b00-8e06-d6225815b56f
- **Client ID:** `MFO9C9ynlvpoX895YRSutwCl7xBouyAy4oOjNmI9`
- **Client Secret:** `tfCdQRgZHcIeE1bMCpioR2Beb1p3PuwmnZcPNZZqc3JGdAHRCXG4F0rk3ndP6nrGKJMF9lY92GW0gOW2i6laGMwXEfmdOIHtzWXWJWmEeBUeDOTzFaspAPSo03nVTA5A`
- **Issuer:** `https://auth.cloudigan.net/application/o/tip-generator/`
- **Redirect URIs:**
  - `https://tip.cloudigan.net/auth/callback` (production)
  - `http://10.92.3.90:8000/auth/callback` (BLUE direct)
  - `http://10.92.3.91:8000/auth/callback` (GREEN direct)

### Monitoring & Backups

**Monitoring:**
- node_exporter: Port 9100 (Prometheus scraping)
- promtail: Log shipping to Loki (10.92.3.2:3100)
- Uptime Kuma: Health monitoring
- Grafana: Dashboards and alerts

**Backups:**
- **Tier:** 1 (Critical Production)
- **Schedule:** Daily at 2:00 AM
- **Storage:** truenas-backups (TrueNAS NFS)
- **Retention:** 7 daily, 4 weekly, 3 monthly
- **Compression:** zstd
- **Mode:** snapshot

---

## MCP Deployment Tools

The TIP Generator is integrated with the homelab-blue-green-deployment MCP server.

### Available Commands

**Check Deployment Status:**
```
mcp0_get_deployment_status tip-generator
```
Returns: LIVE/STANDBY status, container health, last switch time

**Deploy to STANDBY:**
```
mcp0_deploy_to_standby tip-generator
```
- Pulls latest code from GitHub
- Runs npm install / pip install
- Restarts PM2 process
- Performs health checks
- Optional: Creates backup, runs migrations

**Switch Traffic:**
```
mcp0_switch_traffic tip-generator
```
- Validates STANDBY health
- Updates HAProxy configuration
- Switches LIVE ↔ STANDBY
- Requires approval (unless emergency mode)

---

## Manual Deployment Process

### Initial Setup (First Time)

**1. Prepare Container:**
```bash
# SSH to container
ssh root@10.92.3.90  # or 10.92.3.91

# Install system dependencies
apt-get update
apt-get install -y python3.11 python3.11-venv python3-pip nodejs npm git

# Create application directory
mkdir -p /opt/tip-generator
cd /opt/tip-generator

# Clone repository
git clone git@github.com:heybearc/tip-generator.git .
git submodule update --init --recursive
```

**2. Backend Setup:**
```bash
cd /opt/tip-generator/backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << 'EOF'
DATABASE_URL=postgresql://tip_user:TipGen2026!Secure@10.92.3.21:5432/tip_generator
AUTHENTIK_CLIENT_ID=MFO9C9ynlvpoX895YRSutwCl7xBouyAy4oOjNmI9
AUTHENTIK_CLIENT_SECRET=tfCdQRgZHcIeE1bMCpioR2Beb1p3PuwmnZcPNZZqc3JGdAHRCXG4F0rk3ndP6nrGKJMF9lY92GW0gOW2i6laGMwXEfmdOIHtzWXWJWmEeBUeDOTzFaspAPSo03nVTA5A
AUTHENTIK_DOMAIN=auth.cloudigan.net
AUTHENTIK_ISSUER=https://auth.cloudigan.net/application/o/tip-generator/
AUTHENTIK_REDIRECT_URI=https://tip.cloudigan.net/auth/callback
ANTHROPIC_API_KEY=your_claude_api_key_here
STORAGE_PATH=/data/tip-generator
TEMPLATE_PATH=/data/tip-generator/templates/active-template.docx
SESSION_SECRET=$(openssl rand -hex 32)
ALLOWED_ORIGINS=https://tip.cloudigan.net
PORT=8000
NODE_ENV=production
EOF

# Create data directories
mkdir -p /data/tip-generator/{templates,projects,cache}
```

**3. Frontend Setup:**
```bash
cd /opt/tip-generator/frontend

# Install dependencies
npm install

# Build for production
npm run build
```

**4. PM2 Process Management:**
```bash
# Install PM2 globally
npm install -g pm2

# Start backend
cd /opt/tip-generator/backend
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name tip-generator

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup
```

### Deployment Updates

**Using MCP (Recommended):**
```
mcp0_deploy_to_standby tip-generator
```

**Manual Update:**
```bash
# SSH to STANDBY container
ssh root@<standby-ip>

# Pull latest code
cd /opt/tip-generator
git pull origin main
git submodule update --recursive

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Update frontend
cd ../frontend
npm install
npm run build

# Restart PM2
pm2 restart tip-generator

# Verify health
curl http://localhost:8000/health
```

### Traffic Switching

**Using MCP (Recommended):**
```
mcp0_switch_traffic tip-generator
```

**Manual HAProxy Update:**
```bash
# SSH to HAProxy master
ssh root@10.92.3.26

# Edit HAProxy config
vi /etc/haproxy/haproxy.cfg

# Find tip backend section and swap blue/green
# Change: use_backend tip_blue if is_tip
# To:     use_backend tip_green if is_tip

# Validate config
haproxy -c -f /etc/haproxy/haproxy.cfg

# Reload HAProxy
systemctl reload haproxy

# Sync to standby HAProxy
scp /etc/haproxy/haproxy.cfg root@10.92.3.32:/etc/haproxy/
ssh root@10.92.3.32 "systemctl reload haproxy"
```

---

## Environment Variables

See `.env.example` for all required variables.

**Critical Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `AUTHENTIK_CLIENT_ID` - OAuth client ID
- `AUTHENTIK_CLIENT_SECRET` - OAuth client secret
- `ANTHROPIC_API_KEY` - Claude API key
- `SESSION_SECRET` - Random secret for session encryption

**Optional Variables:**
- `ALLOWED_ORIGINS` - CORS origins (comma-separated)
- `STORAGE_PATH` - File storage location
- `TEMPLATE_PATH` - Word template location

---

## Health Checks

**Endpoint:** `GET /health`

**Expected Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "storage": "accessible",
  "version": "1.0.0"
}
```

**Health Check Locations:**
- HAProxy: Checks every 5 seconds
- Uptime Kuma: Checks every 60 seconds
- Prometheus: Scrapes metrics every 15 seconds

---

## Troubleshooting

### Container Not Responding

```bash
# Check PM2 status
ssh root@<container-ip>
pm2 status

# View logs
pm2 logs tip-generator

# Restart process
pm2 restart tip-generator
```

### Database Connection Issues

```bash
# Test database connectivity
psql -h 10.92.3.21 -U tip_user -d tip_generator

# Check PostgreSQL status
ssh root@10.92.3.21
systemctl status postgresql
```

### OAuth Authentication Failing

```bash
# Verify Authentik is running
curl https://auth.cloudigan.net/application/o/tip-generator/.well-known/openid-configuration

# Check redirect URIs match
# Verify client credentials in .env
```

### File Upload Issues

```bash
# Check storage permissions
ls -la /data/tip-generator/

# Ensure directories exist
mkdir -p /data/tip-generator/{templates,projects,cache}
chown -R root:root /data/tip-generator
chmod -R 755 /data/tip-generator
```

---

## Rollback Procedure

**If deployment fails:**

1. **Immediate:** Traffic is still on LIVE (old version)
2. **Fix STANDBY:** Debug and fix issues on STANDBY container
3. **Re-deploy:** Use MCP or manual process to update STANDBY
4. **Verify:** Test STANDBY thoroughly before switching

**If traffic was switched and issues found:**

1. **Emergency Rollback:**
   ```
   mcp0_switch_traffic tip-generator --emergency
   ```
   
2. **Manual Rollback:**
   ```bash
   # Switch HAProxy back to previous LIVE
   ssh root@10.92.3.26
   vi /etc/haproxy/haproxy.cfg
   # Revert backend change
   systemctl reload haproxy
   ```

---

## Related Documentation

- **Architecture Plan:** `docs/ARCHITECTURE.md`
- **Infrastructure Details:** `homelab-nexus/documentation/TIP-GENERATOR-DEPLOYMENT.md`
- **Decisions:** D-036 (phased rollout), D-037 (template management)
- **MCP Server:** `Cloudy-Work/shared/mcp-servers/homelab-blue-green-mcp/`

---

**For questions or issues, refer to the homelab-nexus repository or Master Control documentation.**
