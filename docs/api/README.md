# URL Shortener API Documentation

## Overview

The URL Shortener API provides a comprehensive set of endpoints for creating, managing, and analyzing shortened URLs. This documentation includes detailed information about authentication, rate limiting, and code examples in multiple programming languages.

## Base URL

```
Production: https://api.urlshortener.com
Staging:    https://staging-api.urlshortener.com
Local:      http://localhost:3000
```

## Quick Start

### 1. Register an Account

```bash
curl -X POST https://api.urlshortener.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "John Doe"
  }'
```

### 2. Shorten a URL

```bash
curl -X POST https://api.urlshortener.com/api/v1/url/shorten \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "longUrl": "https://example.com/very/long/url/path"
  }'
```

### 3. Access Your Short URL

```bash
curl https://short.ly/abc123
# Redirects to: https://example.com/very/long/url/path
```

## Authentication

The API uses JWT (JSON Web Token) for authentication. Include your access token in the Authorization header:

```
Authorization: Bearer <your_access_token>
```

### Token Lifecycle

- **Access Token**: Valid for 15 minutes
- **Refresh Token**: Valid for 7 days
- Use the refresh token to obtain a new access token without re-authenticating

### Example: Refresh Token

```bash
curl -X POST https://api.urlshortener.com/api/v1/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```


## Rate Limiting

The API implements token bucket rate limiting to ensure fair usage:

| User Tier   | Requests/Minute | Daily Limit |
|-------------|-----------------|-------------|
| Anonymous   | 100             | 144,000     |
| Standard    | 1,000           | 1,440,000   |
| Premium     | 5,000           | 7,200,000   |
| Enterprise  | 20,000          | 28,800,000  |

### Rate Limit Headers

Every API response includes rate limit information:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 2024-11-09T10:31:00Z
```

When rate limited (HTTP 429):

```
Retry-After: 45
```

### Handling Rate Limits

```javascript
// JavaScript example with retry logic
async function makeRequest(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }
    
    return response;
  }
  throw new Error('Max retries exceeded');
}
```

## Code Examples

### JavaScript/Node.js

#### Shorten a URL

```javascript
const axios = require('axios');

async function shortenUrl(longUrl, accessToken) {
  try {
    const response = await axios.post(
      'https://api.urlshortener.com/api/v1/url/shorten',
      {
        longUrl: longUrl,
        customAlias: 'myproduct', // Optional
        expiresAt: '2024-12-31T23:59:59Z' // Optional
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    console.log('Short URL:', response.data.data.shortUrl);
    return response.data.data;
  } catch (error) {
    if (error.response?.status === 429) {
      console.error('Rate limit exceeded');
    } else {
      console.error('Error:', error.response?.data?.message);
    }
    throw error;
  }
}

// Usage
shortenUrl('https://example.com/page', 'YOUR_ACCESS_TOKEN');
```

#### Get Analytics

```javascript
async function getAnalytics(shortCode, accessToken) {
  const response = await axios.get(
    `https://api.urlshortener.com/api/v1/analytics/${shortCode}`,
    {
      params: {
        startDate: '2024-11-01T00:00:00Z',
        endDate: '2024-11-09T23:59:59Z',
        granularity: 'day'
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  return response.data.data;
}
```


### Python

#### Shorten a URL

```python
import requests
from datetime import datetime, timedelta

def shorten_url(long_url, access_token, custom_alias=None, expires_days=None):
    """
    Shorten a URL using the API
    
    Args:
        long_url: The URL to shorten
        access_token: JWT access token
        custom_alias: Optional custom alias
        expires_days: Optional expiration in days
    
    Returns:
        dict: Response data with short URL
    """
    url = 'https://api.urlshortener.com/api/v1/url/shorten'
    
    payload = {'longUrl': long_url}
    
    if custom_alias:
        payload['customAlias'] = custom_alias
    
    if expires_days:
        expires_at = datetime.utcnow() + timedelta(days=expires_days)
        payload['expiresAt'] = expires_at.isoformat() + 'Z'
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {access_token}'
    }
    
    response = requests.post(url, json=payload, headers=headers)
    
    if response.status_code == 429:
        retry_after = int(response.headers.get('Retry-After', 60))
        raise Exception(f'Rate limited. Retry after {retry_after} seconds')
    
    response.raise_for_status()
    return response.json()['data']

# Usage
try:
    result = shorten_url(
        'https://example.com/page',
        'YOUR_ACCESS_TOKEN',
        custom_alias='mypage',
        expires_days=30
    )
    print(f"Short URL: {result['shortUrl']}")
except Exception as e:
    print(f"Error: {e}")
```

#### Get All URLs with Pagination

```python
def get_all_urls(access_token, page=1, limit=20, status='all'):
    """
    Get all shortened URLs for the authenticated user
    
    Args:
        access_token: JWT access token
        page: Page number (1-indexed)
        limit: Items per page
        status: Filter by status (all, active, expired)
    
    Returns:
        dict: URLs and pagination info
    """
    url = 'https://api.urlshortener.com/api/v1/url/get-all'
    
    params = {
        'page': page,
        'limit': limit,
        'status': status,
        'sortBy': 'createdAt',
        'sortOrder': 'desc'
    }
    
    headers = {'Authorization': f'Bearer {access_token}'}
    
    response = requests.get(url, params=params, headers=headers)
    response.raise_for_status()
    
    return response.json()['data']

# Usage
data = get_all_urls('YOUR_ACCESS_TOKEN', page=1, limit=50)
print(f"Total URLs: {data['pagination']['total']}")
for url in data['urls']:
    print(f"{url['shortCode']}: {url['longUrl']} ({url['clickCount']} clicks)")
```


### cURL

#### Register and Login

```bash
# Register
curl -X POST https://api.urlshortener.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "John Doe"
  }'

# Login
curl -X POST https://api.urlshortener.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

#### Create Short URL with Custom Alias

```bash
curl -X POST https://api.urlshortener.com/api/v1/url/shorten \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "longUrl": "https://example.com/product/12345",
    "customAlias": "product12345",
    "expiresAt": "2024-12-31T23:59:59Z"
  }'
```

#### Check Alias Availability

```bash
curl -X GET "https://api.urlshortener.com/api/v1/url/check-alias?alias=myproduct" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Get URL Statistics

```bash
curl -X GET https://api.urlshortener.com/api/v1/url/abc123/stats \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Get Detailed Analytics

```bash
curl -X GET "https://api.urlshortener.com/api/v1/analytics/abc123?startDate=2024-11-01T00:00:00Z&endDate=2024-11-09T23:59:59Z&granularity=day" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Delete a URL

```bash
curl -X DELETE https://api.urlshortener.com/api/v1/url/abc123 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### PHP

#### Shorten a URL

```php
<?php

function shortenUrl($longUrl, $accessToken, $customAlias = null, $expiresAt = null) {
    $url = 'https://api.urlshortener.com/api/v1/url/shorten';
    
    $data = ['longUrl' => $longUrl];
    
    if ($customAlias) {
        $data['customAlias'] = $customAlias;
    }
    
    if ($expiresAt) {
        $data['expiresAt'] = $expiresAt;
    }
    
    $options = [
        'http' => [
            'header'  => [
                "Content-Type: application/json",
                "Authorization: Bearer $accessToken"
            ],
            'method'  => 'POST',
            'content' => json_encode($data)
        ]
    ];
    
    $context  = stream_context_create($options);
    $result = file_get_contents($url, false, $context);
    
    if ($result === FALSE) {
        throw new Exception('Error shortening URL');
    }
    
    $response = json_decode($result, true);
    return $response['data'];
}

// Usage
try {
    $result = shortenUrl(
        'https://example.com/page',
        'YOUR_ACCESS_TOKEN',
        'mypage',
        '2024-12-31T23:59:59Z'
    );
    echo "Short URL: " . $result['shortUrl'] . "\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

?>
```


### Go

#### Shorten a URL

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
    "time"
)

type ShortenRequest struct {
    LongUrl      string  `json:"longUrl"`
    CustomAlias  *string `json:"customAlias,omitempty"`
    ExpiresAt    *string `json:"expiresAt,omitempty"`
}

type ShortenResponse struct {
    Success   bool      `json:"success"`
    Data      ShortUrl  `json:"data"`
    Timestamp time.Time `json:"timestamp"`
}

type ShortUrl struct {
    ShortCode     string    `json:"shortCode"`
    ShortUrl      string    `json:"shortUrl"`
    LongUrl       string    `json:"longUrl"`
    CreatedAt     time.Time `json:"createdAt"`
    ExpiresAt     *time.Time `json:"expiresAt"`
    IsCustomAlias bool      `json:"isCustomAlias"`
}

func shortenUrl(longUrl, accessToken string, customAlias *string) (*ShortUrl, error) {
    url := "https://api.urlshortener.com/api/v1/url/shorten"
    
    reqBody := ShortenRequest{
        LongUrl:     longUrl,
        CustomAlias: customAlias,
    }
    
    jsonData, err := json.Marshal(reqBody)
    if err != nil {
        return nil, err
    }
    
    req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, err
    }
    
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+accessToken)
    
    client := &http.Client{Timeout: 10 * time.Second}
    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode == 429 {
        retryAfter := resp.Header.Get("Retry-After")
        return nil, fmt.Errorf("rate limited, retry after %s seconds", retryAfter)
    }
    
    body, err := ioutil.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }
    
    var response ShortenResponse
    err = json.Unmarshal(body, &response)
    if err != nil {
        return nil, err
    }
    
    return &response.Data, nil
}

func main() {
    alias := "mypage"
    result, err := shortenUrl(
        "https://example.com/page",
        "YOUR_ACCESS_TOKEN",
        &alias,
    )
    
    if err != nil {
        fmt.Printf("Error: %v\n", err)
        return
    }
    
    fmt.Printf("Short URL: %s\n", result.ShortUrl)
}
```


### Ruby

#### Shorten a URL

```ruby
require 'net/http'
require 'json'
require 'uri'

def shorten_url(long_url, access_token, custom_alias: nil, expires_at: nil)
  uri = URI('https://api.urlshortener.com/api/v1/url/shorten')
  
  payload = { longUrl: long_url }
  payload[:customAlias] = custom_alias if custom_alias
  payload[:expiresAt] = expires_at if expires_at
  
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  
  request = Net::HTTP::Post.new(uri.path)
  request['Content-Type'] = 'application/json'
  request['Authorization'] = "Bearer #{access_token}"
  request.body = payload.to_json
  
  response = http.request(request)
  
  if response.code == '429'
    retry_after = response['Retry-After']
    raise "Rate limited. Retry after #{retry_after} seconds"
  end
  
  raise "Error: #{response.body}" unless response.is_a?(Net::HTTPSuccess)
  
  JSON.parse(response.body)['data']
end

# Usage
begin
  result = shorten_url(
    'https://example.com/page',
    'YOUR_ACCESS_TOKEN',
    custom_alias: 'mypage',
    expires_at: '2024-12-31T23:59:59Z'
  )
  puts "Short URL: #{result['shortUrl']}"
rescue => e
  puts "Error: #{e.message}"
end
```

## Common Use Cases

### 1. Bulk URL Shortening

```python
import requests
import time

def bulk_shorten_urls(urls, access_token):
    """Shorten multiple URLs with rate limit handling"""
    results = []
    
    for url in urls:
        try:
            result = shorten_url(url, access_token)
            results.append(result)
            print(f"✓ Shortened: {url} -> {result['shortUrl']}")
        except Exception as e:
            if '429' in str(e):
                # Rate limited, wait and retry
                time.sleep(60)
                result = shorten_url(url, access_token)
                results.append(result)
            else:
                print(f"✗ Failed: {url} - {e}")
                results.append(None)
    
    return results

# Usage
urls = [
    'https://example.com/page1',
    'https://example.com/page2',
    'https://example.com/page3'
]
results = bulk_shorten_urls(urls, 'YOUR_ACCESS_TOKEN')
```

### 2. Custom Branded Links

```javascript
async function createBrandedLink(longUrl, brandName, accessToken) {
  // Generate a branded alias
  const alias = `${brandName}-${Date.now()}`.toLowerCase();
  
  const response = await axios.post(
    'https://api.urlshortener.com/api/v1/url/shorten',
    {
      longUrl: longUrl,
      customAlias: alias
    },
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );
  
  return response.data.data.shortUrl;
}

// Usage
const brandedUrl = await createBrandedLink(
  'https://example.com/campaign',
  'summer2024',
  'YOUR_ACCESS_TOKEN'
);
```


### 3. Temporary Campaign Links

```python
from datetime import datetime, timedelta

def create_campaign_link(long_url, campaign_name, duration_days, access_token):
    """Create a temporary link for a marketing campaign"""
    expires_at = datetime.utcnow() + timedelta(days=duration_days)
    
    result = shorten_url(
        long_url,
        access_token,
        custom_alias=campaign_name,
        expires_days=duration_days
    )
    
    print(f"Campaign: {campaign_name}")
    print(f"Short URL: {result['shortUrl']}")
    print(f"Expires: {expires_at.strftime('%Y-%m-%d')}")
    
    return result

# Usage - Create a 7-day campaign link
create_campaign_link(
    'https://example.com/black-friday-sale',
    'blackfriday2024',
    7,
    'YOUR_ACCESS_TOKEN'
)
```

### 4. Analytics Dashboard

```javascript
async function getUrlDashboard(shortCode, accessToken) {
  // Get basic stats
  const statsResponse = await axios.get(
    `https://api.urlshortener.com/api/v1/url/${shortCode}/stats`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  
  // Get detailed analytics
  const analyticsResponse = await axios.get(
    `https://api.urlshortener.com/api/v1/analytics/${shortCode}`,
    {
      params: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        granularity: 'day'
      },
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );
  
  return {
    stats: statsResponse.data.data,
    analytics: analyticsResponse.data.data
  };
}

// Usage
const dashboard = await getUrlDashboard('abc123', 'YOUR_ACCESS_TOKEN');
console.log(`Total Clicks: ${dashboard.analytics.summary.totalClicks}`);
console.log(`Unique Visitors: ${dashboard.analytics.summary.uniqueVisitors}`);
console.log(`Top Country: ${dashboard.analytics.geographicDistribution[0].country}`);
```

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    "field": "Additional error details"
  },
  "timestamp": "2024-11-09T10:30:00Z"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Authentication required or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `ALIAS_TAKEN` | 409 | Custom alias already in use |
| `URL_EXPIRED` | 410 | Short URL has expired |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

### Error Handling Example

```javascript
async function handleApiCall(apiFunction) {
  try {
    return await apiFunction();
  } catch (error) {
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          console.error('Validation error:', data.details);
          break;
        case 401:
          console.error('Authentication failed. Please login again.');
          // Redirect to login
          break;
        case 403:
          console.error('Access denied:', data.message);
          break;
        case 404:
          console.error('Resource not found');
          break;
        case 409:
          console.error('Conflict:', data.message);
          // Suggest alternative alias
          break;
        case 429:
          const retryAfter = error.response.headers['retry-after'];
          console.error(`Rate limited. Retry after ${retryAfter} seconds`);
          // Implement exponential backoff
          break;
        case 500:
          console.error('Server error. Please try again later.');
          break;
        default:
          console.error('Unexpected error:', data.message);
      }
    } else {
      console.error('Network error:', error.message);
    }
    throw error;
  }
}
```


## WebSocket Real-Time Analytics

For real-time click tracking, connect to the WebSocket endpoint:

```
wss://api.urlshortener.com/ws
```

### JavaScript WebSocket Example

```javascript
const WebSocket = require('ws');

function connectToAnalytics(shortCode, accessToken) {
  const ws = new WebSocket('wss://api.urlshortener.com/ws', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  ws.on('open', () => {
    console.log('Connected to WebSocket');
    
    // Subscribe to click events for specific URL
    ws.send(JSON.stringify({
      action: 'subscribe',
      shortCode: shortCode
    }));
  });
  
  ws.on('message', (data) => {
    const event = JSON.parse(data);
    
    if (event.type === 'click') {
      console.log('New click:', {
        timestamp: event.timestamp,
        country: event.country,
        device: event.device,
        browser: event.browser
      });
      
      // Update your UI with real-time data
      updateClickCounter(event.shortCode);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    // Implement reconnection logic
  });
  
  return ws;
}

// Usage
const ws = connectToAnalytics('abc123', 'YOUR_ACCESS_TOKEN');

// Unsubscribe when done
setTimeout(() => {
  ws.send(JSON.stringify({
    action: 'unsubscribe',
    shortCode: 'abc123'
  }));
  ws.close();
}, 60000);
```

## Best Practices

### 1. Token Management

```javascript
class ApiClient {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }
  
  async ensureValidToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.refreshAccessToken();
    }
  }
  
  async refreshAccessToken() {
    const response = await axios.post(
      'https://api.urlshortener.com/api/v1/auth/refresh-token',
      { refreshToken: this.refreshToken }
    );
    
    this.accessToken = response.data.data.accessToken;
    this.tokenExpiry = Date.now() + (response.data.data.expiresIn * 1000);
  }
  
  async makeRequest(url, options = {}) {
    await this.ensureValidToken();
    
    return axios({
      url,
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`
      }
    });
  }
}
```

### 2. Retry Logic with Exponential Backoff

```python
import time
import random

def make_request_with_retry(func, max_retries=3):
    """Make API request with exponential backoff"""
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if '429' in str(e) and attempt < max_retries - 1:
                # Exponential backoff with jitter
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                print(f"Rate limited. Waiting {wait_time:.2f}s before retry...")
                time.sleep(wait_time)
            else:
                raise
    
    raise Exception("Max retries exceeded")
```

### 3. Batch Operations

```javascript
async function batchShortenUrls(urls, accessToken, batchSize = 10) {
  const results = [];
  
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    
    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(url => 
        shortenUrl(url, accessToken).catch(err => ({ error: err.message }))
      )
    );
    
    results.push(...batchResults);
    
    // Rate limit friendly delay between batches
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}
```

### 4. Caching Responses

```python
from functools import lru_cache
import time

@lru_cache(maxsize=100)
def get_url_stats_cached(short_code, access_token, cache_time):
    """Cache URL stats for 5 minutes"""
    return get_url_stats(short_code, access_token)

# Usage with cache invalidation
def get_stats_with_cache(short_code, access_token):
    # Cache key includes current 5-minute window
    cache_key = int(time.time() / 300)
    return get_url_stats_cached(short_code, access_token, cache_key)
```


## Testing

### Using Postman

1. Import the OpenAPI specification: `docs/api/openapi.yaml`
2. Set up environment variables:
   - `base_url`: https://api.urlshortener.com
   - `access_token`: Your JWT token
3. Use the pre-configured requests

### Using Swagger UI

Visit the interactive API documentation:
```
https://api.urlshortener.com/docs
```

### Integration Tests

```javascript
const assert = require('assert');

describe('URL Shortener API', () => {
  let accessToken;
  let shortCode;
  
  before(async () => {
    // Login and get access token
    const response = await axios.post(
      'https://api.urlshortener.com/api/v1/auth/login',
      {
        email: 'test@example.com',
        password: 'TestPass123!'
      }
    );
    accessToken = response.data.data.accessToken;
  });
  
  it('should shorten a URL', async () => {
    const response = await axios.post(
      'https://api.urlshortener.com/api/v1/url/shorten',
      { longUrl: 'https://example.com/test' },
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    assert.strictEqual(response.status, 201);
    assert.ok(response.data.data.shortCode);
    shortCode = response.data.data.shortCode;
  });
  
  it('should redirect to original URL', async () => {
    const response = await axios.get(
      `https://short.ly/${shortCode}`,
      { maxRedirects: 0, validateStatus: status => status === 301 }
    );
    
    assert.strictEqual(response.status, 301);
    assert.ok(response.headers.location);
  });
  
  it('should get URL analytics', async () => {
    const response = await axios.get(
      `https://api.urlshortener.com/api/v1/analytics/${shortCode}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    assert.strictEqual(response.status, 200);
    assert.ok(response.data.data.summary);
  });
});
```

## Support

### Documentation
- OpenAPI Spec: `docs/api/openapi.yaml`
- Interactive Docs: https://api.urlshortener.com/docs

### Contact
- Email: support@urlshortener.com
- GitHub Issues: https://github.com/urlshortener/api/issues

### Status Page
Monitor API status and uptime: https://status.urlshortener.com

## Changelog

### v1.0.0 (2024-11-09)
- Initial API release
- URL shortening with custom aliases
- Analytics and click tracking
- User authentication and preferences
- Rate limiting implementation
- WebSocket real-time updates

## License

MIT License - See LICENSE file for details
