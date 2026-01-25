import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { Cluster } from 'puppeteer-cluster'
import puppeteer from 'puppeteer'
import { zValidator } from '@hono/zod-validator'
import {
	screenshotQuerySchema,
	isUrlHostnameAllowed,
	queryToScreenshotOptions,
	validateBearerToken,
	captureScreenshot,
	getHostWhitelist,
	getAuthToken,
	CHROME_ARGS
} from './shared'

const MAX_CONCURRENCY = process.env.MAX_CONCURRENCY
	? parseInt(process.env.MAX_CONCURRENCY)
	: 10
const HOST_WHITELIST = getHostWhitelist()
const AUTH_TOKEN = getAuthToken()
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000
const DEV_MODE = process.env.NODE_ENV === 'development'

type PuppeteerOptions = Parameters<typeof puppeteer.launch>[0]

let cluster: Cluster<null, Uint8Array>

async function getCluster() {
	if (!cluster) {
		cluster = await Cluster.launch({
			concurrency: Cluster.CONCURRENCY_CONTEXT,
			maxConcurrency: MAX_CONCURRENCY,
			puppeteerOptions: {
				timeout: 300_000, // 5 minutes -- give it very generous timeout since loading browsers all at once on resource-bound VM is slow
				headless: true,
				args: CHROME_ARGS
			} as PuppeteerOptions
		})
	}
	return cluster
}

async function takeScreenshot(opts: Parameters<typeof captureScreenshot>[1]) {
	const cluster = await getCluster()
	return cluster.execute(null, async ({ page }) => {
		return captureScreenshot(page, opts, AUTH_TOKEN)
	})
}

const app = new Hono()

// Add common middleware
// Only use logger middleware in development environment
if (DEV_MODE) {
	app.use('*', logger())
}

app.use('*', cors())

// Authentication middleware
const auth = async (c: any, next: any) => {
	// Skip auth for health check endpoint
	if (c.req.path === '/') {
		return next()
	}
	const authResult = validateBearerToken(c.req.header('Authorization'), AUTH_TOKEN!)
	if (authResult.valid === false) {
		return c.json({ error: authResult.error }, authResult.status)
	}
	return next()
}

if (AUTH_TOKEN) {
	app.use('*', auth)
}

app.get('/', c => {
	return c.json({ online: true })
})

app.get(
	'/screenshot',
	zValidator('query', screenshotQuerySchema),
	async c => {
		const query = c.req.valid('query')

		// Prod logging
		if (!DEV_MODE) console.log('CAPTURE:', query.url)

		// Check if the URL's hostname is allowed
		if (!isUrlHostnameAllowed(query.url, HOST_WHITELIST)) {
			return c.json(
				{
					error: `Hostname not allowed. Must be one of: ${HOST_WHITELIST.join(
						', '
					)}`
				},
				403
			)
		}

		const screenshot = await takeScreenshot(queryToScreenshotOptions(query))

		return new Response(Buffer.from(screenshot), {
			headers: {
				'Content-Type': `image/${query.type}`
			}
		})
	}
)

Bun.serve({
	port: PORT,
	fetch: app.fetch,
	idleTimeout: 255 // max value, 5 mins
})

console.log(`Screenshot service is online on port ${PORT}`)
