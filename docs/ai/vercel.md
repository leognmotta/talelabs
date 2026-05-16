# Vercel AI Context

When working on Next.js, React, Vercel deployment, or Turborepo tasks in this repo, use the project-local Vercel skills first.

- React performance: `.agents/skills/vercel-react-best-practices/SKILL.md`
- React composition: `.agents/skills/vercel-composition-patterns/SKILL.md`
- Next.js conventions: `.agents/skills/next-best-practices/SKILL.md`
- Next.js cache components: `.agents/skills/next-cache-components/SKILL.md`
- Turborepo: `.agents/skills/turborepo/SKILL.md`
- Deployment: `.agents/skills/deploy-to-vercel/SKILL.md`

Vercel MCP is configured in `mcp.json` using the official endpoint:

```json
{
  "vercel": {
    "url": "https://mcp.vercel.com"
  }
}
```

The MCP server requires OAuth authorization in the MCP client. If Vercel tools are not visible in a running Codex session, restart/reload the session after authorizing the connector.

Official references:

- Skills: https://vercel.com/docs/agent-resources/skills
- MCP: https://vercel.com/docs/agent-resources/vercel-mcp
