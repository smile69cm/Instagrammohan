# InstaFlow - Instagram DM Automation Platform

A powerful Instagram DM automation platform with AI-powered responses, content scheduling, and analytics.

## Features

- **AI-Powered Responses**: Automated DM responses using OpenAI
- **Content Scheduling**: Plan and schedule your Instagram content
- **Analytics Dashboard**: Track engagement and automation performance
- **User Authentication**: Secure login with Clerk
- **Automation Rules**: Create custom automation triggers and responses

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Clerk
- **AI**: OpenAI API

## Deployment

### Deploy to Vercel

1. Fork this repository to your GitHub account
2. Go to [Vercel](https://vercel.com) and import the repository
3. Add the following environment variables:
   - `DATABASE_URL` - PostgreSQL connection string
   - `CLERK_PUBLISHABLE_KEY` - Clerk public key
   - `CLERK_SECRET_KEY` - Clerk secret key
   - `OPENAI_API_KEY` - OpenAI API key
   - `INSTAGRAM_CLIENT_ID` - Instagram/Facebook App Client ID
   - `INSTAGRAM_CLIENT_SECRET` - Instagram/Facebook App Secret
   - `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` - Custom webhook verification token
   - `FACEBOOK_APP_ID` - Facebook App ID
   - `FACEBOOK_APP_SECRET` - Facebook App Secret
4. Click Deploy

### Deploy to Render

1. Fork this repository to your GitHub account
2. Go to [Render](https://render.com) and create a new Web Service
3. Connect your GitHub repository
4. The `render.yaml` file will automatically configure the deployment
5. Add the required environment variables in Render dashboard
6. Click Create Web Service

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL database connection URL |
| `CLERK_PUBLISHABLE_KEY` | Clerk frontend key |
| `CLERK_SECRET_KEY` | Clerk backend secret |
| `OPENAI_API_KEY` | OpenAI API key for AI features |
| `INSTAGRAM_CLIENT_ID` | Instagram/Meta App Client ID |
| `INSTAGRAM_CLIENT_SECRET` | Instagram/Meta App Secret |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | Custom token for webhook verification |
| `FACEBOOK_APP_ID` | Facebook App ID |
| `FACEBOOK_APP_SECRET` | Facebook App Secret |
| `NEXT_PUBLIC_HOST_URL` | Your deployed app URL |

## Local Development

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development server
npm run dev
```

## Build Commands

```bash
# Build for production (Render/Heroku)
npm run build

# Start production server
npm run start
```

## Project Structure

```
├── api/              # Vercel serverless functions
├── client/           # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   └── hooks/
├── server/           # Express backend
│   ├── lib/          # Backend utilities
│   └── routes.ts     # API routes
├── shared/           # Shared types and schemas
├── script/           # Build scripts
├── vercel.json       # Vercel configuration
├── render.yaml       # Render configuration
└── Procfile          # Heroku/Render process file
```

## License

MIT License
