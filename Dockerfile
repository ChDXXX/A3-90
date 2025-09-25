# CAB432 A01 — Video Transcode API
FROM node:20-slim

# Install ffmpeg (CPU-intensive transcoding)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Create required dirs
RUN mkdir -p storage/original storage/transcoded storage/thumbnails data

ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -f http://localhost:3000/api/_health || exit 1

CMD ["node", "index.js"]
