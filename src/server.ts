import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { logger } from 'hono/logger'
import { Cluster } from 'puppeteer-cluster'
import puppeteer from 'puppeteer'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

const MAX_CONCURRENCY = process.env.MAX_CONCURRENCY
	? parseInt(process.env.MAX_CONCURRENCY)
	: 10
const HOST_WHITELIST =
	process.env.HOST_WHITELIST?.split(',').map(h => h.trim()) || []
const AUTH_TOKEN = process.env.AUTH_TOKEN
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
				headless: true,
				args: [
					'--no-sandbox',
					'--disable-setuid-sandbox',
					'--font-render-hinting=none',
					'--disable-font-subpixel-positioning',
					'--force-color-profile=srgb'
				]
			} as PuppeteerOptions
		})
	}
	return cluster
}

function isUrlHostnameAllowed(url: string): boolean {
	try {
		const hostname = new URL(url).hostname
		if (!HOST_WHITELIST.length) {
			return true
		}
		return HOST_WHITELIST.some(
			allowed => hostname === allowed || hostname.endsWith(`.${allowed}`)
		)
	} catch {
		return false
	}
}

async function takeScreenshot(opts: {
	url: string
	fullPage: boolean
	quality: number
	type: 'png' | 'webp' | 'jpeg'
	dimensions: { width: number; height: number }
}) {
	const cluster = await getCluster()
	return cluster.execute(null, async ({ page }) => {
		await page.setUserAgent(
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
		)
		// Set authorization header for all requests
		if (AUTH_TOKEN) {
			await page.setExtraHTTPHeaders({
				Authorization: `Bearer ${AUTH_TOKEN}`
			})
		}

		// Set custom CSS to ensure consistent font rendering
		// Hide scrollbar -- not desired for screenshot
		await page.addStyleTag({
			content: `
				* {
					-webkit-print-color-adjust: exact !important;
					text-rendering: geometricprecision !important;
					-webkit-font-smoothing: antialiased !important;
					-webkit-box-sizing: border-box !important;
					-moz-box-sizing: border-box !important;
				}
			`
		})

		await page.setViewport({
			width: opts.dimensions.width,
			height: opts.dimensions.height
		})
		await page.goto(opts.url, {
			waitUntil: 'networkidle2'
		})
		return page.screenshot({
			type: opts.type,
			...(opts.type !== 'png' ? { quality: opts.quality } : {}),
			fullPage: opts.fullPage
		})
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
	const authHeader = c.req.header('Authorization')
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return c.json(
			{ error: 'Authorization header missing or invalid format' },
			401
		)
	}
	const token = authHeader.split(' ')[1]
	if (token !== AUTH_TOKEN) {
		return c.json({ error: 'Invalid token' }, 403)
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
	zValidator(
		'query',
		z.object({
			url: z.string().url(),
			fullPage: z.enum(['true', 'false']).optional().default('false'),
			quality: z.coerce.number().min(1).max(100).optional().default(100),
			type: z.enum(['png', 'webp', 'jpeg']).optional().default('png'),
			width: z.coerce.number().min(1).max(1920).optional().default(1440),
			height: z.coerce.number().min(1).max(10000).optional().default(900)
		})
	),
	async c => {
		const { url } = c.req.valid('query')

		// Prod logging
		if (!DEV_MODE) console.log('CAPTURE:', url)

		// Check if the URL's hostname is allowed
		if (!isUrlHostnameAllowed(url)) {
			return c.json(
				{
					error: `Hostname not allowed. Must be one of: ${HOST_WHITELIST.join(
						', '
					)}`
				},
				403
			)
		}

		const screenshot = await takeScreenshot({
			url,
			fullPage: c.req.valid('query').fullPage === 'true',
			quality: c.req.valid('query').quality,
			type: c.req.valid('query').type,
			dimensions: {
				width: c.req.valid('query').width,
				height: c.req.valid('query').height
			}
		})

		return new Response(screenshot, {
			headers: {
				'Content-Type': `image/${c.req.valid('query').type}`
			}
		})
	}
)

serve({
	port: PORT,
	fetch: app.fetch
})

console.log(`Screenshot service is online`)
