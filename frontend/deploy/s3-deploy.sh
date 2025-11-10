#!/bin/bash

# S3 Deployment Script for Frontend
# This script deploys the built frontend to AWS S3 and invalidates CloudFront cache

set -e

# Configuration
ENVIRONMENT=${1:-staging}
BUILD_DIR="dist"

# Load environment-specific configuration
if [ "$ENVIRONMENT" = "production" ]; then
    S3_BUCKET=${S3_BUCKET_PROD:-"your-production-bucket"}
    CLOUDFRONT_DISTRIBUTION_ID=${CLOUDFRONT_DIST_ID_PROD:-"YOUR_PROD_DISTRIBUTION_ID"}
elif [ "$ENVIRONMENT" = "staging" ]; then
    S3_BUCKET=${S3_BUCKET_STAGING:-"your-staging-bucket"}
    CLOUDFRONT_DISTRIBUTION_ID=${CLOUDFRONT_DIST_ID_STAGING:-"YOUR_STAGING_DISTRIBUTION_ID"}
else
    echo "Invalid environment: $ENVIRONMENT"
    echo "Usage: ./s3-deploy.sh [staging|production]"
    exit 1
fi

echo "=========================================="
echo "Deploying to $ENVIRONMENT environment"
echo "S3 Bucket: $S3_BUCKET"
echo "CloudFront Distribution: $CLOUDFRONT_DISTRIBUTION_ID"
echo "=========================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed"
    echo "Install it from: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if build directory exists
if [ ! -d "$BUILD_DIR" ]; then
    echo "Error: Build directory '$BUILD_DIR' not found"
    echo "Run 'npm run build:$ENVIRONMENT' first"
    exit 1
fi

# Sync files to S3 with appropriate cache headers
echo "Uploading files to S3..."

# Upload HTML files with no-cache (always check for updates)
aws s3 sync $BUILD_DIR s3://$S3_BUCKET/ \
    --exclude "*" \
    --include "*.html" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --metadata-directive REPLACE \
    --delete

# Upload JS/CSS files with long cache (they have content hashes)
aws s3 sync $BUILD_DIR s3://$S3_BUCKET/ \
    --exclude "*.html" \
    --include "*.js" \
    --include "*.css" \
    --cache-control "public, max-age=31536000, immutable" \
    --content-encoding "gzip" \
    --metadata-directive REPLACE \
    --delete

# Upload other assets with moderate cache
aws s3 sync $BUILD_DIR s3://$S3_BUCKET/ \
    --exclude "*.html" \
    --exclude "*.js" \
    --exclude "*.css" \
    --cache-control "public, max-age=86400" \
    --metadata-directive REPLACE \
    --delete

echo "Upload complete!"

# Invalidate CloudFront cache
echo "Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo "CloudFront invalidation created: $INVALIDATION_ID"
echo "Waiting for invalidation to complete..."

aws cloudfront wait invalidation-completed \
    --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
    --id $INVALIDATION_ID

echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
