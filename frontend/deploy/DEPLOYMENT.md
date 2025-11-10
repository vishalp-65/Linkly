# Frontend Deployment Guide

This guide covers deploying the URL Shortener frontend to AWS S3 + CloudFront with custom domain and HTTPS.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
   ```bash
   aws configure
   ```
3. **Node.js** and npm installed
4. **(Optional) Custom Domain** registered and managed in Route 53
5. **(Optional) SSL Certificate** created in AWS Certificate Manager (ACM) in `us-east-1` region

## Deployment Steps

### 1. Infrastructure Setup (One-time)

Deploy the CloudFormation stack to create S3 bucket and CloudFront distribution:

```bash
# For staging environment
aws cloudformation create-stack \
  --stack-name url-shortener-frontend-staging \
  --template-body file://deploy/cloudformation-template.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=staging \
  --region us-east-1

# For production with custom domain
aws cloudformation create-stack \
  --stack-name url-shortener-frontend-production \
  --template-body file://deploy/cloudformation-template.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=production \
    ParameterKey=DomainName,ParameterValue=app.yourdomain.com \
    ParameterKey=CertificateArn,ParameterValue=arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID \
  --region us-east-1
```

Wait for stack creation to complete:
```bash
aws cloudformation wait stack-create-complete \
  --stack-name url-shortener-frontend-production
```

Get the outputs:
```bash
aws cloudformation describe-stacks \
  --stack-name url-shortener-frontend-production \
  --query 'Stacks[0].Outputs'
```

### 2. Configure Environment Variables

Set the deployment configuration as environment variables:

**Linux/Mac:**
```bash
# Staging
export S3_BUCKET_STAGING="url-shortener-frontend-staging-ACCOUNT_ID"
export CLOUDFRONT_DIST_ID_STAGING="E1234567890ABC"

# Production
export S3_BUCKET_PROD="url-shortener-frontend-production-ACCOUNT_ID"
export CLOUDFRONT_DIST_ID_PROD="E0987654321XYZ"
```

**Windows (PowerShell):**
```powershell
# Staging
$env:S3_BUCKET_STAGING="url-shortener-frontend-staging-ACCOUNT_ID"
$env:CLOUDFRONT_DIST_ID_STAGING="E1234567890ABC"

# Production
$env:S3_BUCKET_PROD="url-shortener-frontend-production-ACCOUNT_ID"
$env:CLOUDFRONT_DIST_ID_PROD="E0987654321XYZ"
```

### 3. Update Environment Files

Edit the environment files with your actual backend URLs:

**frontend/.env.staging:**
```env
VITE_BASE_URL=https://api-staging.yourdomain.com/api/v1
VITE_REDIRECT_BASE_URL=https://staging.yourdomain.com
VITE_WS_URL=wss://api-staging.yourdomain.com
VITE_ENABLE_CACHE=true
```

**frontend/.env.production:**
```env
VITE_BASE_URL=https://api.yourdomain.com/api/v1
VITE_REDIRECT_BASE_URL=https://yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com
VITE_ENABLE_CACHE=true
```

### 4. Build and Deploy

#### Staging Deployment

```bash
# Build for staging
npm run build:staging

# Deploy to S3 and invalidate CloudFront cache
# Linux/Mac
chmod +x deploy/s3-deploy.sh
./deploy/s3-deploy.sh staging

# Windows
deploy\s3-deploy.bat staging
```

#### Production Deployment

```bash
# Build for production
npm run build:production

# Deploy to S3 and invalidate CloudFront cache
# Linux/Mac
./deploy/s3-deploy.sh production

# Windows
deploy\s3-deploy.bat production
```

### 5. Configure Custom Domain (Optional)

If using a custom domain, create a Route 53 record:

```bash
# Get CloudFront domain name
CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name url-shortener-frontend-production \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
  --output text)

# Create Route 53 alias record (replace HOSTED_ZONE_ID)
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "app.yourdomain.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "'$CLOUDFRONT_DOMAIN'",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

## Deployment Verification

1. **Check CloudFront Distribution Status:**
   ```bash
   aws cloudfront get-distribution \
     --id $CLOUDFRONT_DIST_ID_PROD \
     --query 'Distribution.Status'
   ```

2. **Test the Deployment:**
   ```bash
   # Test CloudFront URL
   curl -I https://d1234567890abc.cloudfront.net

   # Test custom domain (if configured)
   curl -I https://app.yourdomain.com
   ```

3. **Verify HTTPS and Security Headers:**
   ```bash
   curl -I https://app.yourdomain.com | grep -E "(strict-transport|x-frame|x-content)"
   ```

## Rollback Procedure

If issues are detected after deployment:

1. **Revert to Previous Version:**
   ```bash
   # List S3 object versions
   aws s3api list-object-versions \
     --bucket $S3_BUCKET_PROD \
     --prefix index.html

   # Restore previous version (replace VERSION_ID)
   aws s3api copy-object \
     --bucket $S3_BUCKET_PROD \
     --copy-source $S3_BUCKET_PROD/index.html?versionId=VERSION_ID \
     --key index.html
   ```

2. **Invalidate CloudFront Cache:**
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id $CLOUDFRONT_DIST_ID_PROD \
     --paths "/*"
   ```

## Monitoring and Maintenance

### CloudFront Metrics

Monitor key metrics in CloudWatch:
- Requests
- Bytes Downloaded
- Error Rate (4xx, 5xx)
- Cache Hit Ratio

```bash
# Get CloudFront metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=$CLOUDFRONT_DIST_ID_PROD \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Cost Optimization

1. **Enable CloudFront Compression:** Already enabled in template
2. **Use Appropriate Cache Policies:** Configured for optimal caching
3. **Monitor Data Transfer:** Set up billing alerts
4. **Review CloudFront Price Class:** Currently set to `PriceClass_100` (US, Canada, Europe)

### Security Best Practices

1. **Enable S3 Bucket Versioning:** Already enabled
2. **Block Public Access:** Already configured
3. **Use HTTPS Only:** Enforced via CloudFront
4. **Security Headers:** Configured in CloudFront response headers policy
5. **Regular Updates:** Keep dependencies updated

## Troubleshooting

### Issue: 403 Forbidden Error

**Cause:** CloudFront can't access S3 bucket

**Solution:**
```bash
# Verify bucket policy
aws s3api get-bucket-policy --bucket $S3_BUCKET_PROD

# Update CloudFormation stack if needed
aws cloudformation update-stack \
  --stack-name url-shortener-frontend-production \
  --use-previous-template \
  --parameters ParameterKey=Environment,UsePreviousValue=true
```

### Issue: Stale Content After Deployment

**Cause:** CloudFront cache not invalidated

**Solution:**
```bash
# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DIST_ID_PROD \
  --paths "/*"
```

### Issue: SPA Routes Return 404

**Cause:** CloudFront not configured for SPA routing

**Solution:** Already handled in CloudFormation template with custom error responses

## CI/CD Integration

See `.github/workflows/frontend-deploy.yml` for automated deployment via GitHub Actions.

## Additional Resources

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [Vite Build Documentation](https://vitejs.dev/guide/build.html)
