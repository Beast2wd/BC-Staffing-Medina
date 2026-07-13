/**
 * Tenant detection utilities for subdomain-based routing
 */

/**
 * Extract subdomain from current URL
 * Examples:
 * - medina.bcstaffing.com -> "medina"
 * - app.bcstaffing.com -> null (main app, no tenant)
 * - bcstaffing.com -> null (root domain)
 * - localhost:3000 -> null (development)
 * - preview.emergentagent.com -> null (preview environment)
 * 
 * @returns {string|null} The subdomain or null if not applicable
 */
export function getSubdomain() {
  const hostname = window.location.hostname;
  
  // Skip subdomain detection for development/preview environments
  const skipDomains = [
    'localhost',
    '127.0.0.1',
    'preview.emergentagent.com',
    'emergentagent.com'
  ];
  
  if (skipDomains.some(domain => hostname.includes(domain))) {
    // Check localStorage for manual tenant override (useful for testing)
    return localStorage.getItem('tenant_subdomain') || null;
  }
  
  // Split hostname into parts
  const parts = hostname.split('.');
  
  // For bcstaffing.com or www.bcstaffing.com, no subdomain
  if (parts.length <= 2) {
    return null;
  }
  
  // For subdomain.bcstaffing.com, extract subdomain
  // Ignore 'www', 'app', 'admin' as they're not tenant subdomains
  const subdomain = parts[0].toLowerCase();
  const reservedSubdomains = ['www', 'app', 'admin', 'api', 'mail', 'smtp'];
  
  if (reservedSubdomains.includes(subdomain)) {
    return null;
  }
  
  return subdomain;
}

/**
 * Get the full tenant domain URL
 * @param {string} subdomain - The tenant subdomain
 * @returns {string} Full URL for the tenant
 */
export function getTenantUrl(subdomain) {
  const protocol = window.location.protocol;
  const baseDomain = getBaseDomain();
  return `${protocol}//${subdomain}.${baseDomain}`;
}

/**
 * Get the base domain (e.g., bcstaffing.com)
 * @returns {string} Base domain
 */
export function getBaseDomain() {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  
  // For localhost or preview, return as-is
  if (hostname.includes('localhost') || hostname.includes('emergentagent.com')) {
    return hostname;
  }
  
  // Return last two parts (e.g., bcstaffing.com)
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  
  return hostname;
}

/**
 * Check if we're in a multi-tenant subdomain context
 * @returns {boolean}
 */
export function isSubdomainContext() {
  return getSubdomain() !== null;
}

/**
 * Set manual tenant subdomain (for testing/development)
 * @param {string|null} subdomain 
 */
export function setManualSubdomain(subdomain) {
  if (subdomain) {
    localStorage.setItem('tenant_subdomain', subdomain);
  } else {
    localStorage.removeItem('tenant_subdomain');
  }
}

/**
 * Clear manual tenant subdomain
 */
export function clearManualSubdomain() {
  localStorage.removeItem('tenant_subdomain');
}
