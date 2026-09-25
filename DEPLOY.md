# StreamHub backend → Render

1. Create a Render Web Service from this folder/repository.
2. Build command: `npm install`
3. Start command: `npm start`
4. Add every variable from `.env.example` in Render Environment Variables.
5. Replace `YOUR-BACKEND.onrender.com` with your actual Render hostname in:
   - GOOGLE_REDIRECT_URI
   - META_REDIRECT_URI
6. In Google Cloud OAuth credentials, add the exact YouTube callback URL.
7. Keep secrets only in Render environment variables; never put them in Netlify frontend code.
8. Your Netlify frontend remains: https://mygolive.netlify.app

## Current capability
- YouTube OAuth login
- YouTube live broadcast creation
- YouTube RTMP ingestion URL + stream key generation
- YouTube start/stop transitions
- Facebook OAuth route scaffold

## Still required for production
- Complete Meta/Facebook Page authorization/token exchange and Live Video flow for the exact Meta product/permissions approved to your app.
- A real RTMP relay/streaming server if the browser feed must be relayed to multiple destinations.
- Persistent encrypted token storage (sessions are only a starter).
- HTTPS, database, rate limiting, logging, privacy policy, and platform-policy compliance.
