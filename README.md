# Screenshot Service

A high-performance screenshot service that generates web page screenshots on-demand using Puppeteer. Distributed via NPM for easy integration into your projects.

[![npm](https://img.shields.io/npm/v/@miketromba/screenshot-service?style=flat)](https://www.npmjs.com/package/@miketromba/screenshot-service)
[![Bun](https://img.shields.io/badge/Bun-000000?style=flat&logo=bun&logoColor=white)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)](https://vercel.com/)

## Quick Start

### Development (Local Server)

Run the screenshot service locally with a single command (requires [Bun](https://bun.sh)):

```bash
# Start the server on port 3000
npx @miketromba/screenshot-service

# Or with options
npx @miketromba/screenshot-service --port 3001

# With authentication
SCREENSHOT_AUTH_TOKEN=secret npx @miketromba/screenshot-service
```

### Production (Vercel + Next.js)

Deploy the screenshot service as part of your Next.js project on Vercel.

> **Note:** This package ships raw TypeScript files. You must configure Next.js to transpile it.

```bash
npm install @miketromba/screenshot-service
```

**Step 1: Configure Next.js to transpile the package** (`next.config.js` or `next.config.ts`):
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@miketromba/screenshot-service'],
}

module.exports = nextConfig
```

**Step 2: Create the API route**

Next.js App Router (`app/api/screenshot/route.ts`):
```ts
export { GET } from '@miketromba/screenshot-service/vercel'
```

Or for Pages Router (`pages/api/screenshot.ts`):
```ts
export { GET } from '@miketromba/screenshot-service/vercel'
```

**Step 3: Add function configuration** (`vercel.json`):
```json
{
  "functions": {
    "api/screenshot.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  }
}
```

Set environment variables in Vercel dashboard:
- `SCREENSHOT_AUTH_TOKEN` - Bearer token for authentication (optional)
- `SCREENSHOT_HOST_WHITELIST` - Comma-separated allowed hostnames (optional)

## Overview

The Screenshot Service provides an API for generating screenshots of web pages using Puppeteer. It supports two deployment modes:

- **Development**: Local Bun server with puppeteer-cluster for concurrent processing (up to 10 simultaneous screenshots)
- **Production**: Vercel serverless function using puppeteer-core + @sparticuz/chromium (scales horizontally)

## Features

- On-demand screenshot generation
- Configurable screenshot dimensions
- Support for multiple image formats (PNG, WEBP, JPEG)
- Adjustable image quality
- Full page or viewport screenshots
- Concurrent request handling (up to 10 simultaneous screenshots)
- Bearer token authentication for secure access
- Hostname whitelist validation for enhanced security

## Use Cases

### Internal Application Screenshots
The service is particularly useful for capturing screenshots of authenticated internal applications. For example, in a design tool where previews are protected behind authentication:

1. Set up your internal application with authentication
2. Configure the screenshot service with the same authentication token
3. Use the service to capture authenticated views of your application

Example scenario:
```bash
# Your design tool has protected preview URLs like:
# https://design-tool.internal/preview/design-123
# These URLs require authentication to access

# Configure the screenshot service with your auth token
export SCREENSHOT_AUTH_TOKEN=your-internal-auth-token

# The service will now be able to access and capture these protected previews
curl -H "Authorization: Bearer $SCREENSHOT_AUTH_TOKEN" \
  "http://localhost:3000/screenshot?url=https://design-tool.internal/preview/design-123" \
  > design-preview.png
```

This setup ensures that:
- Your internal application remains secure
- Only the screenshot service can access protected previews
- You can programmatically capture authenticated views of your application

## Authentication

Authentication is optional and can be enabled by setting the `SCREENSHOT_AUTH_TOKEN` environment variable. When enabled, all endpoints except the health check (`GET /`) require authentication using a Bearer token. The token must be included in the `Authorization` header of each request.

Format: `Authorization: Bearer <your-token>`

If authentication is enabled and the token is missing or invalid, the server will respond with:
- `401 Unauthorized`: Missing or invalid Authorization header format
- `403 Forbidden`: Invalid token

Note: When SCREENSHOT_AUTH_TOKEN is set, it is also used to authenticate requests to the target websites when taking screenshots. This means the service will forward your authentication token to the websites you're capturing.

## API Endpoints

The API is identical for both deployment options, with different base paths:

| Deployment | Health Check | Screenshot |
|------------|--------------|------------|
| Docker/Bun | `GET /` | `GET /screenshot` |
| Vercel | `GET /api` | `GET /api/screenshot` |

### Health Check

Returns server status. This endpoint does not require authentication.

**Response:**
```json
{ "online": true }
```

### Take Screenshot

**Authentication Required**: Yes (Bearer token)

**Query Parameters:**

- `url` (required): The URL to screenshot (must be a valid URL)
- `fullPage` (optional): Whether to capture the full page or just the viewport
  - Default: false
  - Values: "true" or "false"
- `quality` (optional): Image quality (for JPEG and WEBP only)
  - Default: 100
  - Range: 1-100
- `type` (optional): Output image format
  - Default: "png"
  - Values: "png", "webp", "jpeg"
- `width` (optional): Viewport width in pixels
  - Default: 1440
  - Range: 1-1920
- `height` (optional): Viewport height in pixels
  - Default: 900
  - Range: 1-10000

#### Page Loading Options

The service provides several options to control when the screenshot is taken, ensuring content is fully loaded:

- `waitUntil` (optional): When to consider page navigation successful
  - Default: "networkidle2"
  - Values:
    - `"load"` - Wait for the `load` event (all resources loaded)
    - `"domcontentloaded"` - Wait for the `DOMContentLoaded` event (DOM is ready, but stylesheets/images may still be loading)
    - `"networkidle0"` - Wait until there are no network connections for at least 500ms (strictest)
    - `"networkidle2"` - Wait until there are no more than 2 network connections for at least 500ms (default, good balance)
- `waitForSelector` (optional): CSS selector to wait for before taking the screenshot
  - Example: ".main-content" or "#hero-image"
  - Timeout: 30 seconds
  - Use this when you need to ensure a specific element has rendered
- `delay` (optional): Additional delay in milliseconds after page load before taking the screenshot
  - Range: 0-30000 (0-30 seconds)
  - Use this for animations, transitions, or slow-rendering content

**Note:** The service always waits for web fonts to load (`document.fonts.ready`) before taking screenshots to ensure text renders correctly.

**Response:**
- Content-Type: image/[type]
- Body: Binary image data

**Error Responses:**
- `403 Forbidden`: If the URL's hostname is not in the allowed whitelist

## Environment Variables

- `PORT`: Server port number (default: 3000)
- `NODE_ENV`: Environment setting ("development" enables request logging)
- `SCREENSHOT_AUTH_TOKEN`: Optional. When set, used for two purposes:
  1. The bearer token that clients must provide to access protected endpoints
  2. The authorization token forwarded to target websites when taking screenshots
- `MAX_CONCURRENCY`: Maximum number of concurrent screenshot operations (default: 10)
- `SCREENSHOT_HOST_WHITELIST`: Comma-separated list of allowed hostnames. If empty, all hostnames are allowed

## Technical Details

### Local Development Server
- Built with [Hono](https://hono.dev/) web framework
- Uses [Puppeteer](https://pptr.dev/) for browser automation
- Implements [puppeteer-cluster](https://github.com/thomasdondorf/puppeteer-cluster) for concurrent processing
- Input validation using [Zod](https://zod.dev/)
- Requires [Bun](https://bun.sh) runtime

### Vercel Serverless (Next.js)
- Requires Next.js with `transpilePackages` configured (ships raw TypeScript)
- Serverless function with [puppeteer-core](https://pptr.dev/)
- Uses [@sparticuz/chromium](https://github.com/Sparticuz/chromium) for serverless-optimized Chromium
- Shared validation and screenshot logic

## Docker Usage (Alternative)

For production deployments where you need full control, you can also run this as a Docker container.

### Building the Image

You can build the Docker image using either the bun script or directly with Docker:

```bash
# Using bun script (builds with tag: screenshot-service)
bun run docker:build

# Or directly with Docker
docker build -t screenshot-service .
```

### Running the Container

```bash
docker run -d \
  -p 3000:3000 \
  -e SCREENSHOT_AUTH_TOKEN=your-secret-token \
  -e SCREENSHOT_HOST_WHITELIST=example.com,test.com \
  -e MAX_CONCURRENCY=10 \
  screenshot-service
```

### Environment Variables

All environment variables can be passed to the container using the `-e` flag or by using a `.env` file:

```bash
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  screenshot-service
```

### Accessing Local Services from Docker

When running the screenshot service in Docker and you need to capture screenshots of services running on your local machine, you need to:

1. Add the `--add-host=host.docker.internal:host-gateway` flag when running the container
2. Use `host.docker.internal` instead of `localhost` in your URLs

This is because `localhost` inside the container refers to the container itself, not your host machine.

Example:
```bash
# ❌ Instead of:
curl -H "Authorization: Bearer $SCREENSHOT_AUTH_TOKEN" "http://localhost:3000/screenshot?url=http://localhost:3001/my-app"

# ✅ Use:
curl -H "Authorization: Bearer $SCREENSHOT_AUTH_TOKEN" "http://localhost:3000/screenshot?url=http://host.docker.internal:3001/my-app"
```

Note: The `--add-host` flag is required for `host.docker.internal` to work. Make sure to include it in your `docker run` command.

## Vercel Production Notes

### Package Manager Compatibility

> **Important:** This package may not work correctly with **PNPM** when deployed to Vercel.

PNPM uses symlinks for its node_modules structure, which can cause issues with Vercel's build process and module resolution in production. If you encounter module resolution errors or unexpected behavior when deploying to Vercel with PNPM, switch your project to use **Bun** or **npm** as the package manager instead.

```bash
# If using PNPM and experiencing issues, switch to Bun:
rm -rf node_modules pnpm-lock.yaml
bun install
```

### Limitations

- **Cold starts**: First request may take 5-10 seconds (browser launch)
- **Timeout**: 60 seconds max (configurable up to 300s on Pro plan)
- **No custom fonts**: Unlike local development, Vercel functions don't include custom fonts. Screenshots may render with different fonts.
- **Scaling**: Vercel handles scaling automatically via parallel function invocations

### Local Dev vs Vercel + Next.js

| Feature | Local (npx) | Vercel + Next.js |
|---------|-------------|------------------|
| Concurrency | puppeteer-cluster (configurable) | Horizontal scaling |
| Cold start | None (always running) | 5-10 seconds |
| Custom fonts | System fonts available | Limited |
| Max timeout | Unlimited | 60-300 seconds |
| Cost | Free (local) | Pay per invocation |
| Setup | None | Requires `transpilePackages` config |

## Example Usage

```bash
# Set your auth token
export SCREENSHOT_AUTH_TOKEN=your-secret-token

# Basic screenshot
curl -H "Authorization: Bearer $SCREENSHOT_AUTH_TOKEN" "http://localhost:3006/screenshot?url=https://example.com" > screenshot.png

# Full page JPEG screenshot with 80% quality
curl -H "Authorization: Bearer $SCREENSHOT_AUTH_TOKEN" "http://localhost:3006/screenshot?url=https://example.com&fullPage=true&type=jpeg&quality=80" > screenshot.jpg

# Custom dimension WEBP screenshot
curl -H "Authorization: Bearer $SCREENSHOT_AUTH_TOKEN" "http://localhost:3006/screenshot?url=https://example.com&width=1024&height=768&type=webp" > screenshot.webp

# Wait for all network activity to finish (strictest loading strategy)
curl -H "Authorization: Bearer $SCREENSHOT_AUTH_TOKEN" "http://localhost:3006/screenshot?url=https://example.com&waitUntil=networkidle0" > screenshot.png

# Wait for a specific element to appear before taking screenshot
curl -H "Authorization: Bearer $SCREENSHOT_AUTH_TOKEN" "http://localhost:3006/screenshot?url=https://example.com&waitForSelector=.main-content" > screenshot.png

# Add a 2-second delay for animations/transitions to complete
curl -H "Authorization: Bearer $SCREENSHOT_AUTH_TOKEN" "http://localhost:3006/screenshot?url=https://example.com&delay=2000" > screenshot.png

# Combine multiple loading options for complex pages
curl -H "Authorization: Bearer $SCREENSHOT_AUTH_TOKEN" "http://localhost:3006/screenshot?url=https://example.com&waitUntil=networkidle0&waitForSelector=#hero-image&delay=1000" > screenshot.png
```