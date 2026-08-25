# AWS Deployment Strategy

> Captured: 2026-05-03 | Branch: rag-chatbot  
> Status: **Planned — not yet implemented**  
> Pick this up when ready to deploy to AWS.

---

## Architecture Overview

```
Internet
   │
   ▼
CloudFront → S3 (React SPA, static assets)
   │
   ▼
ALB (Application Load Balancer — free 750 hrs/month)
   │
   ▼
ECS Cluster (EC2 t2.micro — free 750 hrs/month)
   └── Spring Boot container (port 8080)
         ├── Amazon Bedrock (Claude Haiku) via IAM role — no API keys
         └── ONNX embeddings (all-MiniLM-L6-v2, runs in-process)
   │
   ▼
RDS PostgreSQL db.t3.micro (free 750 hrs/month)
   └── pgvector extension enabled
         ├── vector_store, document_metadata
         ├── conversation_messages
         └── product, product_vector_store

ECR (private, 500 MB free): one repo for backend image
IAM Instance Profile: grants Bedrock InvokeModel permissions to ECS task
```

**Estimated cost: $0 for 12 months** within AWS free tier limits.  
Bedrock is pay-per-token; $200 in new-account credits covers substantial Claude Haiku usage (~$0.001/1K tokens).

### Why ECS over EKS
EKS has no free tier — the control plane alone costs $0.10/hour ($72+/month). ECS with EC2 launch type uses the existing t2.micro free tier. Kubernetes/Helm was evaluated and rejected for this free-tier constraint.

---

## LLM Strategy on AWS

| Profile | Provider | Auth | Free? |
|---|---|---|---|
| `default` | Anthropic API | `ANTHROPIC_API_KEY` env var | Pay-per-token |
| `bedrock` | Amazon Bedrock | EC2 IAM instance profile | Pay-per-token; $200 credits |

**Recommended for AWS:** `bedrock` profile. No external API keys — the EC2 instance authenticates automatically via its IAM role.

### Spring Boot changes needed for Bedrock

1. **`build.gradle`** — add:
   ```gradle
   implementation 'org.springframework.ai:spring-ai-starter-model-bedrock-converse'
   ```

2. **`src/main/resources/application-bedrock.yaml`** (new file):
   ```yaml
   spring:
     ai:
       model:
         chat: bedrock-converse
       bedrock:
         aws:
           region: us-east-1
         converse:
           model: anthropic.claude-haiku-4-5-20251001-v1:0
           options:
             temperature: 0.7
             max-tokens: 1000
   ```

   No credentials block — Spring AI uses AWS SDK default credential chain (picks up EC2 instance profile automatically).

3. ONNX embeddings (`all-MiniLM-L6-v2`) stay unchanged — they run in-process.

### IAM permissions needed on ECS task role
```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock:InvokeModel",
    "bedrock:InvokeModelWithResponseStream",
    "bedrock:ListFoundationModels"
  ],
  "Resource": "*"
}
```

---

## React Frontend: Configurable Backend URL

React components currently hardcode `http://localhost:8080`. For AWS:

1. Replace with `process.env.REACT_APP_API_URL || 'http://localhost:8080'` in all axios calls.
2. Add `ai-cookbook-frontend/.env.example`:
   ```
   REACT_APP_API_URL=http://localhost:8080
   ```
3. In `ai-cookbook-frontend/Dockerfile`, accept build arg:
   ```dockerfile
   ARG REACT_APP_API_URL=http://localhost:8080
   ENV REACT_APP_API_URL=$REACT_APP_API_URL
   RUN npm run build
   ```
4. GitHub Actions passes `--build-arg REACT_APP_API_URL=${{ vars.ALB_URL }}` at build time.

---

## Terraform Infrastructure

**Directory:** `terraform/` at project root.

### File structure
```
terraform/
├── main.tf              # AWS provider, S3 backend for state
├── variables.tf         # db_password, aws_region, app_image_tag
├── outputs.tf           # alb_dns_name, rds_endpoint, ecr_url, cloudfront_url
├── vpc.tf               # VPC, 2 public + 2 private subnets, IGW
├── security.tf          # SGs: alb (80), ecs (8080 from alb), rds (5432 from ecs)
├── ecr.tf               # ECR repo: ai-chatbot-backend
├── rds.tf               # db.t3.micro PostgreSQL 15, pgvector via init script
├── ecs.tf               # Cluster, task definition (cpu=256, memory=512), service=1
├── iam.tf               # ECS task role with Bedrock + Secrets Manager access
├── alb.tf               # ALB, target group (8080), listener (80)
├── s3_cloudfront.tf     # S3 static website + CloudFront distribution
└── terraform.tfvars.example
```

### Key decisions
- **RDS**: `publicly_accessible = false`; ECS connects via private subnet SG rule. `pgvector` extension enabled via Flyway V1 migration (already in place — no change needed).
- **ECS task env vars**: `SPRING_PROFILES_ACTIVE=bedrock`, `SPRING_DATASOURCE_URL` from RDS endpoint, `SPRING_DATASOURCE_PASSWORD` via AWS Secrets Manager `valueFrom` reference.
- **Terraform state**: S3 bucket `ai-chatbot-tf-state-<account-id>` + DynamoDB lock table `tf-lock`.

### Bootstrap (one-time manual, before first `terraform apply`)
```bash
aws s3 mb s3://ai-chatbot-tf-state-$(aws sts get-caller-identity --query Account --output text)
aws dynamodb create-table \
  --table-name tf-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### Recommended Terraform module
[terraform-aws-modules/ecs/aws](https://registry.terraform.io/modules/terraform-aws-modules/ecs/aws/latest) — community module for ECS clusters and services.

---

## GitHub Actions Pipelines

### `terraform.yml` — Infrastructure pipeline
- **On PR**: `terraform fmt -check` → `terraform validate` → `terraform plan` → post plan as PR comment
- **On merge to main**: `terraform apply -auto-approve` gated by GitHub Environment `production` (manual approval required)

### `deploy.yml` — Application CI/CD
Triggered on push to `main`:
1. `./gradlew test`
2. `npm test -- --watchAll=false`
3. `docker build` → `docker push` to ECR (tagged with git SHA)
4. React build → `aws s3 sync` → CloudFront invalidation
5. `aws ecs update-service --force-new-deployment`

### GitHub Secrets required
| Secret | Purpose |
|---|---|
| `AWS_ACCESS_KEY_ID` | CI IAM user (deploy only, not Bedrock — app uses instance role) |
| `AWS_SECRET_ACCESS_KEY` | Same user |
| `DB_PASSWORD` | Also stored in AWS Secrets Manager |

### GitHub Variables (non-secret)
| Variable | Example |
|---|---|
| `AWS_ACCOUNT_ID` | `123456789012` |
| `AWS_REGION` | `us-east-1` |
| `ECR_REPO_NAME` | `ai-chatbot-backend` |
| `ECS_CLUSTER_NAME` | `ai-chatbot-cluster` |
| `ECS_SERVICE_NAME` | `ai-chatbot-service` |
| `S3_FRONTEND_BUCKET` | `ai-chatbot-frontend-prod` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E1234567890ABC` |
| `ALB_URL` | `http://ai-chatbot-alb-xxx.us-east-1.elb.amazonaws.com` |

---

## Implementation Order (when ready)

1. Add Bedrock Spring profile (Phase 1 above) — test locally first with explicit env vars
2. Fix React API URL (Phase 2) — verify with `REACT_APP_API_URL=http://localhost:8080 npm start`
3. Write Terraform files — run `terraform plan` against real AWS account
4. Bootstrap state S3 bucket + DynamoDB table (one-time)
5. `terraform apply` — creates all infrastructure
6. Write and test GitHub Actions `terraform.yml` and `deploy.yml`

---

## Verification Checklist

```bash
# Terraform
cd terraform && terraform init && terraform validate && terraform plan

# Bedrock profile (local test with explicit creds)
AWS_REGION=us-east-1 AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
  ./gradlew bootRun --args='--spring.profiles.active=bedrock'

# After terraform apply
curl http://<alb-dns>/ai/chat/string?message=hello

# Frontend
open https://<cloudfront-url>  # test all 8 tabs
```
