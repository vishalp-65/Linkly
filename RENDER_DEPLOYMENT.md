# Render Deployment Guide

## Quick Setup

1. **Connect your repository to Render**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Web Service"
   - Connect your Git repository

2. **Configure the service**
   
   Use these settings in the Render dashboard:

   - **Name**: url-shortener (or your preferred name)
   - **Environment**: Node
   - **Region**: Choose your preferred region
   - **Branch**: main (or your default branch)
   - **Root Directory**: Leave EMPTY or set to `.` (NOT `src`)
   - **Build Command**: `npm install --include=dev && npm run build && npm prune --production`
   - **Start Command**: `node dist/server.js`

3. **Add Environment Variables**
   
   In the Render dashboard, add these environment variables:
   
   **Required:**
   - `NODE_ENV` = `production`
   - `HOST` = `0.0.0.0` (Important: Must bind to all interfaces for Render)
   - `DB_HOST` = Your PostgreSQL host
   - `DB_PORT` = `5432`
   - `DB_NAME` = Your database name
   - `DB_USER` = Your database user
   - `DB_PASSWORD` = Your database password
   - `REDIS_HOST` = Your Redis host
   - `REDIS_PORT` = `6379`
   - `REDIS_PASSWORD` = Your Redis password (if required)
   - `JWT_SECRET` = Generate a strong 32+ character secret
   - `JWT_REFRESH_SECRET` = Generate a strong 32+ character secret
   - `API_KEY_SECRET` = Generate a strong 32+ character secret
   
   **Optional:**
   - `KAFKA_BROKERS` = Leave empty or omit if not using Kafka
   - `PORT` = Render sets this automatically, no need to configure

## Alternative: Using render.yaml

If you prefer infrastructure-as-code, the `render.yaml` file in the root directory will automatically configure your service. Just:

1. Push the `render.yaml` file to your repository
2. In Render dashboard, select "New +" → "Blueprint"
3. Connect your repository
4. Render will read the configuration from `render.yaml`

## Troubleshooting

### Error: Cannot find module '/opt/render/project/dist/server.js' or '/opt/render/project/src/dist/server.js'

This happens when the root directory or start command path is wrong. Make sure:
- **Root Directory** in Render dashboard is EMPTY or set to `.` (NOT `src`)
- Build command is: `npm install --include=dev && npm run build && npm prune --production`
- Start command is: `node dist/server.js` (NOT `node ../dist/server.js` or `node src/dist/server.js`)

If you see `/opt/render/project/src/dist/server.js` in the error, it means your Root Directory is set to `src` - change it to `.` or leave it empty.

### Error: No open ports detected on 0.0.0.0

This means your app is binding to `localhost` instead of `0.0.0.0`. Make sure:
- Set environment variable `HOST` = `0.0.0.0` in Render dashboard
- Or the app will default to `0.0.0.0` when `NODE_ENV=production`

### Module not found errors after deployment

Make sure all dependencies are in `dependencies` (not `devDependencies`) in package.json, especially:
- `typescript` should be in `devDependencies` (it is)
- All runtime dependencies should be in `dependencies`

### Database connection issues

Render provides PostgreSQL and Redis add-ons. Add them to your service and use the connection strings they provide.

## Notes

- Render automatically sets the `PORT` environment variable
- The free tier may have cold starts (service sleeps after inactivity)
- Logs are available in the Render dashboard
