#!/usr/bin/env node

/**
 * Generate secure secrets for production deployment
 * Run: node scripts/generate-secrets.js
 */

const crypto = require('crypto');

function generateSecret(length = 32) {
    return crypto.randomBytes(length).toString('base64');
}

console.log('\n=== Generated Secrets for Production ===\n');
console.log('Copy these values to your Render environment variables:\n');

console.log('JWT_SECRET=');
console.log(generateSecret(32));
console.log('');

console.log('JWT_REFRESH_SECRET=');
console.log(generateSecret(32));
console.log('');

console.log('API_KEY_SECRET=');
console.log(generateSecret(32));
console.log('');

console.log('\n⚠️  IMPORTANT:');
console.log('- Keep these secrets secure and never commit them to Git');
console.log('- Use different secrets for each environment (dev, staging, prod)');
console.log('- Store them in Render\'s environment variables dashboard');
console.log('- Never share these secrets publicly\n');
