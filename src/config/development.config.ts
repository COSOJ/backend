// Development configuration for cache control
export const developmentConfig = {
  // Disable all caching in development to prevent 304, and related responses
  cache: {
    enabled: false,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    }
  },
  
  // Disable ETag generation
  etag: false,
  
  // Force fresh responses for debugging
  forceFresh: true
};