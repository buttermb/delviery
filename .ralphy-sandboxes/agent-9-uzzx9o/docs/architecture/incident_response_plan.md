# Incident Response Plan

## 1. Severity Levels

| Level | Description | Examples | Response Time |
|-------|-------------|----------|---------------|
| **Critical (SEV-1)** | System unusable or major security breach | Data leak, full outage, active attack | < 15 mins |
| **High (SEV-2)** | Major feature broken or elevated risk | Payment failure, slow performance, suspicious activity | < 1 hour |
| **Medium (SEV-3)** | Minor feature broken or potential risk | UI glitch, single user issue, warning logs | < 4 hours |
| **Low (SEV-4)** | Cosmetic issue or suggestion | Typo, minor styling bug | < 24 hours |

## 2. Response Roles

- **Incident Commander (IC)**: Leads the response, coordinates team, communicates with stakeholders.
- **Tech Lead**: Investigates root cause, proposes technical fixes.
- **Comms Lead**: Drafts status updates for users and internal teams.

## 3. Response Workflow

### Step 1: Detection & Triage
- **Alerts**: Monitoring system (Sentry, Supabase) triggers alert.
- **User Report**: Customer support receives ticket.
- **Action**: On-call engineer verifies issue and assigns Severity Level.

### Step 2: Containment (For Security/Critical Issues)
- **Panic Mode**: Enable "Panic Mode" in Admin Dashboard to lock down all menus.
- **Block IP**: Add malicious IPs to blocklist via Supabase Edge Config.
- **Revoke Keys**: Rotate API keys if compromised.

### Step 3: Investigation & Fix
- **Logs**: Analyze Supabase logs and application events.
- **Reproduction**: Attempt to reproduce in staging.
- **Fix**: Deploy hotfix to production.

### Step 4: Recovery & Review
- **Verify**: Confirm system is stable.
- **Restore**: Disable Panic Mode / unblock legitimate traffic.
- **Post-Mortem**: Document what happened, why, and how to prevent recurrence.

## 4. Key Contacts

- **DevOps**: devops@example.com
- **Security**: security@example.com
- **Support**: support@example.com

## 5. Runbooks

### Scenario A: Active Scraping Attack
1. Go to **Smart Dashboard > Security**.
2. Identify attacking IP range.
3. Click **Block IP Range**.
4. Enable **High Security Mode** for affected menus.

### Scenario B: Database High CPU
1. Check **Supabase Dashboard > Database > Health**.
2. Identify slow queries.
3. Kill long-running connections.
4. Scale up instance if needed (temporarily).
