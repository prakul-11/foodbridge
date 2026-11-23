# 🍲 FoodBridge — Surplus Food Rescue Platform

> **"Food that’s left. Hope that’s shared."**  
> A full-stack social impact web platform connecting restaurants, cafés, and event kitchens with NGOs and community shelters to rescue surplus food and deliver it to people who need it.

---

## 📖 Presentation Alignment (Slides 01 – 08)

| Slide | Topic | Platform Implementation |
|---|---|---|
| **01** | **Project Concept** | Branded header, mission statement, and intuitive dual-user orientation. |
| **02** | **The Problem & Gap** | Hero section and problem statement highlighting food waste vs. hunger and the missing coordination link. |
| **03** | **4-Step Solution** | Visual workflow: (1) Restaurant lists ➔ (2) NGO matches ➔ (3) NGO claims ➔ (4) Meals reach people. |
| **04** | **Website Features** | Restaurant onboarding, surplus listing form, NGO profile registration, food discovery, claim workflow, and pickup status updates. |
| **05** | **Food Listing Details** | Listing card matching Slide 05 format (*Vegetable Pulao, 40 meal portions, Prepared at 6:00 PM, Pickup by 8:00 PM, Location, Contact*). |
| **06** | **Safety & Trust** | Dedicated safety checklist, temperature standards (>65°C / <4°C), mandatory pickup deadlines, and partner verification flags. |
| **07** | **Expected Impact** | Live counter tracking meals rescued, kilograms saved, CO₂ emissions prevented, and partner network growth. |
| **08** | **Next Steps / Roadmap** | Interactive roadmap showing Phase 1 (basics), Phase 2 (coordination & dispatch), and Phase 3 (pilot oversight). |

---

## 🌟 Explicit User Requirement: "See All Entries Entered by the User"

The platform includes a dedicated, prominent **"ALL USER ENTRIES"** Master Database Inspector:
- **Direct Navigation Pill**: Located on the top navigation bar with a live total count badge.
- **Master Tables**:
  1. **All Food Listings Table**: Displays every food listing entered by restaurants with ID, item name, servings, prep time, deadline, kitchen address, status, and assigned NGO.
  2. **All Claim Requests Table**: Displays all claim submissions with claim ID, volunteer name, phone, ETA, and collection status.
  3. **Registered Restaurants Table**: Complete directory of partner kitchens and license details.
  4. **Registered NGOs Table**: Directory of verified rescue NGOs and their daily capacity.
  5. **Live Chronological Audit Log**: Audit trail recording every creation, claim, pickup, and status modification.
- **Search & Filter Controls**: Live filtering by keyword, status (`AVAILABLE`, `CLAIMED`, `COLLECTED`), and category (`Cooked Meals`, `Bakery`, etc.).
- **Export Capabilities**:
  - 📥 **Export to CSV**: Instant spreadsheet download for Excel or Google Sheets.
  - 📄 **Export to JSON**: Full structured database export.
- **Direct Administrative Actions**: Update listing status directly or delete entries.

---

## 🛠️ Architecture & Tech Stack

- **Backend**: Pure Node.js (`node:http`, `node:fs`, `node:path`) with zero external runtime dependencies.
- **Database**: Built-in SQLite via Node.js native `node:sqlite` (`DatabaseSync`), storing data persistently in `foodbridge.db`.
- **Frontend**: Responsive Single-Page Application (HTML5, modern CSS3 with custom variables, and vanilla JavaScript).
- **Port**: `http://localhost:3000`

---

## 🚀 How to Run the Website

### Prerequisites
- Node.js (v22.5.0 or higher; pre-tested on v26.13.1)

### Steps to Start
1. Open terminal and navigate to the project directory:
   ```bash
   cd C:\Users\Prakul\foodbridge
   ```
2. Start the server:
   ```bash
   node server.js
   ```
3. Open your browser and visit:
   ```
   http://localhost:3000
   ```

---

## 🔌 API Endpoints Reference

- `GET /api/stats` — Summary metrics (meals rescued, active listings, partners, CO₂ saved)
- `GET /api/all-entries` — Consolidated master database records (listings, claims, restaurants, NGOs, audit logs)
- `GET /api/listings` — Query food listings (supports `?status=`, `?category=`, `?search=`)
- `POST /api/listings` — Create a new surplus food listing
- `PATCH /api/listings/:id/status` — Update listing status (`AVAILABLE`, `CLAIMED`, `COLLECTED`)
- `DELETE /api/listings/:id` — Remove a listing
- `GET /api/claims` — Fetch all claim records
- `POST /api/claims` — Submit an NGO food claim with volunteer details and ETA
- `PATCH /api/claims/:id/status` — Confirm food pickup and mark distribution
- `GET /api/restaurants` / `POST /api/restaurants` — Restaurant onboarding
- `GET /api/ngos` / `POST /api/ngos` — NGO partner onboarding
- `GET /api/activity-logs` — Chronological platform audit feed
- `POST /api/reset-demo` — Reset and re-seed database with clean sample records
