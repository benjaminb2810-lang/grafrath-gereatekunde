/**
 * Vercel Speed Insights initialization
 * This file imports and initializes Speed Insights for the static HTML site
 */
import { injectSpeedInsights } from './node_modules/@vercel/speed-insights/dist/index.mjs';

// Initialize Speed Insights
injectSpeedInsights({
  debug: true // Enable debug mode in development
});
