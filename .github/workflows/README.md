# GitHub Actions CI/CD Workflows

This directory contains GitHub Actions workflows for automated testing, building, and deployment of the URL Shortener frontend.

## Workflows Overview

### 1. Frontend CI (`frontend-ci.yml`)

**Trigger:** Pull requests and pushes to `main` or `develop` branches

**Purpose:** Automated testing and validation

**Jobs:**
- **Lint and Test:** Runs ESLint, Prettier, and unit tests
- **Build:** Builds the application for both staging and production
- **Security Scan:** Runs npm audit and checks for outdated dependencies

**Usage:** Automatically runs on every PR and push

### 2. Deploy to Staging (`frontend-deploy-staging.yml`)

**Trigger:** Pushes to `develop` branch or manual dispatch

**Purpose:** Automated deployment to staging environment

**Jobs:**
- Runs tests
- Builds for staging
- Deploys to S3
- Invalidates CloudFront cache
- Verifies deployment

**Usage:**
```bash
# Automatic: Push to develop branch
git push origin develop

# Manual: Via GitHub UI
# Go to Actions → Deploy Frontend to Staging → Run workflow
```

### 3. Deploy to Production (`frontend-deploy-production.yml`)

**Trigger:** Manual dispatch only (requires approval)

**Purpose:** Controlled deployment to production

**Jobs:**
- Validates deployment request
- Runs full test suite
- Creates backup of current production
- Deploys to S3
- Invalidates CloudFront cache
- Runs post-deployment smoke tests
- Creates deployment tag

**Usage:**
```bash
# Via GitHub UI only
# Go to Actions → Deploy Frontend to Production → Run workflow
# Enter deployment reason and type "DEPLOY" to confirm
```

**Required Inputs:**
- `reason`: Explanation for the deployment (required)
- `confirm`: Must type "DEPLOY" to proceed (required)

### 4. Rollback Deployment (`frontend-rollback.yml`)

**Trigger:** Manual dispatch only

**Purpose:** Rollback to a previous version

**Jobs:**
- Validates rollback request
- Verifies backup exists
- Creates backup of current state
- Restores from specified backup
- Invalidates CloudFront cache
- Verifies rollback

**Usage:**
```bash
# Via GitHub UI
# Go to Actions → Rollback Frontend Deployment → Run workflow
# Select environment, enter backup prefix, and type "ROLLBACK" to confirm
```

**Required Inputs:**
- `environment`: staging or production
- `backup_prefix`: Path to backup (e.g., `backups/20240101-120000`)
- `confirm`: Must type "ROLLBACK" to proceed

## Required Secrets

Configure these secrets in GitHub repository settings:

### AWS Credentials
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key

### Staging Environment
- `STAGING_S3_BUCKET`: S3 bucket name for staging
- `STAGING_CLOUDFRONT_DIST_ID`: CloudFront distribution ID for staging
- `STAGING_CLOUDFRONT_DOMAIN`: CloudFront domain for staging
- `STAGING_API_URL`: Backend API URL for staging
- `STAGING_REDIRECT_URL`: Redirect base URL for staging
- `STAGING_WS_URL`: WebSocket URL for staging

### Production Environment
- `PRODUCTION_S3_BUCKET`: S3 bucket name for production
- `PRODUCTION_CLOUDFRONT_DIST_ID`: CloudFront distribution ID for production
- `PRODUCTION_DOMAIN`: Custom domain for production
- `PRODUCTION_API_URL`: Backend API URL for production
- `PRODUCTION_REDIRECT_URL`: Redirect base URL for production
- `PRODUCTION_WS_URL`: WebSocket URL for production

## Setting Up Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with its corresponding value

Example:
```
Name: STAGING_S3_BUCKET
Value: url-shortener-frontend-staging-123456789012
```

## Environment Protection Rules

### Staging Environment
- No approval required
- Automatic deployment on push to `develop`

### Production Environment
- Requires manual approval
- Only accessible via workflow dispatch
- Requires typing "DEPLOY" to confirm

To configure environment protection:
1. Go to Settings → Environments
2. Click on "production"
3. Enable "Required reviewers"
4. Add team members who can approve deployments

## Workflow Execution Flow

### Development Flow
```
1. Developer creates PR
   ↓
2. CI workflow runs (lint, test, build)
   ↓
3. PR reviewed and merged to develop
   ↓
4. Staging deployment workflow runs automatically
   ↓
5. Staging environment updated
```

### Production Flow
```
1. Staging tested and validated
   ↓
2. Manual trigger of production deployment
   ↓
3. Enter deployment reason and confirm
   ↓
4. Production deployment workflow runs
   ↓
5. Backup created automatically
   ↓
6. Production environment updated
   ↓
7. Post-deployment tests run
   ↓
8. Deployment tag created
```

### Rollback Flow
```
1. Issue detected in production
   ↓
2. Manual trigger of rollback workflow
   ↓
3. Select environment and backup
   ↓
4. Confirm rollback
   ↓
5. Current state backed up
   ↓
6. Previous version restored
   ↓
7. Environment verified
```

## Monitoring Deployments

### View Workflow Runs
1. Go to Actions tab in GitHub
2. Select the workflow
3. View run history and logs

### Check Deployment Status
```bash
# Check CloudFront distribution status
aws cloudfront get-distribution \
  --id YOUR_DISTRIBUTION_ID \
  --query 'Distribution.Status'

# List recent backups
aws s3 ls s3://YOUR_BUCKET/backups/ --recursive
```

### View Deployment Tags
```bash
# List production deployment tags
git tag -l "production-*"

# View tag details
git show production-20240101-120000
```

## Troubleshooting

### Workflow Fails at Build Step
- Check Node.js version compatibility
- Verify all dependencies are in package.json
- Review build logs for specific errors

### Deployment Fails at S3 Upload
- Verify AWS credentials are correct
- Check S3 bucket permissions
- Ensure bucket name is correct

### CloudFront Invalidation Timeout
- Invalidations can take 10-15 minutes
- Check CloudFront console for status
- Verify distribution ID is correct

### Site Not Accessible After Deployment
- Wait 2-3 minutes for CloudFront propagation
- Check CloudFront distribution status
- Verify DNS settings for custom domain
- Check browser cache (try incognito mode)

### Rollback Fails
- Verify backup prefix is correct
- Check backup exists in S3
- Ensure AWS credentials have necessary permissions

## Best Practices

1. **Always test in staging first** before deploying to production
2. **Use descriptive deployment reasons** for audit trail
3. **Monitor deployments** for at least 15 minutes after completion
4. **Keep backups** for at least 30 days
5. **Review workflow logs** if deployment fails
6. **Test rollback procedure** in staging environment
7. **Update secrets** when credentials change
8. **Document any manual steps** required for deployment

## Maintenance

### Updating Workflows
1. Make changes to workflow files
2. Test in a feature branch
3. Review changes in PR
4. Merge to main/develop

### Rotating AWS Credentials
1. Create new AWS access key
2. Update GitHub secrets
3. Test deployment in staging
4. Delete old access key

### Cleaning Up Old Backups
```bash
# List backups older than 30 days
aws s3 ls s3://YOUR_BUCKET/backups/ --recursive | \
  awk '$1 < "'$(date -d '30 days ago' +%Y-%m-%d)'" {print $4}'

# Delete old backups (be careful!)
aws s3 rm s3://YOUR_BUCKET/backups/OLD_BACKUP_PREFIX/ --recursive
```

## Support

For issues with CI/CD workflows:
1. Check workflow logs in GitHub Actions
2. Review this documentation
3. Contact DevOps team
4. Create an issue in the repository
