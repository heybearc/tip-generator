## Infrastructure: Register TIP Generator in Blue-Green Deployment MCP Server
**Type:** infrastructure
**Target:** _cloudy-ops/docs/infrastructure/
**Affects:** tip-generator
**Date:** 2026-04-20

**Context:** TIP Generator (CT190/CT191) is a blue-green app but is not yet registered in the homelab-blue-green-deployment MCP server. Currently deploying via direct SSH + deploy.sh as a workaround. All other blue-green apps (theoshift, ldc-tools, quantshift, leadiq, bni-chapter-toolkit, cloudigan-api) use `mcp0_deploy_to_standby` and `mcp0_switch_traffic`.

**Discovery/Decision:** TIP Generator should be added to the MCP server to follow the standard deployment model.

**Required Changes to MCP Server:**
- App name: `tip-generator`
- Blue: `tip-blue` (CT190, 10.92.3.91)
- Green: `tip-green` (CT191, 10.92.3.92)
- Deploy command: `/opt/tip-generator/deploy.sh` (already on both containers)
- HAProxy backend: needs `tip_blue` / `tip_green` backends configured
- Health check: `http://localhost:8000/health`
- Traffic switch: via HAProxy (same pattern as theoshift)

**Impact:** Once registered, use `mcp0_deploy_to_standby app=tip-generator` and `mcp0_switch_traffic app=tip-generator` instead of direct SSH.

**References:** D-LOCAL-004, D-LOCAL-005, APP-MAP.md TIP Generator entry
