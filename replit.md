# InstaFlow - Instagram Automation Platform

## Overview

InstaFlow is an AI-powered Instagram automation platform that enables users to automate social media interactions and content generation. The application provides tools for automated DM replies, content creation with AI assistance, and activity tracking across connected Instagram accounts.

The platform is built as a modern full-stack web application with a React frontend and Express backend, utilizing Clerk for authentication, PostgreSQL (via Neon) for data persistence, and OpenAI's GPT-5 for AI-powered features.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and development server for fast HMR and optimized production builds
- **Wouter** for lightweight client-side routing instead of React Router
- **TanStack Query (React Query)** for server state management, caching, and data synchronization

**UI Component System**
- **shadcn/ui** component library built on Radix UI primitives
- **Tailwind CSS** with custom design tokens for styling, using Instagram-inspired brand colors
- **class-variance-authority (CVA)** for managing component variants
- Custom theme with Instagram gradient colors (primary: `#E4405F`, secondary: `#833AB4`)

**Design Rationale**: The shadcn/ui approach was chosen over traditional component libraries because it provides full ownership of components while maintaining consistency. Components are copied into the project rather than installed as dependencies, allowing for deep customization while benefiting from best practices.

### Backend Architecture

**Server Framework**
- **Express.js** with TypeScript for the HTTP server
- **HTTP server** (Node's built-in) wrapping Express for potential WebSocket support
- **Development mode**: Vite middleware integration for seamless HMR
- **Production mode**: Serves pre-built static assets from the `dist/public` directory

**Build Strategy**
- **esbuild** bundles the server code with selective dependency bundling
- Allowlist approach for frequently-used dependencies to reduce cold start syscalls
- Client built separately with Vite and served as static assets

**API Design**
- RESTful API structure under `/api` prefix
- Protected routes using Clerk middleware for authentication
- Route organization in `server/routes.ts` with clear endpoint grouping:
  - User management (`/api/user`)
  - Instagram account connections (`/api/instagram/*`)
  - Automation management (`/api/automations/*`)
  - Content generation (`/api/content/*`)
  - Activity logging (`/api/activity`)

### Authentication & Authorization

**Clerk Integration**
- **Clerk** handles all user authentication flows (sign-up, sign-in, session management)
- Server-side: `@clerk/express` middleware protects API routes
- Client-side: `@clerk/clerk-react` provides authentication context and UI components
- Custom auth pages with Instagram-themed styling
- Session management handled entirely by Clerk
- User records stored in database reference Clerk user IDs for association

**Design Rationale**: Clerk was chosen to eliminate the complexity of building custom authentication, password management, and session handling. It provides enterprise-grade security while allowing focus on core business features.

### Database Layer

**ORM & Database**
- **Drizzle ORM** with TypeScript schema definitions in `shared/schema.ts`
- **Neon PostgreSQL** serverless database via `@neondatabase/serverless`
- HTTP-based database connection using Neon's HTTP driver (optimized for serverless)

**Schema Design**
Core tables include:
- `users`: Links Clerk authentication to application users
- `instagramAccounts`: Stores Instagram account connections with OAuth tokens
- `automations`: Configuration for automated behaviors (DM replies, reactions, etc.)
- `generatedContent`: AI-generated content history
- `activityLog`: Audit trail of automation actions

**Storage Pattern**
- Interface-based storage layer (`IStorage`) in `server/storage.ts`
- `DatabaseStorage` implementation provides database operations
- Separation allows for potential storage backend swaps (e.g., testing, caching layers)

**Design Rationale**: Drizzle was chosen over heavier ORMs like Prisma for its lightweight footprint, type-safe query builder, and minimal runtime overhead. The HTTP-based Neon driver eliminates connection pooling concerns in serverless environments.

### AI Integration

**OpenAI GPT-5**
- Content generation for Instagram captions based on topics and tone
- Auto-reply generation for DM automation
- Located in `server/lib/openai.ts`

**API Design**
- `generateContent()`: Creates Instagram captions with emoji and hashtag inclusion
- `generateAutoReply()`: Generates contextual responses for automated DM replies
- System prompts engineered for Instagram-specific content

**Design Rationale**: OpenAI's GPT-5 provides state-of-the-art language generation. The API is abstracted into dedicated functions to allow for future model swaps or prompt engineering without affecting route handlers.

### External Dependencies

**Third-Party Services**

1. **Clerk** (`@clerk/clerk-react`, `@clerk/express`)
   - Purpose: User authentication and session management
   - Integration: Environment variables `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

2. **Neon Database** (`@neondatabase/serverless`)
   - Purpose: PostgreSQL database hosting
   - Integration: `DATABASE_URL` environment variable
   - Connection: HTTP-based serverless driver

3. **OpenAI** (`openai`)
   - Purpose: AI content generation
   - Integration: `OPENAI_API_KEY` environment variable
   - Model: GPT-5

4. **Instagram Graph API**
   - Purpose: OAuth authentication and account management
   - Integration: `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`
   - Endpoints: OAuth token exchange, user info retrieval, long-lived token generation
   - Implementation: `server/lib/instagram.ts`

**UI Component Libraries**
- **Radix UI**: Headless component primitives for accessibility
- **Lucide React**: Icon library
- **Recharts**: Chart components for analytics dashboards
- **date-fns**: Date formatting utilities

**Development Tools**
- **Replit-specific plugins**: Vite plugins for Replit development environment integration
  - Runtime error overlay
  - Cartographer (development mode only)
  - Dev banner (development mode only)
  - Meta images plugin for OpenGraph image handling

**Design Considerations**
- All external API integrations are environment-variable driven
- Instagram API helpers are abstracted in `server/lib/instagram.ts`
- Error handling for missing environment variables at startup
- Separate development and production configurations