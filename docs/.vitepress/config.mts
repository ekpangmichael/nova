import { defineConfig } from "vitepress";

// When the site is hosted at https://<user>.github.io/nova/ we need the
// `/nova/` base so asset URLs resolve. CI sets DOCS_BASE=/nova/.
// Local dev and the root-domain case leave it as "/".
const base = process.env.DOCS_BASE ?? "/";

export default defineConfig({
  title: "Nova",
  description: "Local-first agent management platform",
  base,
  cleanUrls: true,
  ignoreDeadLinks: true,

  head: [["link", { rel: "icon", type: "image/svg+xml", href: `${base}logo.svg` }]],

  themeConfig: {
    siteTitle: "Nova",

    nav: [
      { text: "Guide", link: "/getting-started/" },
      { text: "Architecture", link: "/architecture/" },
      { text: "API Reference", link: "/backend/api-reference/" },
    ],

    sidebar: [
      {
        text: "Getting Started",
        collapsed: false,
        items: [
          { text: "Overview", link: "/getting-started/" },
          { text: "Prerequisites", link: "/getting-started/prerequisites" },
          { text: "Installation", link: "/getting-started/installation" },
          { text: "Runtime Setup", link: "/getting-started/runtime-setup" },
          {
            text: "Development Workflow",
            link: "/getting-started/development-workflow",
          },
          {
            text: "Project Structure",
            link: "/getting-started/project-structure",
          },
        ],
      },
      {
        text: "Architecture",
        collapsed: false,
        items: [
          { text: "Overview", link: "/architecture/" },
          { text: "Design Philosophy", link: "/architecture/design-philosophy" },
          { text: "Domain Model", link: "/architecture/domain-model" },
          { text: "Data Flow", link: "/architecture/data-flow" },
          { text: "Technology Stack", link: "/architecture/technology-stack" },
        ],
      },
      {
        text: "Backend",
        collapsed: true,
        items: [
          { text: "Overview", link: "/backend/" },
          { text: "App Factory", link: "/backend/app-factory" },
          { text: "Authentication", link: "/backend/authentication" },
          {
            text: "Services",
            collapsed: true,
            items: [
              {
                text: "NovaService",
                link: "/backend/services/nova-service",
              },
              {
                text: "RuntimeManager",
                link: "/backend/services/runtime-manager",
              },
              {
                text: "WebSocket Hub",
                link: "/backend/services/websocket-hub",
              },
            ],
          },
          {
            text: "API Reference",
            collapsed: true,
            items: [
              { text: "Overview", link: "/backend/api-reference/" },
              {
                text: "Project Endpoints",
                link: "/backend/api-reference/project-endpoints",
              },
              {
                text: "Agent Endpoints",
                link: "/backend/api-reference/agent-endpoints",
              },
              {
                text: "Task Endpoints",
                link: "/backend/api-reference/task-endpoints",
              },
              {
                text: "Auth Endpoints",
                link: "/backend/api-reference/auth-endpoints",
              },
            ],
          },
        ],
      },
      {
        text: "Frontend",
        collapsed: true,
        items: [
          { text: "Overview", link: "/frontend/" },
          {
            text: "Routing and Layouts",
            link: "/frontend/routing-and-layouts",
          },
          { text: "API Client", link: "/frontend/api-client" },
          { text: "Styling", link: "/frontend/styling" },
          { text: "Real-time Updates", link: "/frontend/real-time-updates" },
          {
            text: "Pages",
            collapsed: true,
            items: [
              { text: "Dashboard", link: "/frontend/pages/dashboard" },
              { text: "Projects", link: "/frontend/pages/projects" },
              { text: "Kanban Board", link: "/frontend/pages/kanban-board" },
              { text: "Agents", link: "/frontend/pages/agents" },
            ],
          },
        ],
      },
      {
        text: "Database",
        collapsed: true,
        items: [
          { text: "Overview", link: "/database/" },
          { text: "Schema Reference", link: "/database/schema-reference" },
          {
            text: "Entity Relationships",
            link: "/database/entity-relationship",
          },
          { text: "Migrations", link: "/database/migrations" },
        ],
      },
      {
        text: "Runtime Adapters",
        collapsed: true,
        items: [
          { text: "Overview", link: "/runtime-adapters/" },
          {
            text: "Adapter Interface",
            link: "/runtime-adapters/adapter-interface",
          },
          { text: "Capabilities", link: "/runtime-adapters/capabilities" },
          {
            text: "OpenClaw Adapter",
            link: "/runtime-adapters/openclaw-adapter",
          },
          { text: "Codex Adapter", link: "/runtime-adapters/codex-adapter" },
          {
            text: "Claude Code Adapter",
            link: "/runtime-adapters/claude-adapter",
          },
          { text: "Mock Adapter", link: "/runtime-adapters/mock-adapter" },
          {
            text: "Adding a New Runtime",
            link: "/runtime-adapters/adding-a-new-runtime",
          },
        ],
      },
      {
        text: "Shared Packages",
        collapsed: true,
        items: [
          { text: "Overview", link: "/shared-packages/" },
          { text: "@nova/shared", link: "/shared-packages/nova-shared" },
        ],
      },
      {
        text: "Agent Home",
        collapsed: true,
        items: [{ text: "Overview", link: "/agent-home/" }],
      },
      {
        text: "Operations",
        collapsed: true,
        items: [
          {
            text: "Support Boundaries",
            link: "/operations/support-boundaries",
          },
          {
            text: "Public Repo Boundaries",
            link: "/operations/public-repo-boundaries",
          },
          {
            text: "Release Process",
            link: "/operations/release-process",
          },
          {
            text: "Configuration Reference",
            link: "/operations/configuration-reference",
          },
          {
            text: "Telemetry",
            link: "/operations/telemetry",
          },
        ],
      },
      {
        text: "Contributing",
        collapsed: true,
        items: [
          {
            text: "Development Setup",
            link: "/contributing/development-setup",
          },
          { text: "Code Conventions", link: "/contributing/code-conventions" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/ekpangmichael/nova" },
    ],

    search: {
      provider: "local",
    },

    outline: {
      level: [2, 3],
    },

    footer: {
      message: "Nova Documentation",
    },
  },
});
