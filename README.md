# Screenshot Service

A high-performance Node.js service that generates web page screenshots on-demand using Puppeteer. Built with Hono and featuring concurrent processing, authentication, and hostname whitelisting for secure, scalable screenshot generation.

[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)

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
- Hostname whitelist validation for enhanced security

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

**Error Responses:**
- `403 Forbidden`: If the URL's hostname is not in the allowed whitelist

## Environment Variables

- `PORT`: Server port number (default: 3000)
- `NODE_ENV`: Environment setting ("development" enables request logging)
- `AUTH_TOKEN`: Required. The bearer token that clients must provide to access protected endpoints
- `MAX_CONCURRENCY`: Maximum number of concurrent screenshot operations (default: 10)
- `HOST_WHITELIST`: Comma-separated list of allowed hostnames. If empty, all hostnames are allowed

## Technical Details

- Built with [Hono](https://hono.dev/) web framework
- Uses [Puppeteer](https://pptr.dev/) for browser automation
- Implements [puppeteer-cluster](https://github.com/thomasdondorf/puppeteer-cluster) for concurrent processing
- Input validation using [Zod](https://zod.dev/)

## Docker Usage

### Building the Image

```bash
docker build -t screenshot-service .
```

### Running the Container

```bash
docker run -d \
  -p 3000:3000 \
  -e AUTH_TOKEN=your-secret-token \
  -e HOST_WHITELIST=example.com,test.com \
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

### Docker Compose

For local development, you can use the provided `docker-compose.yml`:

```bash
docker-compose up -d
```

This will start the service with the configuration specified in your `.env` file.

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