import http from 'http';
import https from 'https';

/**
 * HTTP/HTTPS agents with connection pooling for better performance
 * Reuses connections instead of creating new ones for each request
 */

export const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000, // 30 seconds
  maxSockets: 50, // Max concurrent connections
  maxFreeSockets: 10,
  timeout: 60000, // 60 seconds
});

export const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
});

/**
 * Get the appropriate agent for a URL
 * @param url URL to fetch
 * @returns HTTP or HTTPS agent
 */
export function getAgentForUrl(url: string): http.Agent | https.Agent {
  return url.startsWith('https:') ? httpsAgent : httpAgent;
}
