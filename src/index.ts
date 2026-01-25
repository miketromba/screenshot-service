// Main package exports - shared utilities, types, and schemas
export {
	// Schema and types
	screenshotQuerySchema,
	type ScreenshotQuery,
	type ScreenshotOptions,
	type AuthResult,
	type Page,

	// Utilities
	getHostWhitelist,
	getAuthToken,
	isUrlHostnameAllowed,
	queryToScreenshotOptions,
	validateBearerToken,
	captureScreenshot,

	// Constants
	CHROME_ARGS,
	USER_AGENT,
	SCREENSHOT_CSS
} from './shared'
