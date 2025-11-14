# Stage 1: The "builder"
# USE THE OFFICIAL AWS LAMBDA PYTHON 3.12 IMAGE (Amazon Linux 2023)
FROM public.ecr.aws/lambda/python:3.12 AS builder

WORKDIR /app

# CHANGED: Removed "Development Tools". We only need nodejs and npm.
RUN dnf update -y && dnf install -y nodejs npm

# 2. Install Python dependencies
COPY requirements.txt requirements.txt
RUN pip3 install --user --no-cache-dir -r requirements.txt
# Add Python's user bin to the PATH
ENV PATH=/root/.local/bin:$PATH

# 3. Install Vercel CLI
RUN npm install --global vercel@latest

# 4. Copy all your project files
COPY . .

# 5. Copy your Vercel project link
COPY .vercel .vercel

# 6. Build the project using Vercel CLI
ARG VERCEL_TOKEN
RUN VERCEL_TOKEN=$VERCEL_TOKEN vercel build --prod

# ---
# Stage 2: The "final output"
FROM alpine:latest

# Copy the entire .vercel folder
COPY --from=builder /app/.vercel /.vercel