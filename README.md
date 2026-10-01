# Curovia demo

A small care-coordination demo made of two independently deployable services:

- **Patient service** serves the web app and patient API on port 3000.
- **Appointment service** provides the appointment API on port 3001.

The browser app runs at `/`; the application load balancer routes `/api/appointments` to the appointment service and other requests to the patient service.

## Run locally

Requires Docker Desktop with Docker Compose.

```powershell
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080). Use the seeded fictional patients or add a name and schedule a demo visit. Data is held in memory and resets when either container restarts.

To stop the app:

```powershell
docker compose down
```

## Deploy to ECR and ECS Fargate

Requires Docker Desktop, AWS CLI v2, an AWS account with permissions for ECR, CloudFormation, ECS, EC2, Elastic Load Balancing, IAM, and CloudWatch Logs, plus an AWS CLI profile configured on your machine. The stack creates an internet-facing HTTP load balancer and two Fargate tasks in public subnets.

From the project directory, run:

```powershell
./scripts/deploy.ps1 -AwsRegion us-east-1 -AwsProfile default
```

Change the region and profile to match your AWS setup. The script creates two ECR repositories, builds and pushes uniquely tagged images, deploys the VPC, load balancer, ECS cluster and services, and prints the application URL. Each run uses a new image tag so ECS rolls out the new build. Initial deployment can take several minutes and AWS resources will incur charges.

To remove the deployed app and its ECR repositories after use, delete the `curovia-app` CloudFormation stack first and then the `curovia-ecr` stack in the same region.

## Demo-only notice

This starter is **not for real patient information or clinical use**. It has no authentication, durable database, encryption strategy, HTTPS listener, or production privacy controls. The load balancer is public over HTTP; all service state is in memory and is lost when tasks are replaced. Before any real use, add appropriate identity and access controls, TLS, private networking, persistent encrypted storage, audit controls, backups, and a security and compliance review.