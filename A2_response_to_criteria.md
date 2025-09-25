Assignment 1 - REST API Project - Response to Criteria

- **Name:** Zhaocheng Dong
- **Student number:** n10051457

---

## Core Criteria (20 marks)

### CPU intensive process (video transcoding)
- Implemented with **ffmpeg** (via fluent-ffmpeg).
- Converts uploaded video into MP4 (720p) with specified resolution.
- Verified by API endpoint `/api/transcode/sync` and `/api/transcode` (async).
- **Demo**: Upload a video, trigger transcoding.  
  - [T: CPU intensive task demo @ 02:55]

### CPU load testing
- Stress test using multiple concurrent calls to `/api/transcode/sync`.
- Sustains **>80% CPU for ~5 minutes** on EC2 (shown via AWS console Monitoring graph).
- **Demo**: Run bash loop script in EC2 to trigger multiple sync transcodes.  
  - [T: CPU load test demo @ 03:06]

### Two kinds of data
- **Unstructured**: raw video files, transcoded files, and generated thumbnails (stored in `storage/`).
- **Structured**: metadata JSON (file id, owner, transcoding status, job queues) stored via lowdb under `data/db.json`.
- **Demo**: Show file stored under `/app/storage`, then show metadata JSON file.  
  - [T: Two kinds of data demo @ 05:01]

### Containerisation
- Application containerised with a **Dockerfile**.
- Can be built locally and tagged for ECR.
- **Demo**: Show Dockerfile in repo, then docker build and run.  
  - [T: Dockerfile shown @ 00:35]

### Deploy the container
- Docker image pushed to **AWS ECR (repo: n10051457)**.  
- Pulled and run on **EC2 instance** with environment variables.  
- **Demo**: Show ECR repository in AWS console, then docker pull/run on EC2.  
  - [T: ECR + EC2 demo @ 00:48]

### REST API
- Endpoints implemented in Express:
  - `POST /api/auth/login` – JWT login (hard-coded users alice/bob).
  - `POST /api/upload` – upload video.
  - `GET /api/files` – list user files (pagination, sorting, filtering).
  - `POST /api/transcode` – async transcode.
  - `POST /api/transcode/sync` – sync transcode.
  - `GET /api/jobs/:id` – query job status.
  - `POST /api/thumbnails` – generate thumbnails.
  - `GET /api/files/:id/thumbnails` – list thumbnails.
- **Demo**: Summarise endpoints in video, then show one or two with curl/browser.  
  - [T: REST API demo @ 03:21]

### User login
- Simple hard-coded users: `alice/alice123`, `bob/bob123`.
- JWT returned and used for authentication on other API calls.
- **Demo**: Log in and show token.  
  - [T: Login demo @ 01:58]

---

## Additional Criteria (10 marks)

### Extended API features
- File listing supports **pagination**, **filter by owner**, and **sort by uploadedAt/size**.
- **Demo**: Call `/api/files?page=1&sort=uploadedAt&order=desc`.  
  - [T: Extended API demo @ 04:06]

### External APIs
- Integrated with 3 external APIs:
  - **YouTube API** – search related videos.
  - **TMDB API** – movie database search.
  - **Pixabay API** – free image search.
- **Demo**: Show related results displayed in `/public` frontend.  
  - [T: External API demo @ 03:43]

### Additional data types
- Generates **thumbnails** from uploaded video (image files).
- Stored under `storage/thumbnails/<videoId>/`.
- **Demo**: Call `/api/thumbnails` then list files in directory.  
  - [T: Thumbnail demo @ 04:42]

### Custom processing
- Beyond transcoding: generates multiple thumbnails every N seconds.
- **Demo**: Show sample thumbnails in browser `/thumbnails/...jpg`.  
  - [T: Custom processing demo @ 04:52]

### Web client
- `public/index.html` + `external.js` frontend allows:
  - Login
  - Upload video
  - Trigger transcode
  - Show thumbnails
  - Show external API results
- **Demo**: Use web client to log in and perform operations.  
  - [T: Web client demo @ 00:00]
