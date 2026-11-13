# MessInsight — Complete Deployment & Operations Manual

This guide provides end-to-end, reproducible instructions to deploy the entire MessInsight stack to production using either **Docker Compose** (all-in-one) or a **Cloud-Native Topology** (Vercel + Railway/Render + MongoDB Atlas).

---

## 1. Production Architecture Topology

```mermaid
flowchart TD
    Client["Student & Manager Browsers"] -->|HTTPS (Port 443)| WebApp["Next.js 15 Web Gateway (Vercel / Container)"]
    
    subgraph DataPlane ["Secure Private VPC / Network"]
        WebApp -->|Mongoose Pool (TLS)| MongoAtlas[("MongoDB Atlas Replica Set")]
        WebApp -->|HTTP / TLS + X-ML-Secret| MLService["FastAPI ML Microservice (Python 3.11)"]
    end
```

---

## 2. Option A: Quickest 1-Click Deployment (Docker Compose)

The easiest way to run the complete stack on an institutional VM (Ubuntu / Debian / AWS EC2):

### Prerequisites
- Docker Engine $\ge 24.0$
- Docker Compose $\ge 2.20$

### Step 1: Clone & Configure Environment
```bash
git clone https://github.com/your-org/Mess_Insight.git
cd Mess_Insight
cp .env.example .env
```

Ensure `.env` contains:
```env
MONGODB_URI=mongodb://mongodb:27017/messinsight
JWT_SECRET=production-secret-must-be-at-least-32-chars-long-123456789
INSTITUTE_EMAIL_DOMAIN=college.edu
ML_SERVICE_URL=http://ml-service:8000
ML_SERVICE_SECRET=super-secret-ml-key-change-me
```

### Step 2: Build & Start Containers
```bash
docker compose up --build -d
```

### Step 3: Seed Initial Data
```bash
docker compose exec web npm run seed
```

### Step 4: Verify Health
```bash
# Web application health
curl http://localhost:3000/api/health
# {"success":true,"data":{"status":"UP","circuitBreaker":"CLOSED","mlStatus":"UP"}}

# ML microservice health
curl http://localhost:8000/health
# {"status":"UP","service":"messinsight-ml-service","models_loaded":true}
```

---

## 3. Option B: Cloud-Native Microservices Deployment

### Component 1: MongoDB Atlas (Database)
1. Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create an **M10 Dedicated Cluster** (or M0 Free Tier for staging).
2. Go to **Database Access** $\rightarrow$ **Add New Database User**:
   - Authentication Method: Password
   - Database User Privileges: `readWriteAnyDatabase`
3. Go to **Network Access** $\rightarrow$ **Add IP Address**:
   - For Vercel/Serverless: Allow Access from Anywhere (`0.0.0.0/0`) with strong password authentication.
4. Click **Connect** $\rightarrow$ **Drivers (Node.js)** to copy the connection URI:
   ```
   mongodb+srv://<username>:<password>@cluster0.mongodb.net/messinsight?retryWrites=true&w=majority
   ```

---

### Component 2: ML Microservice (FastAPI on Railway / Render)

The ML service is packaged in `services/ml-service`.

#### Deploying on Railway:
1. Go to [Railway.app](https://railway.app/) $\rightarrow$ **New Project** $\rightarrow$ **Deploy from GitHub repo**.
2. Select repository, then choose **Root Directory**: `services/ml-service`.
3. In **Variables**, add:
   - `PORT`: `8000`
   - `ML_SERVICE_SECRET`: Generate a 32+ character random secret.
4. Railway will automatically detect the `Dockerfile` and build the container.
5. In **Settings** $\rightarrow$ **Networking**, click **Generate Domain** (e.g. `https://messinsight-ml-production.up.railway.app`).
6. Test endpoint:
   ```bash
   curl https://messinsight-ml-production.up.railway.app/health
   ```

---

### Component 3: Web App (Next.js 15 on Vercel)

The web app is located in `apps/web`.

#### Deploying on Vercel:
1. Go to [Vercel](https://vercel.com/) $\rightarrow$ **Add New Project** $\rightarrow$ Import your Git repository.
2. Configure Project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
3. Expand **Environment Variables** and enter:

| Variable | Recommended Production Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_APP_URL` | `https://your-custom-domain.edu` |
| `MONGODB_URI` | Your MongoDB Atlas connection string from Component 1 |
| `JWT_SECRET` | 32+ character cryptographically secure random string |
| `COOKIE_NAME` | `messinsight_session` |
| `INSTITUTE_EMAIL_DOMAIN` | `college.edu` |
| `MESS_TIMEZONE` | `Asia/Kolkata` |
| `ML_SERVICE_URL` | Your Railway/Render URL from Component 2 |
| `ML_SERVICE_SECRET` | Same `ML_SERVICE_SECRET` used in Component 2 |
| `EMAIL_PROVIDER` | `smtp` (or `resend`) |
| `EMAIL_FROM` | `messinsight@college.edu` |
| `STORAGE_PROVIDER` | `local` (or `s3`) |

4. Click **Deploy**. Vercel will build and deploy the Next.js App Router application with automatic HTTPS.

---

## 4. Post-Deployment Verification & Seed Checklist

Once both services are running:

### Step 1: Run Initial Database Seeding
From your development terminal (with `MONGODB_URI` pointing to Atlas):
```powershell
MONGODB_URI="mongodb+srv://<user>:<pwd>@cluster.mongodb.net/messinsight" npm run seed
```

This generates initial demo users:
- **Admin**: `admin@college.edu` (Password: `Password@123`)
- **Manager**: `manager.hostela@college.edu` (Password: `Password@123`)
- **Student**: `aarav.sharma@college.edu` (Password: `Password@123`)

### Step 2: Smoke-Test Key User Journeys
1. **Student Login & Feedback**:
   - Open your deployed URL, log in as `aarav.sharma@college.edu`.
   - Submit feedback on today's lunch menu with a comment: *"Dal was very good and warm"*.
   - Check that rating submits instantly.
2. **Manager AI Analytics**:
   - Log in as `manager.hostela@college.edu`.
   - Navigate to `/manager/analytics`.
   - Check that ratings chart, sentiment breakdown donut, and attendance bar chart render with real data.
   - Click **"Predict Tomorrow Lunch"** $\rightarrow$ verifies that Next.js backend calls the ML service and receives attendance prediction.
3. **Manager Reports**:
   - Navigate to `/manager/reports`.
   - Click **"Generate Report"** (Weekly), then download the CSV $\rightarrow$ verifies report calculation and formula injection sanitation.
4. **Admin Dashboard**:
   - Log in as `admin@college.edu`.
   - Navigate to `/admin` $\rightarrow$ verifies global stats and audit logs.

---

## 5. Monitoring, Circuit Breaker & Zero-Downtime Rollbacks

1. **System Health Probe**:
   - Periodically monitor `GET /api/health`.
   - If the ML service goes offline, the circuit breaker status switches from `UP` to `DEGRADED` or `DOWN`, while the Next.js web application continues functioning seamlessly using statistical fallback averages.
2. **Zero-Downtime Rollback**:
   - **Vercel**: Instant one-click rollback in Vercel Dashboard $\rightarrow$ Deployments $\rightarrow$ Promote to Production.
   - **Docker / Railway**: Revert Git tag and redeploy container image.
   - **Database**: Mongoose models adhere to additive schema evolution; fields are backward-compatible.
