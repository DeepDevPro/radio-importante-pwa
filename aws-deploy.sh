#!/bin/bash

# 🚀 Radio Importante PWA - AWS Deployment Helper
# Usage: ./aws-deploy.sh [command]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
S3_BUCKET="radio-importantestudio-com"
AWS_REGION="us-west-2"
DOMAIN="radio.importantestudio.com"

echo -e "${BLUE}🎵 Radio Importante PWA - AWS Deploy Helper${NC}"
echo -e "${BLUE}================================================${NC}"

# Functions
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ AWS CLI found${NC}"
}

check_credentials() {
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}❌ AWS credentials not configured. Run 'aws configure' first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ AWS credentials configured${NC}"
}

# Build function
build_for_production() {
    echo -e "${BLUE}🏗️ Building for production (without audio files)...${NC}"
    
    # Backup audio files and catalog
    if [ -d "public/audio" ]; then
        echo -e "${YELLOW}📦 Backing up audio files...${NC}"
        mkdir -p temp_backup
        cp -r public/audio temp_backup/
        cp public/data/catalog.json temp_backup/catalog_backup.json
    fi
    
    # Remove audio files for production build
    rm -rf public/audio
    
    # Create minimal audio structure
    mkdir -p public/audio/hls
    echo '{"tracks":[],"totalDuration":0,"generatedAt":"'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'","version":"1.0"}' > public/audio/hls/track-cues.json
    
    # Create empty catalog for initial deploy
    cat > public/data/catalog.json << EOF
{
  "version": "1.1.2",
  "tracks": [],
  "metadata": {
    "totalTracks": 0,
    "totalDuration": 0,
    "artwork": "/img/radio-importante-logo.png",
    "radioName": "Rádio Importante",
    "description": "Uma seleção de música eletrônica, soul e experimental - Use o admin para adicionar músicas",
    "genre": "Electronic, Soul, Experimental",
    "language": "pt-BR",
    "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
  }
}
EOF
    
    # Run build
    npm run build
    
    # Show build size
    BUILD_SIZE=$(du -sh dist/ | cut -f1)
    echo -e "${GREEN}📦 Build size: $BUILD_SIZE${NC}"
    
    # Restore audio files for development
    if [ -d "temp_backup/audio" ]; then
        echo -e "${YELLOW}🔄 Restoring audio files for development...${NC}"
        rm -rf public/audio
        mv temp_backup/audio public/
        cp temp_backup/catalog_backup.json public/data/catalog.json
        rm -rf temp_backup
    fi
    
    echo -e "${GREEN}✅ Build completed - ready for deploy${NC}"
    echo -e "${YELLOW}💡 Audio files excluded from production - use admin panel to upload${NC}"
}

create_bucket() {
    echo -e "${YELLOW}📦 Creating S3 bucket: ${S3_BUCKET}${NC}"
    
    # Create bucket
    aws s3 mb s3://${S3_BUCKET} --region ${AWS_REGION} || echo "Bucket might already exist"
    
    # Enable static website hosting
    aws s3 website s3://${S3_BUCKET} --index-document index.html --error-document index.html
    
    # Set bucket policy for public read
    cat > /tmp/bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::${S3_BUCKET}/*"
        }
    ]
}
EOF
    
    aws s3api put-bucket-policy --bucket ${S3_BUCKET} --policy file:///tmp/bucket-policy.json
    rm /tmp/bucket-policy.json
    
    echo -e "${GREEN}✅ S3 bucket configured for static website hosting${NC}"
}

deploy_to_s3() {
    echo -e "${YELLOW}🚀 Deploying to S3...${NC}"
    
    # Sync files
    aws s3 sync dist/ s3://${S3_BUCKET} --delete --exact-timestamps
    
    # Set correct content types
    echo -e "${YELLOW}🔧 Setting content types...${NC}"
    aws s3 cp s3://${S3_BUCKET}/manifest.webmanifest s3://${S3_BUCKET}/manifest.webmanifest \
        --content-type "application/manifest+json" --metadata-directive REPLACE || true
    
    aws s3 cp s3://${S3_BUCKET}/sw.js s3://${S3_BUCKET}/sw.js \
        --content-type "application/javascript" --metadata-directive REPLACE || true
    
    # Set cache headers for assets
    aws s3 cp s3://${S3_BUCKET}/audio/ s3://${S3_BUCKET}/audio/ --recursive \
        --cache-control "max-age=31536000" --metadata-directive REPLACE || true
    
    aws s3 cp s3://${S3_BUCKET}/icons/ s3://${S3_BUCKET}/icons/ --recursive \
        --cache-control "max-age=31536000" --metadata-directive REPLACE || true
    
    echo -e "${GREEN}✅ Deployment completed${NC}"
}

verify_deployment() {
    echo -e "${YELLOW}🔍 Verifying deployment...${NC}"
    
    # Get S3 website endpoint
    S3_ENDPOINT="http://${S3_BUCKET}.s3-website-${AWS_REGION}.amazonaws.com"
    echo -e "${BLUE}📍 S3 Website Endpoint: ${S3_ENDPOINT}${NC}"
    
    # Test S3 endpoint
    if curl -f "${S3_ENDPOINT}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ S3 endpoint accessible${NC}"
    else
        echo -e "${RED}❌ S3 endpoint not accessible${NC}"
    fi
    
    # Test custom domain
    if curl -f "https://${DOMAIN}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Custom domain accessible: https://${DOMAIN}${NC}"
    else
        echo -e "${YELLOW}⚠️ Custom domain not accessible yet (DNS propagation?)${NC}"
    fi
}

show_dns_info() {
    echo -e "${YELLOW}🌐 DNS Configuration Info:${NC}"
    echo -e "${BLUE}Domain: ${DOMAIN}${NC}"
    echo -e "${BLUE}CNAME Target: ${S3_BUCKET}.s3-website-${AWS_REGION}.amazonaws.com${NC}"
    echo -e "${BLUE}Region: ${AWS_REGION}${NC}"
    
    echo -e "${YELLOW}📋 Route 53 Record to create:${NC}"
    echo -e "Name: radio"
    echo -e "Type: CNAME"
    echo -e "Value: ${S3_BUCKET}.s3-website-${AWS_REGION}.amazonaws.com"
}

show_costs() {
    echo -e "${YELLOW}💰 Estimated costs:${NC}"
    echo -e "S3 Storage (20MB): ~$0.01/month"
    echo -e "S3 Requests (10k): ~$0.01/month"
    echo -e "S3 Data Transfer (1GB): ~$0.09/month"
    echo -e "Route 53 Hosted Zone: $0.50/month"
    echo -e "${GREEN}Total estimated: ~$0.61/month${NC}"
}

case "${1:-help}" in
    "setup")
        check_aws_cli
        check_credentials
        create_bucket
        show_dns_info
        ;;
    "build")
        build_project
        ;;
    "deploy")
        check_aws_cli
        check_credentials
        build_project
        deploy_to_s3
        verify_deployment
        ;;
    "verify")
        verify_deployment
        ;;
    "dns")
        show_dns_info
        ;;
    "costs")
        show_costs
        ;;
    "full")
        echo -e "${BLUE}🚀 Full deployment process...${NC}"
        check_aws_cli
        check_credentials
        create_bucket
        build_project
        deploy_to_s3
        verify_deployment
        show_dns_info
        show_costs
        ;;
    "help"|*)
        echo -e "${YELLOW}📋 Available commands:${NC}"
        echo -e "  setup    - Create and configure S3 bucket"
        echo -e "  build    - Build the project"
        echo -e "  deploy   - Build and deploy to S3"
        echo -e "  verify   - Verify deployment"
        echo -e "  dns      - Show DNS configuration info"
        echo -e "  costs    - Show cost estimates"
        echo -e "  full     - Run complete deployment process"
        echo -e "  help     - Show this help"
        echo ""
        echo -e "${YELLOW}Examples:${NC}"
        echo -e "  ./aws-deploy.sh setup    # First time setup"
        echo -e "  ./aws-deploy.sh deploy   # Deploy updates"
        echo -e "  ./aws-deploy.sh full     # Complete process"
        ;;
esac
