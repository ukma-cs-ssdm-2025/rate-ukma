# ADR-0002: Initial Deployment Strategy

## Status

Proposed

## Date

2025-09-30

## Context

The Rate UKMA system needs a deployment strategy that aligns with our [ADR-0001: N-tier Architecture](./0001-n-tier-arch.md) while considering our current constraints and future needs.

**Forces:**

1. **Fully Launched Project Scale Requirements**
   - Current expected load: 100-500 regular users
   - Peak load: up to 5,000 users during enrollment periods
   - No immediate need for high-availability setup (will be updated after launch)

2. **Resource Constraints**
   - Limited budget for infrastructure
   - Small student team with basic DevOps experience
   - Need for simple, maintainable deployment process (will be updated during development and launch)

3. **Technical Requirements**
   - [NFR-R-002](../requirements.md#nfr-r-002) requires 99.5% monthly uptime
   - [NFR-R-004](../requirements.md#nfr-r-004) requires daily backups with 7-day retention
   - [NFR-PE-001](../requirements.md#nfr-pe-001) requires page load within 1.5 seconds

4. **Future Growth**
   - System should be designed for future scaling
   - Need path to high availability without major architecture changes
   - Ability to handle increased load when user base grows

## Decision

We will start with a **simple, single-instance deployment** with upgrade paths:

1. **Infrastructure**
   - Production EC2:
     - t3.small (2 vCPU, 2GB RAM) initially, can upgrade to t3.medium (2 vCPU, 4GB RAM) if needed
     - 20GB SSD (8GB system, 10GB Docker, 2GB logs/misc)
   - Staging EC2:
     - t3.micro (2 vCPU, 1GB RAM) sufficient for testing
     - 15GB SSD (8GB system, 5GB Docker, 2GB misc)
   - Backup EC2:
     - t3.micro (2 vCPU, 1GB RAM)
     - 30GB SSD (8GB system, 20GB backups, 2GB misc)
   - Ubuntu 22.04 LTS for all instances
   - All components (except backups) containerized with Docker

2. **Environment Separation**
   - Development: Local Docker Compose setup
   - Staging: AWS EC2 with automated deployments from main branch
   - Production: AWS EC2 with automated deployments from live branch

3. **Core Components**
   - Nginx for reverse proxy and static files
   - Django with Gunicorn for application backend server
   - PostgreSQL in Docker as database
   - Daily backup script with rsync dump copy to a separate server
   - Basic monitoring via CloudWatch or custom script

4. **Deployment Process**
   - GitHub Actions for CI/CD
   - Automated deployments to staging and production
   - Docker for consistent environments
   - Let's Encrypt / Certbot for SSL certificates

## Consequences

✅ **Simple and Cost-Effective**: Single-instance deployment with Docker containers minimizes complexity and AWS costs, while maintaining environment consistency.

✅ **Maintainable**: Automated deployment pipeline with environment separation and daily backup strategy.

✅ **Sufficient for Current Scale**: A single t3.small/medium instance with basic monitoring provides adequate performance and reliability for initial requirements.

✅ **Future-Ready**: Containerized setup with separate backup server allows smooth migration to load balancing and auto-scaling architecture when user numbers increase.

⚠️ **Single Point of Failure**: If single EC2 instance deployment is down, the service will be unavailable. We accept this initially and plan to add AWS ALB with multiple instances when user numbers justify the complexity.

⚠️ **Basic Monitoring**: We start with basic essential metrics collection, with the ability to add more monitoring as needed.

## Considered Alternatives

1. **Full High-Availability Setup**: A production-grade setup with multiple EC2 instances behind ALB, AWS RDS, and S3/CloudFront etc. was rejected due to excessive cost ($200-300/month) and complexity compared to current project stage and realistic requirements.

2. **Serverless Architecture**: An AWS Lambda-based architecture with API Gateway, DynamoDB, S3 hosting, etc. was rejected as it would require significant refactoring and introduce unnecessary complexity for the team on current stage of the project.

3. **Traditional VM-based Deployment**: Direct EC2 setup without containerization was probable, but rejected as it would make environment consistency and future scaling more challenging.

4. **Managed Kubernetes (EKS)**: Great scaling capabilities, but was rejected due to overhead for current project stage.
