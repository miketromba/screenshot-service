#!/usr/bin/env bun

const args = process.argv.slice(2)

// Parse arguments
let port: number | undefined
let showHelp = false

for (let i = 0; i < args.length; i++) {
	const arg = args[i]
	if (arg === '--help' || arg === '-h') {
		showHelp = true
	} else if (arg === '--port' || arg === '-p') {
		const portArg = args[++i]
		if (portArg) {
			port = parseInt(portArg, 10)
			if (isNaN(port)) {
				console.error(`Invalid port: ${portArg}`)
				process.exit(1)
			}
		}
	} else if (arg.startsWith('--port=')) {
		port = parseInt(arg.split('=')[1], 10)
		if (isNaN(port)) {
			console.error(`Invalid port: ${arg.split('=')[1]}`)
			process.exit(1)
		}
	}
}

if (showHelp) {
	console.log(`
@miketromba/screenshot-service - A screenshot service powered by Puppeteer

Usage:
  npx @miketromba/screenshot-service [options]

Options:
  -p, --port <port>  Port to run the server on (default: 3000, or PORT env var)
  -h, --help         Show this help message

Environment Variables:
  PORT            Server port (default: 3000)
  SCREENSHOT_AUTH_TOKEN      Bearer token for authentication (optional)
  SCREENSHOT_HOST_WHITELIST  Comma-separated list of allowed hostnames (optional)
  MAX_CONCURRENCY Maximum concurrent screenshots (default: 10)
  NODE_ENV        Set to "development" for verbose logging

Examples:
  # Start with default settings
  npx @miketromba/screenshot-service

  # Start on a specific port
  npx @miketromba/screenshot-service --port 3001

  # Start with authentication
  SCREENSHOT_AUTH_TOKEN=secret npx @miketromba/screenshot-service
`)
	process.exit(0)
}

// Set port in environment if provided via CLI (takes precedence)
if (port !== undefined) {
	process.env.PORT = String(port)
}

// Import and run the server
import('../src/server.ts')
