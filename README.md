# Rutbaa Fashion backend

Serverless Express API for Vercel with MongoDB. Authentication, password hashes, database access, JWT signing, and owner authorization stay entirely here. Never put `.env` values in the frontend or commit them.

## Local setup

1. Create a MongoDB Atlas project and database, then copy `.env.example` to `.env`.
2. Fill in `MONGODB_URI`, a strong random `JWT_SECRET`, and the shop owner's `OWNER_EMAIL`.
3. Run `npm install` and `npm start`.
4. The health endpoint is `GET /api/health`.

The first registration using `OWNER_EMAIL` gets the `owner` role. Set this before creating that account. Other accounts are customers.

## Deploy to Vercel

Import this **backend** folder as its own Vercel project. Add `MONGODB_URI`, `JWT_SECRET`, `OWNER_EMAIL`, and `FRONTEND_ORIGIN` (the deployed frontend URL) in Vercel → Settings → Environment Variables for Production and Preview as appropriate. In MongoDB Atlas, add `0.0.0.0/0` to **Network Access** (or otherwise allow Vercel's dynamic outbound addresses); without this, Vercel cannot reach the database and signup will time out. Deploy, then verify `https://your-backend.vercel.app/api/health` returns `{"ok":true}`.

## API

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/products`; owner-only `POST/PATCH/DELETE /api/products`
- `GET/POST /api/reviews`; owner-only `PATCH /api/reviews/:id/reply`

Protected endpoints require `Authorization: Bearer <token>`.
