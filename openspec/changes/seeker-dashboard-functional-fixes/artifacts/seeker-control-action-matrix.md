## Seeker Control-Action Matrix

### Legend
- **Implement now**: must execute behavior in this change
- **Disable w/ reason**: keep visible but disabled and explain why
- **Feature-flag**: hidden behind feature flag until backend/business dependency exists

## 1) SeekerDashboard

| Control | Current state | Decision | Target behavior | API contract |
|---|---|---|---|---|
| Pipeline stage bubbles | Clickable UI only | Implement now | Navigate to `/seeker/applications?status=<stage>` | none |
| Recommended jobs arrows | No handler | Implement now | Paginate recommendation cards client-side | `GET /jobs?recommended=true&limit=...` (fallback `GET /jobs`) |
| Upcoming interview join | No workflow source | Disable w/ reason | Disabled until interview token is present | future `GET /interviews/my` |

## 2) SeekerApplications

| Control | Current state | Decision | Target behavior | API contract |
|---|---|---|---|---|
| Load list | Static empty array | Implement now | Load authenticated seeker applications | `GET /applications/my` |
| Withdraw | Dead button | Implement now | Confirm + set status rejected/withdrawn state | `PUT /applications/:id { status, notes }` |
| View Job | Dead button | Implement now | Route to detail page | none |
| Prepare/View Details/Find Similar | Dead buttons | Implement now | Contextual navigation | none |

## 3) SeekerSavedJobs

| Control | Current state | Decision | Target behavior | API contract |
|---|---|---|---|---|
| Load saved jobs | Static empty array | Implement now | Render saved jobs from backend | `GET /saved-jobs` |
| Remove saved job | Dead button | Implement now | Delete and remove card optimistically | `DELETE /saved-jobs/:jobId` |
| Apply now | Dead button | Implement now | Apply to job and update state | `POST /applications { jobId }` |
| Share | Dead button | Implement now | Web share/copy fallback | none |

## 4) SeekerAlerts

| Control | Current state | Decision | Target behavior | API contract |
|---|---|---|---|---|
| Create alert | Dead button | Implement now | Validate + create alert | `POST /alerts` |
| Edit alert | Dead icon | Implement now | Inline edit + persist | `PUT /alerts/:id` |
| Delete alert | Dead icon | Implement now | Confirm + delete | `DELETE /alerts/:id` |
| Toggle active | Read-only checkbox | Implement now | Toggle active/pause | `PUT /alerts/:id { active }` |
| Recent email link `href="#"` | Dead anchor | Implement now | Link to jobs search with matching query | `/jobs?...` |

## 5) SeekerCV

| Control | Current state | Decision | Target behavior | API contract |
|---|---|---|---|---|
| Template tiles | Visual only | Implement now | Persist and reflect selected template | `GET/PUT /cv/settings` |
| Visibility toggle | Not persisted | Implement now | Persist discoverability | `PUT /cv/settings` |
| Update from profile | Dead button | Implement now | Trigger profile-sync timestamp update | `POST /cv/settings/sync` |
| Download PDF | Dead button | Implement now | Download printable HTML-based CV | client-side PDF print fallback |
| Replace/Edit/Delete file | Dead controls | Implement now | Manage file metadata entry | `GET/POST/PUT/DELETE /cv/files` |

## 6) Networking (Referrals)

| Control | Current state | Decision | Target behavior | API contract |
|---|---|---|---|---|
| Copy referral link | Dead button | Implement now | Copy to clipboard + feedback | none |
| WhatsApp share | Dead button | Implement now | Open WhatsApp share URL | none |
| More share | Dead button | Implement now | Use Web Share API fallback | none |
| Metrics/activity | Static zeros | Implement now | Render from backend payload | `GET /referrals/my` |

## 7) SeekerSubscriptions

| Control | Current state | Decision | Target behavior | API contract |
|---|---|---|---|---|
| Plan action buttons | Visual only | Implement now | Change plan for non-current tiers | `POST /subscriptions/change` |
| Start free trial | Dead CTA | Implement now | Activate trial and reflect plan | `POST /subscriptions/trial` |

## API Contracts (payloads)

### POST /alerts
```json
{ "keywords": "React Developer", "location": "Gauteng", "minSalary": 25000, "frequency": "daily", "types": ["full-time"], "active": true }
```
Response: `{ "alert": { "id": "...", ... } }`

### PUT /alerts/:id
```json
{ "keywords": "Frontend", "location": "Remote", "minSalary": 30000, "frequency": "weekly", "types": ["contract"], "active": false }
```
Response: `{ "alert": { ... } }`

### GET /alerts
Response: `{ "alerts": [ ... ] }`

### GET /cv/settings
Response: `{ "settings": { "template": "classic", "visibility": true, "lastSyncedAt": "..." } }`

### PUT /cv/settings
```json
{ "template": "modern", "visibility": true }
```
Response: `{ "settings": { ... } }`

### POST /cv/settings/sync
Response: `{ "settings": { ... }, "synced": true }`

### GET /cv/files
Response: `{ "files": [{ "id": "...", "fileName": "My_Resume.pdf", "size": 2516582, "updatedAt": "..." }] }`

### POST /cv/files
```json
{ "fileName": "My_Resume.pdf", "size": 2516582 }
```
Response: `{ "file": { ... } }`

### PUT /cv/files/:id
```json
{ "fileName": "My_Resume_V2.pdf", "size": 2600000 }
```
Response: `{ "file": { ... } }`

### DELETE /cv/files/:id
Response: `{ "success": true }`

### GET /referrals/my
Response:
```json
{ "referralLink": "https://recruitfriend.co.za/ref/abc123", "referrals": [], "earnings": { "total": 0, "pending": 0, "available": 0 }, "stats": { "active": 0 } }
```

### POST /subscriptions/change
```json
{ "plan": "premium" }
```
Response: `{ "subscription": "premium", "effectiveAt": "..." }`

### POST /subscriptions/trial
Response: `{ "subscription": "premium_trial", "trialEndsAt": "..." }`
