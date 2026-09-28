# Zoosh Production Scheduling — Modern Factory Control Room

A production-planning and factory-control web application designed for customized furniture manufacturing.

## Features
- **Real Forward-Scheduling Engine**: True calendar date calculations skipping Sundays, strict process dependencies, decimal day durations, and employee resource constraints.
- **Modern Factory Control Room UI**: Designed with clean Linear/Notion simplicity, 8-10px rounded corners, consistent department color accents (Carpentry, Polish, Upholstery, Metal, Turning).
- **Interactive Calendar Gantt**: Proportional width bars, People / Department / Project / Today view modes, Month / Week / Today zoom levels, and a vertical "Today" indicator line.
- **Guided 4-Step Add Item Wizard**: Sequential wizard for registering new furniture items with auto-assigned SRL numbers (user never inputs SRL manually).
- **Manpower & Work Reallocation**: Detects leave collisions and enables single-click intelligent work reallocation to qualified colleagues.
- **Local Persistence**: Browser `localStorage` database with JSON Export and Import capabilities.

## Deployment to Vercel

### Option 1: Vercel CLI (Instant)
Run the following in the project root:
```bash
npx vercel
```
Or for production deployment:
```bash
npx vercel --prod
```

### Option 2: GitHub + Vercel Dashboard
1. Push this directory to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Zoosh Production Scheduling System"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
2. Log in to [vercel.com](https://vercel.com).
3. Click **Add New...** > **Project**.
4. Import your GitHub repository.
5. Click **Deploy** (no build command needed — it is pure static HTML/CSS/JS).

## Database: Does it need Supabase?
- **For V1 Deployment**: **No Supabase backend is required**. The application is 100% self-contained and uses browser `localStorage`.
- **When to add Supabase**: If you want multi-device real-time sync across multiple supervisors or user authentication. The state service in `js/state.js` is structured modularly for seamless migration.
