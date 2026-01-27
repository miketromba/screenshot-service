/**
 * Vercel serverless function handler for screenshot service.
 *
 * Usage in your Vercel project:
 *
 * ```ts
 * // api/screenshot.ts (or app/api/screenshot/route.ts for Next.js App Router)
 * export { GET } from '@miketromba/screenshot-service/vercel'
 * ```
 */

import type { Browser, Page } from 'puppeteer-core'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
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

// Cache browser instance for warm invocations
let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
	if (browser) {
		return browser
	}

	browser = await puppeteer.launch({
		args: [...chromium.args, ...CHROME_ARGS],
		defaultViewport: null,
		executablePath: await chromium.executablePath(),
		headless: true
	})

	return browser
}

async function takeScreenshot(
	opts: Parameters<typeof captureScreenshot>[1],
	authToken?: string
): Promise<Uint8Array> {
	const browser = await getBrowser()
	const page: Page = await browser.newPage()

	try {
		return await captureScreenshot(page, opts, authToken)
	} finally {
		await page.close()
	}
}

/**
 * GET handler for Vercel serverless functions.
 * Re-export this from your API route.
 */
export async function GET(request: Request): Promise<Response> {
	const url = new URL(request.url)
	const params = Object.fromEntries(url.searchParams.entries())

	// Validate query parameters
	const result = screenshotQuerySchema.safeParse(params)
	if (!result.success) {
		return Response.json(
			{
				error: 'Invalid query parameters',
				details: result.error.flatten()
			},
			{ status: 400 }
		)
	}

	const query = result.data
	const authToken = getAuthToken()
	const hostWhitelist = getHostWhitelist()

	// Check authentication if SCREENSHOT_AUTH_TOKEN is set
	if (authToken) {
		const authResult = validateBearerToken(
			request.headers.get('Authorization'),
			authToken
		)
		if (authResult.valid === false) {
			return Response.json(
				{ error: authResult.error },
				{ status: authResult.status }
			)
		}
	}

	// Check if the URL's hostname is allowed
	if (!isUrlHostnameAllowed(query.url, hostWhitelist)) {
		return Response.json(
			{
				error: `Hostname not allowed. Must be one of: ${hostWhitelist.join(', ')}`
			},
			{ status: 403 }
		)
	}

	console.log('CAPTURE:', query.url)

	try {
		const opts = queryToScreenshotOptions(query)
		const screenshot = await takeScreenshot(opts, authToken)

		return new Response(Buffer.from(screenshot), {
			headers: {
				'Content-Type': `image/${query.type}`
			}
		})
	} catch (error) {
		console.error('Screenshot error:', error)
		return Response.json(
			{
				error: 'Failed to capture screenshot',
				message:
					error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
