import { z } from 'zod'
import type { Page as PuppeteerPage } from 'puppeteer'
import type { Page as PuppeteerCorePage } from 'puppeteer-core'

// Environment variables
export const getHostWhitelist = () =>
	process.env.SCREENSHOT_HOST_WHITELIST?.split(',').map(h => h.trim()) || []

export const getAuthToken = () => process.env.SCREENSHOT_AUTH_TOKEN

// Query parameter schema for screenshot endpoint
export const screenshotQuerySchema = z.object({
	url: z.string().url(),
	fullPage: z.enum(['true', 'false']).optional().default('false'),
	quality: z.coerce.number().min(1).max(100).optional().default(100),
	type: z.enum(['png', 'webp', 'jpeg']).optional().default('png'),
	width: z.coerce.number().min(1).max(1920).optional().default(1440),
	height: z.coerce.number().min(1).max(10000).optional().default(900),
	waitUntil: z
		.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2'])
		.optional()
		.default('networkidle2'),
	waitForSelector: z.string().optional(),
	delay: z.coerce.number().min(0).max(30000).optional(),
	colorScheme: z.enum(['light', 'dark']).optional(),
	scrollPage: z.enum(['true', 'false']).optional().default('false'),
	waitForImages: z.enum(['true', 'false']).optional().default('false')
})

export type ScreenshotQuery = z.infer<typeof screenshotQuerySchema>

// Screenshot options type used by both implementations
export type ScreenshotOptions = {
	url: string
	fullPage: boolean
	quality: number
	type: 'png' | 'webp' | 'jpeg'
	dimensions: { width: number; height: number }
	waitUntil: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
	waitForSelector?: string
	delay?: number
	colorScheme?: 'light' | 'dark'
	scrollPage: boolean
	waitForImages: boolean
}

// Check if URL hostname is in the whitelist
export function isUrlHostnameAllowed(
	url: string,
	whitelist: string[]
): boolean {
	try {
		const hostname = new URL(url).hostname
		if (!whitelist.length) {
			return true
		}
		return whitelist.some(
			allowed => hostname === allowed || hostname.endsWith(`.${allowed}`)
		)
	} catch {
		return false
	}
}

// Convert validated query params to screenshot options
export function queryToScreenshotOptions(
	query: ScreenshotQuery
): ScreenshotOptions {
	return {
		url: query.url,
		fullPage: query.fullPage === 'true',
		quality: query.quality,
		type: query.type,
		dimensions: {
			width: query.width,
			height: query.height
		},
		waitUntil: query.waitUntil,
		waitForSelector: query.waitForSelector,
		delay: query.delay,
		colorScheme: query.colorScheme,
		scrollPage: query.scrollPage === 'true',
		waitForImages: query.waitForImages === 'true'
	}
}

// Common Chrome launch arguments for consistent rendering
export const CHROME_ARGS = [
	'--no-sandbox',
	'--disable-setuid-sandbox',
	'--font-render-hinting=none',
	'--disable-font-subpixel-positioning',
	'--force-color-profile=srgb'
]

// User agent string
export const USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'

// CSS for consistent font rendering
export const SCREENSHOT_CSS = `
	* {
		-webkit-print-color-adjust: exact !important;
		text-rendering: geometricprecision !important;
		-webkit-font-smoothing: antialiased !important;
	}
`

// Page type from either puppeteer or puppeteer-core (both have same runtime API)
export type Page = PuppeteerPage | PuppeteerCorePage

// Capture screenshot using a page instance (shared logic for both implementations)
// Uses PuppeteerCorePage internally since both packages have identical runtime APIs
export async function captureScreenshot(
	page: Page,
	opts: ScreenshotOptions,
	authToken?: string
): Promise<Uint8Array> {
	// Cast to PuppeteerCorePage to avoid union type signature conflicts
	// Both puppeteer and puppeteer-core have identical APIs at runtime
	const p = page as PuppeteerCorePage

	// Use string format for compatibility with both puppeteer and puppeteer-core
	await p.setUserAgent(USER_AGENT)

	// Set authorization header for all requests
	if (authToken) {
		await p.setExtraHTTPHeaders({
			Authorization: `Bearer ${authToken}`
		})
	}

	await p.setViewport({
		width: opts.dimensions.width,
		height: opts.dimensions.height
	})

	// Emulate color scheme so sites render in light or dark mode accordingly
	if (opts.colorScheme) {
		await p.emulateMediaFeatures([
			{ name: 'prefers-color-scheme', value: opts.colorScheme }
		])
	}

	await p.goto(opts.url, {
		waitUntil: opts.waitUntil
	})

	// Set custom CSS to ensure consistent font rendering
	await p.addStyleTag({
		content: SCREENSHOT_CSS
	})

	if (opts.scrollPage || opts.waitForImages) {
		const SCROLL_AND_WAIT_BUDGET_MS = 20_000

		await Promise.race([
			(async () => {
				if (opts.scrollPage) {
					await p.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' })
					await p.evaluate(async () => {
						const MAX_STEPS = 100
						const MAX_MS = 15_000
						const start = Date.now()
						const elapsed = () => Date.now() - start

						document.querySelectorAll('img[loading="lazy"]').forEach(i => {
							i.removeAttribute('loading')
						})
						document.querySelectorAll('img[decoding="async"]').forEach(i => {
							;(i as HTMLImageElement).decoding = 'sync'
						})

						const vh = window.innerHeight
						let y = 0
						let steps = 0

						while (y < document.documentElement.scrollHeight && steps < MAX_STEPS && elapsed() < MAX_MS - 5_000) {
							y += Math.floor(vh / 2)
							window.scrollTo(0, y)
							steps++
							await new Promise(r => setTimeout(r, 150))
						}

						window.scrollTo(0, document.documentElement.scrollHeight)
						await new Promise(r => setTimeout(r, 200))

						const style = document.createElement('style')
						style.textContent = '*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }'
						document.head.appendChild(style)
						window.scrollTo(0, 0)
						await new Promise(r => setTimeout(r, 200))
					})
				}

				if (opts.waitForImages) {
					await p.evaluate(async () => {
						const MAX_MS = 10_000
						const start = Date.now()
						const elapsed = () => Date.now() - start

						const imgs = Array.from(document.querySelectorAll('img'))
						const pending = imgs.filter(i => !(i.complete && i.naturalWidth > 0))
						if (pending.length) {
							const perImageTimeout = Math.min(MAX_MS, Math.max(0, MAX_MS - elapsed()))
							await Promise.all(
								pending.map(
									i =>
										new Promise<void>(resolve => {
											if (i.complete && i.naturalWidth > 0) return resolve()
											let done = false
											const finish = () => {
												if (!done) {
													done = true
													resolve()
												}
											}
											i.addEventListener('load', finish, { once: true })
											i.addEventListener('error', finish, { once: true })
											setTimeout(finish, perImageTimeout)
										})
								)
							)
						}

						await new Promise(r => setTimeout(r, 500))
					})
				}
			})(),
			new Promise<void>(resolve => setTimeout(resolve, SCROLL_AND_WAIT_BUDGET_MS))
		])
	}

	// Wait for specific selector if provided
	if (opts.waitForSelector) {
		await p.waitForSelector(opts.waitForSelector, { timeout: 30000 })
	}

	// Wait for fonts to load
	await p.evaluateHandle('document.fonts.ready')

	// Additional delay if specified
	if (opts.delay) {
		await new Promise(resolve => setTimeout(resolve, opts.delay))
	}

	const screenshot = await p.screenshot({
		type: opts.type,
		...(opts.type !== 'png' ? { quality: opts.quality } : {}),
		fullPage: opts.fullPage
	})

	return screenshot as Uint8Array
}

// Auth validation result type
export type AuthResult =
	| { valid: true }
	| { valid: false; error: string; status: 401 | 403 }

// Validate Bearer token from Authorization header
export function validateBearerToken(
	authHeader: string | null | undefined,
	expectedToken: string
): AuthResult {
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return {
			valid: false,
			error: 'Authorization header missing or invalid format',
			status: 401
		}
	}
	const token = authHeader.split(' ')[1]
	if (token !== expectedToken) {
		return { valid: false, error: 'Invalid token', status: 403 }
	}
	return { valid: true }
}
