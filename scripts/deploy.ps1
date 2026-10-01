param(
  [Parameter(Mandatory = $true)]
  [string]$AwsRegion,
  [string]$AwsProfile = "default"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  throw "AWS CLI was not found. Install it and configure credentials first."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker was not found. Install Docker Desktop and start its engine first."
}

$awsContext = @("--region", $AwsRegion)
if ($AwsProfile) { $awsContext += @("--profile", $AwsProfile) }

function Invoke-Aws {
  param([string[]]$Arguments)
  $result = & aws @awsContext @Arguments
  if ($LASTEXITCODE -ne 0) { throw "AWS CLI failed: aws $($Arguments -join ' ')" }
  return $result
}

function Invoke-Docker {
  param([string[]]$Arguments)
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Docker failed: docker $($Arguments -join ' ')" }
}

Push-Location $root
try {
  Write-Host "Creating or updating the ECR repositories..."
  Invoke-Aws @("cloudformation", "deploy", "--template-file", "infra/ecr.yml", "--stack-name", "curovia-ecr", "--no-fail-on-empty-changeset")

  $patientRepository = (Invoke-Aws @("cloudformation", "describe-stacks", "--stack-name", "curovia-ecr", "--query", "Stacks[0].Outputs[?OutputKey=='PatientRepositoryUri'].OutputValue | [0]", "--output", "text")).Trim()
  $appointmentRepository = (Invoke-Aws @("cloudformation", "describe-stacks", "--stack-name", "curovia-ecr", "--query", "Stacks[0].Outputs[?OutputKey=='AppointmentRepositoryUri'].OutputValue | [0]", "--output", "text")).Trim()
  $registry = $patientRepository.Split("/")[0]
  $imageTag = "$(Get-Date -Format 'yyyyMMddHHmmss')-$([guid]::NewGuid().ToString('N').Substring(0, 8))"

  Write-Host "Logging Docker in to $registry..."
  $password = Invoke-Aws @("ecr", "get-login-password")
  $password | & docker login --username AWS --password-stdin $registry
  if ($LASTEXITCODE -ne 0) { throw "Docker login to ECR failed." }

  Write-Host "Building and pushing the patient service..."
  Invoke-Docker @("build", "--tag", "${patientRepository}:${imageTag}", "patient-service")
  Invoke-Docker @("push", "${patientRepository}:${imageTag}")

  Write-Host "Building and pushing the appointment service..."
  Invoke-Docker @("build", "--tag", "${appointmentRepository}:${imageTag}", "appointment-service")
  Invoke-Docker @("push", "${appointmentRepository}:${imageTag}")

  Write-Host "Deploying the ECS Fargate application..."
  Invoke-Aws @(
    "cloudformation", "deploy",
    "--template-file", "infra/ecs.yml",
    "--stack-name", "curovia-app",
    "--capabilities", "CAPABILITY_IAM",
    "--no-fail-on-empty-changeset",
    "--parameter-overrides",
    "PatientImage=${patientRepository}:${imageTag}",
    "AppointmentImage=${appointmentRepository}:${imageTag}"
  )

  $url = Invoke-Aws @("cloudformation", "describe-stacks", "--stack-name", "curovia-app", "--query", "Stacks[0].Outputs[?OutputKey=='ApplicationUrl'].OutputValue | [0]", "--output", "text")
  Write-Host "Curovia is live at $url"
}
finally {
  Pop-Location
}