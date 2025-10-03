# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

deco.chat is an extensible, self-hosted AI workspace for building intelligent, UI-rich AI agents that integrate with internal tools and data. The platform provides an interactive chat interface with rich UI components, MCP (Model Context Protocol) integrations, and collaborative agent development.

## Architecture

### Monorepo Structure

This is a TypeScript/Deno monorepo with the following key applications:

- `apps/web/` - React web application (Vite + React 19)
- `apps/api/` - Cloudflare Workers API backend (Hono + Deno)  
- `apps/outbound/` - Outbound service for external communications
- `packages/sdk/` - Core SDK with database operations, authentication, and utilities
- `packages/ai/` - AI and agent-related functionality
- `packages/ui/` - Shared UI components (shadcn/ui based)
- `packages/cli/` - CLI tools for deployment and management
- `packages/runtime/` - Runtime environment for MCP servers, workflows, and bindings
- `docs/` - Documentation site (Astro + Starlight theme with MCP server integration)

### Technology Stack

**Frontend:**
- React 19 with TypeScript
- Vite for bundling
- React Router v7 for routing
- TailwindCSS for styling
- Dockview for multi-pane layouts
- React Query for state management

**Backend:**
- Deno runtime
- Hono web framework
- Cloudflare Workers for deployment
- Supabase for database and authentication
- MCP (Model Context Protocol) server runtime

**Database:**
- PostgreSQL via Supabase
- Database migrations in `supabase/migrations/`

## Development Commands

### Setup
```bash
deno install                    # Install dependencies
cp apps/web/.env.example apps/web/.env  # Setup environment
```

### Development
```bash
npm run dev                     # Start both web and API in development
npm run docs:dev               # Start documentation site
```

### Individual Services
```bash
cd apps/web && npm run dev     # Web app only (port 5173)
cd apps/api && npm run dev     # API only (port 3001)
cd docs && npm run dev         # Documentation site only (port 4321)
```

### Testing & Quality
```bash
npm test                       # Run all tests
npm run test:watch            # Run tests in watch mode
deno run lint                 # Lint all code
deno run fmt                  # Format all code
npm run check                 # TypeScript type checking
```

### Database Operations
```bash
npm run db:migration          # Run pending migrations
npm run db:migration:create   # Create new migration
npm run db:types             # Generate TypeScript types from DB schema
npm run rolesCLI             # Role and policy management CLI
```

### Build & Deploy
```bash
npm run build                 # Build web application
npm run npm:build            # NPM-compatible build
```

## Key Development Patterns

### Code Organization
- Use workspace-relative imports: `@deco/sdk`, `@deco/ui`, etc.
- Components are organized by feature in `apps/web/src/components/`
- Shared utilities in `packages/sdk/src/utils/`
- Database operations in `packages/sdk/src/crud/`
- MCP server runtime and bindings in `packages/runtime/src/`
- Documentation content in `docs/view/src/content/docs/`

### State Management
- React Query for server state
- React Context for UI state
- Local storage hooks in `apps/web/src/hooks/`

### Authentication & Authorization
- Supabase authentication
- Team-based workspace model
- Role-based access control (admin/member)
- Profile linking via `packages/sdk/src/auth/`

### Database Patterns  
- All entities require workspace association
- Soft deletes using `deleted_at` timestamps
- Audit logging via database triggers
- JSONB fields for flexible schema extension

### API Development
- RESTful endpoints in `apps/api/src/`
- Hono middleware for common functionality
- Context-aware request handling
- MCP protocol integration

### Testing Strategy
- Vitest for unit tests
- Test files co-located with source code
- Schema validation tests for critical data models

### Error Handling
- Custom error classes in `packages/sdk/src/errors.ts`
- Consistent error boundaries in React components
- Proper HTTP status codes in API responses

### MCP & Runtime Development
- MCP servers use `packages/runtime/` for standard integration patterns
- Workflow management via Durable Objects in `packages/runtime/src/workflow.ts`
- Binding system for connecting external services in `packages/runtime/src/bindings.ts`
- Authentication and context handling in `packages/runtime/src/auth.ts`
- Use `env.SELF` for runtime environment access

### Documentation Development
- Documentation built with Astro + Starlight theme
- MDX support for rich content in `docs/view/src/content/docs/`
- MCP server integration provides live documentation
- Use Tailwind CSS for custom styling in documentation

## Important Constraints

- Use TypeScript strict mode throughout
- Follow existing component patterns from `apps/web/src/components/`
- Maintain database schema integrity via migrations
- Ensure all API endpoints are authenticated
- Follow security best practices (no secrets in code)