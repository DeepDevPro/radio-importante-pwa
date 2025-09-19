# GitHub Actions Workflows

## 🚀 Active Workflows

### Frontend Deployment
- **`deploy-digitalocean.yml`** - Deploy frontend to Digital Ocean App Platform
  - Triggers: Push to `main` branch with frontend changes
  - Deploys to: `radio-importante-frontend` app on Digital Ocean

### Backend Management (AWS)
- **`deploy.yml`** - Deploy backend to AWS Elastic Beanstalk - desabilitei-o
- **`diagnose-eb.yml`** - Diagnose Elastic Beanstalk environment issues - desabilitei-o
- **`restart-environment.yml`** - Restart Elastic Beanstalk environment - desabilitei-o

### Repository Management
- **`check-environment.yml`** - Check environment configuration
- **`protect-main.yml`** - Protect main branch from direct pushes
- **`setup-cloudfront.yml`** - Setup CloudFront distribution - desabilitei-o
- **`test-setup.yml`** - Test environment setup

---

## ❌ Disabled Workflows (Migration from AWS to Digital Ocean)

### Frontend Workflows (AWS - Migrated to Digital Ocean)
- **`deploy-frontend.yml.disabled`** - Former AWS S3/CloudFront frontend deployment
- **`deploy-staging.yml..disabled`** - Former AWS staging environment deployment
- **`deploy-complete.yml.disabled`** - Former complete deployment (frontend + backend)

### Backend Workflows (AWS - Preserved for rollback)
- **`deploy-backend-simple.yml.disabled`** - Simplified backend deployment
- **`deploy-platform-update.yml.disabled`** - Backend platform update workflow
- **`update-catalog.yml.disabled`** - Update application catalog

### Backup Files
- **`deploy-complete.yml.bak`** - Backup of complete deployment workflow

---

## 📋 Migration Status

### ✅ Completed
- Frontend migrated from AWS (S3/CloudFront) to Digital Ocean App Platform
- New GitHub Actions workflow for Digital Ocean deployment active
- AWS frontend workflows disabled but preserved for rollback

### 🔄 In Progress
- Backend still running on AWS Elastic Beanstalk
- Backend workflows remain active

### 📋 Next Steps
1. Monitor Digital Ocean frontend stability
2. Consider creating staging environment on Digital Ocean
3. Plan backend migration (future phase)

---

## 🔧 How to Re-enable Disabled Workflows

If rollback is needed, remove the `.disabled` extension:

```bash
# Example: Re-enable AWS frontend deployment
mv .github/workflows/deploy-frontend.yml.disabled .github/workflows/deploy-frontend.yml
```

**⚠️ Warning:** Re-enabling AWS workflows may cause conflicts with Digital Ocean deployment. Ensure proper DNS and environment coordination.

---

## 🏗️ Suggested Staging Workflow

To add staging environment for Digital Ocean:

1. Create staging app on Digital Ocean: `radio-importante-frontend-staging`
2. Create workflow: `deploy-digitalocean-staging.yml`
3. Configure to trigger on `staging` or `develop` branch
4. Test changes before promoting to `main`

---

*Last updated: September 19, 2025*
*Migration: AWS → Digital Ocean (Frontend only)*
