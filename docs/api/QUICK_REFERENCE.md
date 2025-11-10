# API Quick Reference

## Base URL
```
https://api.urlshortener.com
```

## Authentication
```
Authorization: Bearer <access_token>
```

## Rate Limits

| Tier | Requests/Minute |
|------|-----------------|
| Anonymous | 100 |
| Standard | 1,000 |
| Premium | 5,000 |
| Enterprise | 20,000 |

## Quick Examples

### Shorten URL
```bash
POST /api/v1/url/shorten
{
  "longUrl": "https://example.com/page",
  "customAlias": "mypage",      # Optional
  "expiresAt": "2024-12-31T23:59:59Z"  # Optional
}
```

### Get All URLs
```bash
GET /api/v1/url/get-all?page=1&limit=20&status=all
```

### Get Analytics
```bash
GET /api/v1/analytics/{shortCode}?startDate=2024-11-01T00:00:00Z&endDate=2024-11-09T23:59:59Z
```

### Delete URL
```bash
DELETE /api/v1/url/{shortCode}
```

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-11-09T10:30:00Z"
}
```

### Error
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Error description",
  "timestamp": "2024-11-09T10:30:00Z"
}
```

## Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| VALIDATION_ERROR | 400 | Invalid parameters |
| UNAUTHORIZED | 401 | Auth required |
| FORBIDDEN | 403 | No permission |
| NOT_FOUND | 404 | Resource not found |
| ALIAS_TAKEN | 409 | Alias in use |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |

## Endpoints Summary

### Authentication
- `POST /api/v1/auth/register` - Register user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh-token` - Refresh token
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/profile` - Get profile

### URL Management
- `POST /api/v1/url/shorten` - Create short URL
- `GET /api/v1/url/get-all` - List all URLs
- `GET /api/v1/url/{shortCode}/stats` - Get stats
- `GET /api/v1/url/check-alias` - Check alias
- `DELETE /api/v1/url/{shortCode}` - Delete URL

### Redirect
- `GET /{shortCode}` - Redirect to long URL

### Analytics
- `GET /api/v1/analytics/{shortCode}` - Detailed analytics
- `GET /api/v1/analytics/{shortCode}/realtime` - Real-time data
- `GET /api/v1/analytics/global/summary` - Global summary

### Preferences
- `GET /api/v1/preferences/preferences` - Get preferences
- `PUT /api/v1/preferences/preferences` - Update preferences

### Health
- `GET /health` - Health check
