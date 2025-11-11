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
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/server.js`

3. **Add Environment Variables**
   
   In the Render dashboard, add these environment variables:
   
   - `NODE_ENV` = `production`
   - `PORT` = `3000` (Render will override this automatically)
   - `DATABASE_URL` = Your PostgreSQL connection string
   - `REDIS_URL` = Your Redis connection string
   - Add any other environment variables from your `.env` file

## Alternative: Using render.yaml

If you prefer infrastructure-as-code, the `render.yaml` file in the root directory will automatically configure your service. Just:

1. Push the `render.yaml` file to your repository
2. In Render dashboard, select "New +" → "Blueprint"
3. Connect your repository
4. Render will read the configuration from `render.yaml`

## Troubleshooting

### Error: Cannot find module '/opt/render/project/dist/server.js'

This happens when the start command uses a wrong path. Make sure:
- Build command is: `npm install && npm run build`
- Start command is: `node dist/server.js` (NOT `node ../dist/server.js`)

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
