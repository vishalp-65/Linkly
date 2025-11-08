# CI/CD Pipeline Setup Guide

This guide walks you through setting up the complete CI/CD pipeline for the URL Shortener frontend.

## Prerequisites

- GitHub repository with admin access
- AWS account with appropriate permissions
- AWS CLI installed and configured locally
- Domain name (optional, for custom domain)

## Step 1: Deploy Infrastructure

### 1.1 Create CloudFormation Stacks

Deploy infrastructure for both staging and production:

```bash
# Deploy staging infrastructure
aws cloudformation create-stack \
  --stack-name url-shortener-frontend-staging \
  --template-body file://frontend/deploy/cloudformation-template.yaml \
  --parameters ParameterKey=Environment,ParameterValue=staging \
  --region us-east-1

# Deploy production infrastructure (with custom domain)
aws cloudformation create-stack \
  --stack-name url-shortener-frontend-production \
  --template-body file://frontend/deploy/cloudformation-template.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=production \
    ParameterKey=DomainName,ParameterValue=app.yourdomain.com \
    ParameterKey=CertificateArn,ParameterValue=arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID \
  --region us-east-1
```

### 1.2 Wait for Stack Creation

```bash
# Wait for staging
aws cloudformation wait stack-create-complete \
  --stack-name url-shortener-frontend-staging

# Wait for production
aws cloudformation wait stack-create-complete \
  --stack-name url-shortener-frontend-production
```

### 1.3 Get Stack Outputs

```bash
# Get staging outputs
aws cloudformation describe-stacks \
  --stack-name url-shortener-frontend-staging \
  --query 'Stacks[0].Outputs' \
  --output table

# Get production outputs
aws cloudformation describe-stacks \
  --stack-name url-shortener-frontend-production \
  --query 'Stacks[0].Outputs' \
  --output table
```

Save these values - you'll need them for GitHub secrets.

## Step 2: Create IAM User for GitHub Actions

### 2.1 Create IAM Policy

Create a file `github-actions-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:PutObjectAcl"
      ],
      "Resource": [
        "arn:aws:s3:::url-shortener-frontend-*",
        "arn:aws:s3:::url-shortener-frontend-*/*"
      ]
    },
    {
      "Sid": "CloudFrontAccess",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:ListInvalidations",
        "cloudfront:GetDistribution"
      ],
      "Resource": "*"
    }
  ]
}
```

### 2.2 Create IAM User

```bash
# Create IAM user
aws iam create-user --user-name github-actions-frontend-deploy

# Create and attach policy
aws iam create-policy \
  --policy-name GitHubActionsFrontendDeploy \
  --policy-document file://github-actions-policy.json

# Attach policy to user (replace ACCOUNT_ID)
aws iam attach-user-policy \
  --user-name github-actions-frontend-deploy \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/GitHubActionsFrontendDeploy

# Create access key
aws iam create-access-key --user-name github-actions-frontend-deploy
```

Save the `AccessKeyId` and `SecretAccessKey` from the output.

## Step 3: Configure GitHub Secrets

### 3.1 Navigate to Repository Settings

1. Go to your GitHub repository
2. Click Settings → Secrets and variables → Actions
3. Click "New repository secret"

### 3.2 Add AWS Credentials

Add these secrets:

```
AWS_ACCESS_KEY_ID: <AccessKeyId from Step 2.2>
AWS_SECRET_ACCESS_KEY: <SecretAccessKey from Step 2.2>
```

### 3.3 Add Staging Secrets

Get values from CloudFormation outputs (Step 1.3):

```
STAGING_S3_BUCKET: url-shortener-frontend-staging-123456789012
STAGING_CLOUDFRONT_DIST_ID: E1234567890ABC
STAGING_CLOUDFRONT_DOMAIN: d1234567890abc.cloudfront.net
STAGING_API_URL: https://api-staging.yourdomain.com/api/v1
STAGING_REDIRECT_URL: https://staging.yourdomain.com
STAGING_WS_URL: wss://api-staging.yourdomain.com
```

### 3.4 Add Production Secrets

```
PRODUCTION_S3_BUCKET: url-shortener-frontend-production-123456789012
PRODUCTION_CLOUDFRONT_DIST_ID: E0987654321XYZ
PRODUCTION_DOMAIN: app.yourdomain.com
PRODUCTION_API_URL: https://api.yourdomain.com/api/v1
PRODUCTION_REDIRECT_URL: https://yourdomain.com
PRODUCTION_WS_URL: wss://api.yourdomain.com
```

## Step 4: Configure GitHub Environments

### 4.1 Create Staging Environment

1. Go to Settings → Environments
2. Click "New environment"
3. Name: `staging`
4. Click "Configure environment"
5. (Optional) Add environment secrets specific to staging

### 4.2 Create Production Environment

1. Click "New environment"
2. Name: `production`
3. Click "Configure environment"
4. Enable "Required reviewers"
5. Add team members who can approve deployments
6. (Optional) Set deployment branch to `main` only
7. (Optional) Add wait timer (e.g., 5 minutes)

## Step 5: Configure Custom Domain (Optional)

### 5.1 Create Route 53 Record

```bash
# Get CloudFront domain
CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name url-shortener-frontend-production \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
  --output text)

# Create A record (replace HOSTED_ZONE_ID)
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

### 5.2 Verify DNS Propagation

```bash
# Check DNS resolution
nslookup app.yourdomain.com

# Test HTTPS
curl -I https://app.yourdomain.com
```

## Step 6: Test the Pipeline

### 6.1 Test CI Workflow

```bash
# Create a test branch
git checkout -b test-ci-pipeline

# Make a small change to frontend
echo "// Test CI" >> frontend/src/App.tsx

# Commit and push
git add .
git commit -m "Test CI pipeline"
git push origin test-ci-pipeline

# Create PR on GitHub
# Verify CI workflow runs automatically
```

### 6.2 Test Staging Deployment

```bash
# Merge PR to develop branch
git checkout develop
git merge test-ci-pipeline
git push origin develop

# Verify staging deployment workflow runs
# Check GitHub Actions tab
```

### 6.3 Test Production Deployment

1. Go to GitHub Actions
2. Select "Deploy Frontend to Production"
3. Click "Run workflow"
4. Enter deployment reason: "Initial production deployment"
5. Enter confirmation: "DEPLOY"
6. Click "Run workflow"
7. Monitor the deployment progress

### 6.4 Test Rollback

1. Note the backup prefix from production deployment logs
2. Go to GitHub Actions
3. Select "Rollback Frontend Deployment"
4. Click "Run workflow"
5. Select environment: "production"
6. Enter backup prefix from step 1
7. Enter confirmation: "ROLLBACK"
8. Click "Run workflow"

## Step 7: Configure Monitoring (Optional)

### 7.1 Set Up CloudWatch Alarms

```bash
# Create alarm for 4xx errors
aws cloudwatch put-metric-alarm \
  --alarm-name frontend-high-4xx-errors \
  --alarm-description "Alert when 4xx error rate is high" \
  --metric-name 4xxErrorRate \
  --namespace AWS/CloudFront \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=DistributionId,Value=$PRODUCTION_CLOUDFRONT_DIST_ID

# Create alarm for 5xx errors
aws cloudwatch put-metric-alarm \
  --alarm-name frontend-high-5xx-errors \
  --alarm-description "Alert when 5xx error rate is high" \
  --metric-name 5xxErrorRate \
  --namespace AWS/CloudFront \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=DistributionId,Value=$PRODUCTION_CLOUDFRONT_DIST_ID
```

### 7.2 Enable CloudFront Logging

```bash
# Create S3 bucket for logs
aws s3 mb s3://url-shortener-cloudfront-logs-$ACCOUNT_ID

# Enable logging on CloudFront distribution
aws cloudfront update-distribution \
  --id $PRODUCTION_CLOUDFRONT_DIST_ID \
  --distribution-config file://distribution-config-with-logging.json
```

## Step 8: Document and Train Team

### 8.1 Create Runbook

Document common procedures:
- How to deploy to staging
- How to deploy to production
- How to rollback
- How to check deployment status
- Emergency contacts

### 8.2 Train Team Members

- Walk through deployment process
- Practice rollback procedure
- Review monitoring dashboards
- Establish on-call rotation

## Verification Checklist

- [ ] CloudFormation stacks created successfully
- [ ] IAM user created with correct permissions
- [ ] GitHub secrets configured
- [ ] GitHub environments configured with protection rules
- [ ] Custom domain configured (if applicable)
- [ ] CI workflow runs on PR
- [ ] Staging deployment works automatically
- [ ] Production deployment requires approval
- [ ] Rollback procedure tested
- [ ] Monitoring and alerts configured
- [ ] Team trained on procedures
- [ ] Documentation updated

## Troubleshooting

### Issue: CloudFormation Stack Creation Fails

**Solution:**
```bash
# Check stack events
aws cloudformation describe-stack-events \
  --stack-name url-shortener-frontend-staging \
  --max-items 10

# Delete failed stack and retry
aws cloudformation delete-stack \
  --stack-name url-shortener-frontend-staging
```

### Issue: GitHub Actions Can't Access S3

**Solution:**
- Verify AWS credentials in GitHub secrets
- Check IAM policy permissions
- Verify S3 bucket name is correct

### Issue: CloudFront Invalidation Takes Too Long

**Solution:**
- Invalidations can take 10-15 minutes
- Consider using versioned file names instead
- Check CloudFront console for status

### Issue: Custom Domain Not Working

**Solution:**
- Verify SSL certificate is in us-east-1
- Check Route 53 DNS records
- Wait for DNS propagation (up to 48 hours)
- Clear browser cache

## Maintenance

### Regular Tasks

**Weekly:**
- Review deployment logs
- Check for failed workflows
- Monitor CloudWatch metrics

**Monthly:**
- Review and clean up old backups
- Update dependencies
- Review IAM permissions
- Check AWS costs

**Quarterly:**
- Rotate AWS access keys
- Review and update documentation
- Conduct disaster recovery drill
- Review and optimize costs

## Next Steps

1. Set up backend CI/CD pipeline
2. Configure end-to-end testing
3. Set up performance monitoring
4. Implement feature flags
5. Configure A/B testing infrastructure

## Support

For issues or questions:
- Check GitHub Actions logs
- Review CloudFormation events
- Contact DevOps team
- Create issue in repository
