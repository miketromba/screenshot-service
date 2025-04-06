# Screenshot Service

This is a server that runs a nodejs runtime and generates project file screenshots just-in-time

## Overview

The Screenshot Service is a Node.js server built with Hono that provides an API for generating screenshots of web pages using Puppeteer. It supports concurrent screenshot generation through a puppeteer-cluster implementation.

## Features

- On-demand screenshot generation
- Configurable screenshot dimensions
- Support for multiple image formats (PNG, WEBP, JPEG)
- Adjustable image quality
- Full page or viewport screenshots
- Concurrent request handling (up to 10 simultaneous screenshots)
- Bearer token authentication for secure access

## Authentication

All endpoints except the health check (`GET /`) require authentication using a Bearer token. The token must be included in the `Authorization` header of each request.

Format: `Authorization: Bearer <your-token>`

If the token is missing or invalid, the server will respond with:
- `401 Unauthorized`: Missing or invalid Authorization header format
- `403 Forbidden`: Invalid token

## API Endpoints

### Health Check
```
GET /
```
Returns server status. This endpoint does not require authentication.

**Response:**
```json
{ "online": true }
```

### Take Screenshot
```
GET /screenshot
```

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

**Response:**
- Content-Type: image/[type]
- Body: Binary image data

## Environment Variables

- `PORT`: Server port number (default: 3006)
- `NODE_ENV`: Environment setting ("development" enables request logging)
- `AUTH_TOKEN`: Required. The bearer token that clients must provide to access protected endpoints

## Technical Details

- Built with [Hono](https://hono.dev/) web framework
- Uses [Puppeteer](https://pptr.dev/) for browser automation
- Implements [puppeteer-cluster](https://github.com/thomasdondorf/puppeteer-cluster) for concurrent processing
- Input validation using [Zod](https://zod.dev/)

## Example Usage

```bash
# Set your auth token
export AUTH_TOKEN=your-secret-token

# Basic screenshot
curl -H "Authorization: Bearer $AUTH_TOKEN" "http://localhost:3006/screenshot?url=https://example.com" > screenshot.png

# Full page JPEG screenshot with 80% quality
curl -H "Authorization: Bearer $AUTH_TOKEN" "http://localhost:3006/screenshot?url=https://example.com&fullPage=true&type=jpeg&quality=80" > screenshot.jpg

# Custom dimension WEBP screenshot
curl -H "Authorization: Bearer $AUTH_TOKEN" "http://localhost:3006/screenshot?url=https://example.com&width=1024&height=768&type=webp" > screenshot.webp
```