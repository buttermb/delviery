# MCP Connector Setup Guide

Quick reference for connecting external services to Claude Code via MCP.

---

## GitHub MCP (Recommended)

Connect to manage repos, issues, and PRs directly from Claude.

```bash
# HTTP transport with authentication
claude mcp add --transport http github https://api.github.com/mcp \
  --header "Authorization: Bearer YOUR_GITHUB_TOKEN"
```

**Get Token:** GitHub → Settings → Developer Settings → Personal Access Tokens → Generate

**Useful prompts after connecting:**
- "Show me open PRs on this repo"
- "Create an issue for the bug we just found"
- "What's the status of issue #123?"

---

## Supabase MCP (Already Connected ✅)

Your project already has `supabase-mcp-server` connected.

**Useful prompts:**
- "List all tables in my database"
- "Apply this migration"
- "Show me the RLS policies on marketplace_orders"

---

## Superpowers Plugin (Recommended)

Install Jesse Vincent's Superpowers for enhanced development workflows.

```bash
# Register the marketplace
/plugin marketplace add obra/superpowers-marketplace

# Install Superpowers
/plugin install superpowers@superpowers-marketplace
```

**What you get:**
- `/superpowers:brainstorm` - Interactive design refinement
- `/superpowers:write-plan` - Create implementation plans
- `/superpowers:execute-plan` - Execute plans in batches

**Update Superpowers:**
```bash
/plugin update superpowers
```

**Source:** [github.com/obra/superpowers](https://github.com/obra/superpowers)

---

## Optional Connectors

### Slack MCP
```bash
claude mcp add --transport http slack https://mcp.slack.com/mcp
```
*Requires Slack app configuration*

### Linear MCP
```bash
claude mcp add --transport http linear https://api.linear.app/mcp \
  --header "Authorization: Bearer YOUR_LINEAR_TOKEN"
```

### PostgreSQL Direct
```bash
claude mcp add --transport http postgres postgres://user:pass@host:5432/db
```

---

## Verify Connections

Run `/mcp` in Claude Code to see all active connectors.

---

## Security Notes

- Store tokens securely (use environment variables)
- Use read-only tokens when possible
- Third-party MCP servers are not verified by Anthropic

---

## Community Resources

| Resource | Description |
|----------|-------------|
| [Skills Marketplace](https://skillsmp.com/) | 60K+ Claude Skills |
| [MCP Protocol Docs](https://modelcontextprotocol.io/docs/develop/connect-local-servers) | Official MCP documentation |
| [Prompt Library](https://docs.anthropic.com/en/prompt-library/library) | Anthropic's prompt examples |
| [Awesome Claude Skills](https://github.com/BehiSecc/awesome-claude-skills) | Curated skill collection |
| [Awesome Claude Code](https://github.com/hesreallyhim/awesome-claude-code) | Commands, configs, tips |
