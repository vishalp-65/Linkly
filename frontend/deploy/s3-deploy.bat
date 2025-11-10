@echo off
REM S3 Deployment Script for Frontend (Windows)
REM This script deploys the built frontend to AWS S3 and invalidates CloudFront cache

setlocal enabledelayedexpansion

REM Configuration
set ENVIRONMENT=%1
if "%ENVIRONMENT%"=="" set ENVIRONMENT=staging
set BUILD_DIR=dist

REM Load environment-specific configuration
if "%ENVIRONMENT%"=="production" (
    if "%S3_BUCKET_PROD%"=="" (
        set S3_BUCKET=your-production-bucket
    ) else (
        set S3_BUCKET=%S3_BUCKET_PROD%
    )
    if "%CLOUDFRONT_DIST_ID_PROD%"=="" (
        set CLOUDFRONT_DISTRIBUTION_ID=YOUR_PROD_DISTRIBUTION_ID
    ) else (
        set CLOUDFRONT_DISTRIBUTION_ID=%CLOUDFRONT_DIST_ID_PROD%
    )
) else if "%ENVIRONMENT%"=="staging" (
    if "%S3_BUCKET_STAGING%"=="" (
        set S3_BUCKET=your-staging-bucket
    ) else (
        set S3_BUCKET=%S3_BUCKET_STAGING%
    )
    if "%CLOUDFRONT_DIST_ID_STAGING%"=="" (
        set CLOUDFRONT_DISTRIBUTION_ID=YOUR_STAGING_DISTRIBUTION_ID
    ) else (
        set CLOUDFRONT_DISTRIBUTION_ID=%CLOUDFRONT_DIST_ID_STAGING%
    )
) else (
    echo Invalid environment: %ENVIRONMENT%
    echo Usage: s3-deploy.bat [staging^|production]
    exit /b 1
)

echo ==========================================
echo Deploying to %ENVIRONMENT% environment
echo S3 Bucket: %S3_BUCKET%
echo CloudFront Distribution: %CLOUDFRONT_DISTRIBUTION_ID%
echo ==========================================

REM Check if AWS CLI is installed
where aws >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: AWS CLI is not installed
    echo Install it from: https://aws.amazon.com/cli/
    exit /b 1
)

REM Check if build directory exists
if not exist "%BUILD_DIR%" (
    echo Error: Build directory '%BUILD_DIR%' not found
    echo Run 'npm run build:%ENVIRONMENT%' first
    exit /b 1
)

REM Sync files to S3 with appropriate cache headers
echo Uploading files to S3...

REM Upload HTML files with no-cache
aws s3 sync %BUILD_DIR% s3://%S3_BUCKET%/ --exclude "*" --include "*.html" --cache-control "no-cache, no-store, must-revalidate" --metadata-directive REPLACE --delete

REM Upload JS/CSS files with long cache
aws s3 sync %BUILD_DIR% s3://%S3_BUCKET%/ --exclude "*.html" --include "*.js" --include "*.css" --cache-control "public, max-age=31536000, immutable" --metadata-directive REPLACE --delete

REM Upload other assets with moderate cache
aws s3 sync %BUILD_DIR% s3://%S3_BUCKET%/ --exclude "*.html" --exclude "*.js" --exclude "*.css" --cache-control "public, max-age=86400" --metadata-directive REPLACE --delete

echo Upload complete!

REM Invalidate CloudFront cache
echo Invalidating CloudFront cache...
for /f "tokens=*" %%i in ('aws cloudfront create-invalidation --distribution-id %CLOUDFRONT_DISTRIBUTION_ID% --paths "/*" --query "Invalidation.Id" --output text') do set INVALIDATION_ID=%%i

echo CloudFront invalidation created: %INVALIDATION_ID%
echo Waiting for invalidation to complete...

aws cloudfront wait invalidation-completed --distribution-id %CLOUDFRONT_DISTRIBUTION_ID% --id %INVALIDATION_ID%

echo ==========================================
echo Deployment complete!
echo ==========================================

endlocal
