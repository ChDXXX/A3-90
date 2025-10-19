Assignment 2 - Cloud Services Exercises - Response to Criteria
================================================

Instructions
------------------------------------------------
- Keep this file named A2_response_to_criteria.md, do not change the name
- Upload this file along with your code in the root directory of your project
- Upload this file in the current Markdown format (.md extension)
- Do not delete or rearrange sections.  If you did not attempt a criterion, leave it blank
- Text inside [ ] like [eg. S3 ] are examples and should be removed


Overview
------------------------------------------------

- **Name:** Zhaocheng Dong
- **Student number:** n10051457
- **Partner name :** Guanliang Dong n12005371
- **Application name:** assessment2
- **Two line description:** This for the assessmemt2, if any ambiguous for the video please double check the AWS consoles.
- **EC2 instance name or ID:** i-06e10dfc6898b7e77

------------------------------------------------

### Core - First data persistence service

- **AWS service name:**  S3
- **What data is being stored?:** Video files
- **Why is this service suited to this data?:** Object storage scales for large files and supports direct browser uploads.
- **Why is are the other services used not suitable for this data?:** Forexample DynamoDB is not intended for large binary blobs and would be inefficient/costly for file payloads.
- **Bucket/instance/table name:**
- **Video timestamp:** 2:20 - 3:30, 2:48 - 3:30
- **Relevant files:**
A2-80-main\services\s3.js
A2-80-main\routes\cloud.js
A2-80-main\public\app.js
A2-80-main\public\index.html

### Core - Second data persistence service

- **AWS service name:**  DynamoDB
- **What data is being stored?:** Video metadata
- **Why is this service suited to this data?:**Fast key-value and query by partition/sort keys with on-demand scaling.
- **Why is are the other services used not suitable for this data?:**S3 lacks query capabilities for structured attributes and would require extra indexing.
- **Bucket/instance/table name:** A2-80
- **Video timestamp:** 3:30 - 3:50
- **Relevant files:**
A2-80-main\services\dynamo.js
A2-80-main\routes\cloud.js
A2-80-main\DATA\db.json
DELETE /api/cloud/ddb/items/:id

### Third data service

- **AWS service name:**  
- **What data is being stored?:** 
- **Why is this service suited to this data?:** 
- **Why is are the other services used not suitable for this data?:** 
- **Bucket/instance/table name:**
- **Video timestamp:**
- **Relevant files:**
    -

### S3 Pre-signed URLs

- **S3 Bucket names:**a2-group80
- **Video timestamp:**2:48 - 3:50
- **Relevant files:**
A2-80-main\services\s3.js
A2-80-main\routes\cloud.js
A2-80-main\public\app.js
/api/cloud/s3/upload-url
/api/cloud/s3/download-url


### In-memory cache

- **ElastiCache instance name:**
- **What data is being cached?:** Paginated DynamoDB list responses for frequent reads.
- **Why is this data likely to be accessed frequently?:** Listing pages are repeatedly queried by users and benefit from short-TTL caching.
- **Video timestamp:** 4:50 - 5:39 
- **Relevant files:**
A2-80-main\services\cache.js
A2-80-main\routes\cloud.js (uses cacheFetch around list calls)

### Core - Statelessness
0:23-0:42, 6:56-7:12
- **What data is stored within your application that is not stored in cloud data services?:** Only ephemeral process memory (tokens, request state); no on-disk app data.
- **Why is this data not considered persistent state?:** It is transient and can be recreated by re-authentication or re-fetching from S3/DynamoDB after restarts.
- **How does your application ensure data consistency if the app suddenly stops?:** All durable state lives in S3/DynamoDB; upon restart the API reads from those sources, so no local recovery is required.
- **Relevant files:** 
A2-80-main\index.js
A2-80-main\services
A2-80-main\Dockerfile
SSE /api/sse/events + automatic reconnect


### Graceful handling of persistent connections
    5:39 - 6:07
- **Type of persistent connection and use:** Server-Sent Events (SSE) for heartbeats/notifications.
- **Method for handling lost connections:** Client reconnects to the SSE endpoint; server sends periodic heartbeats.
- **Relevant files:**
A2-80-main\routes\sse.js
A2-80-main\public\app.js


### Core - Authentication with Cognito

- **User pool name:** A2-80 and ID: ap-southeast-2_ziGCN2BCN
- **How are authentication tokens handled by the client?:** The client stores the ID token in memory and sends it as Token. 
- **Video timestamp:** 1:10 - 2:30
- **Relevant files:**
A2-80-main\middleware\requireAuth.js
A2-80-main\routes\cognito.js
A2-80-main\public\app.js
POST /api/cognito/login



### Cognito multi-factor authentication

- **What factors are used for authentication:**
- **Video timestamp:**
- **Relevant files:**
    -

### Cognito federated identities

- **Identity providers used:**
- **Video timestamp:**
- **Relevant files:**
    -

### Cognito groups

- **How are groups used to set permissions?:** Admin-only actions,such as delete user will 403, check via middleware.
- **Video timestamp:** 2:30 -2:48
- **Relevant files:**
A2-80-main\middleware\requireGroup.js
A2-80-main\routes\cloud.js

### Core - DNS with Route53

- **Subdomain**:  a2-80.cab432.com
- **Video timestamp:** 0:45 - 1:09

### Parameter store

- **Parameter names:** /A2-80/PUBLIC_API_BASE,  /A2-80/MEMCACHED_ENDPOINT 
- **Video timestamp:** 3:50 - 4:23
- **Relevant files:**
A2-80-main\services\params.js
A2-80-main\services\cache.js

### Secrets manager

- **Secrets names:** /A2-80/WEBHOOK_SECRET
- **Video timestamp:** 4:23 - 4:50
- **Relevant files:**
A2-80-main\services\secrets.js
A2-80-main\routes\cloud.js
 /api/cloud/webhook/test


### Infrastructure as code

- **Technology used:** AWS CloudFormation
- **Services deployed:** S3 bucket, DynamoDB table, SSM parameters, and Secrets for the webhook.
- **Video timestamp:** 6:05 - 7:00
- **Relevant files:**
    -\iac\template.yaml

### Other (with prior approval only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    -

### Other (with prior permission only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    -
