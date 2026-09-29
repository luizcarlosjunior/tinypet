# tinyPet API contract (v1)

Base: `/api/v1`. JSON. Envelope: `{ ok: true, data, meta? }` | `{ ok: false, error: { code, message, details } }`.
Auth: web → NextAuth cookie (`/api/auth/*`); mobile → `Authorization: Bearer <jwt>` from `POST /auth/login|register`.
Partner context: header `X-Partner-Id` (membership required). Pagination: `?page=&pageSize=` → `meta { page, pageSize, total }`.
All request bodies validated by Zod schemas in `packages/shared/src/schemas.ts` (schema names in parentheses).
Errors: 400 VALIDATION/BAD_REQUEST · 401 UNAUTHORIZED · 402 PLAN_LIMIT `{featureKey,current,limit,planKey}` · 403 FORBIDDEN · 404 · 409 CONFLICT · 429.

## Implemented (base)
- `POST /auth/register` (registerSchema) → `{ token, user, memberships }` · `POST /auth/login` (loginSchema) → same
- `GET /auth/me` → `{ user{ id,name,email,username,role,avatarUrl,ownerTerm,ownerTermId,emailVerified,plan,marketingConsent,statsConsent }, memberships[{ membershipId,partnerId,partnerName,slug,logoUrl,role,canSeeFinance,plan,published }] }` · `PATCH /auth/me` (updateProfileSchema; `username` string|null — 409 when taken) · `GET /auth/username-available?u=` (public, 60/min per IP) → `{ available, reason?: "INVALID"|"RESERVED"|"TAKEN" }`
- Username (`usernameSchema`): lowercase `^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])$` (3–30, no leading/trailing `.`/`_`, no `..`), a leading `@` is stripped; reserved: admin, tinypet, suporte, support, root, api, www, blog, parceiro, tutor, null, undefined. Optional in registerSchema (`""` = none), editable in PATCH /auth/me · `DELETE /auth/me` (LGPD)
- `POST /auth/verify {channel:"EMAIL"|"PHONE", target?}` sends code · `PUT /auth/verify` (verifyCodeSchema) confirms
- `POST /media/upload` (uploadRequestSchema) → `{ assetId, uploadUrl, method:"PUT", headers, url }` · `PUT /media/upload/:assetId` (local dev sink) · `POST /media/complete` (uploadCompleteSchema, optional crop, optional coverAssetId) → `{ id,url,thumbUrl,kind,width,height,sizeBytes, durationSeconds? }` (videos only: real duration in seconds; `null` when the asset was already READY) · `POST /media/:assetId/cover { coverAssetId }` → `{ id,url,thumbUrl,kind,width,height,sizeBytes }` · `GET /media/limits` → `{ audience, planKey, videosPerDay, videosUsedToday, videoMaxSeconds, maxBytes }` — see **Media** below

## Media
Flow: `POST /media/upload` → `PUT` bytes to `uploadUrl` with exactly `headers` (S3 presigned; `Content-Length` is signed) → `POST /media/complete`. Max 10 MB (`MEDIA_MAX_BYTES`) for everything. Partner purposes (`PARTNER_LOGO`, `VENUE_PHOTO`, `CATALOG`, `COURSE`) need `X-Partner-Id`; any other purpose sent with `X-Partner-Id` also belongs to the partner.

**Videos** (`PET_GALLERY`, `CATALOG`, `COURSE`) are always transcoded **on the device** (web and app) to `VIDEO_OUTPUT` before upload: MP4 · H.264 (`avc1`/`avc3`) · AAC · 1920×1080, 1280×720, 1080×1920 or 720×1280 (1080p when the source short side ≥ 1080, else 720p; 16:9 landscape / 9:16 portrait) · video ≤ 1 Mbps, audio ≤ 128 kbps. At ≤ 1.128 Mbps the 10 MB cap is ≈ 70 s.
1. Transcode on the device; extract a frame (default) or let the user pick/crop an image for the cover.
2. Upload the cover: `purpose:"VIDEO_COVER"` (image), then `POST /media/complete { assetId, crop }` — `crop` (or the whole image when omitted) must be 16:9 or 9:16 within 2%; stored as WebP, long side `VIDEO_COVER_MAX_PX` (1280), fit inside, EXIF stripped.
3. Upload the video: `POST /media/upload { purpose, mimeType:"video/mp4", sizeBytes, fileName, width, height, durationSeconds }` → PUT.
4. `POST /media/complete { assetId: <video>, coverAssetId }` → `thumbUrl` = cover `url`. Without `coverAssetId`, `thumbUrl` stays `null`. Change later with `POST /media/:assetId/cover { coverAssetId }` (video must be READY).

Server checks — step 1 (`/media/upload`): `mimeType === "video/mp4"`, declared `width`/`height` one of the 4 frames, `durationSeconds > 0`, `sizeBytes ≤ 10 MB`, then plan limits. Step 2 (`/media/complete`): real size + magic bytes, then the MP4 is parsed (mediabunny): container MP4 (not QuickTime), exactly 1 video track H.264, ≤ 1 audio track AAC, no other tracks; display size (rotation matrix applied) equal to the declared `width`/`height`; measured average bitrate (sample sizes ÷ duration) video ≤ 1.1 Mbps and audio ≤ 140.8 kbps (`bitrateTolerance` 10%); whole file ≤ (1.1 + 0.1408) Mbps × duration + 64 KB; real duration ≤ plan max + 0.5 s. Any failure deletes the object, marks the asset `REJECTED` and returns an error (start over with a new `/media/upload`).
Cover checks: `coverAssetId` must be a READY `VIDEO_COVER` image of the same owner (same user, or same partner) that the caller can access, with the video's aspect (landscape vs portrait, 2%).

Errors — 400 `BAD_REQUEST` with `details.reason`:
| reason | message (pt-BR) | when |
|---|---|---|
| `VIDEO_FORMAT` | Converta o vídeo para MP4 1080p ou 720p (16:9 ou 9:16) antes de enviar | mime ≠ video/mp4 (upload) or container not MP4 / magic bytes (complete) |
| `VIDEO_FRAME` | (same as above) | declared or real frame not 1920×1080/1280×720/1080×1920/720×1280 |
| `VIDEO_DURATION` | Informe a duração do vídeo (durationSeconds maior que zero) | missing/zero duration, or empty track |
| `VIDEO_TOO_LARGE` | Vídeo acima de 10 MB após a conversão; envie um trecho mais curto (até ~70 s) | `sizeBytes` or real size > 10 MB |
| `VIDEO_INVALID` | Vídeo inválido ou corrompido | unparseable MP4 |
| `VIDEO_TRACKS` | O vídeo precisa ter exatamente uma faixa de vídeo e no máximo uma de áudio | |
| `VIDEO_CODEC` | O vídeo precisa estar em H.264 (MP4). Converta o vídeo antes de enviar | e.g. HEVC |
| `AUDIO_CODEC` | O áudio do vídeo precisa estar em AAC. Converta o vídeo antes de enviar | |
| `VIDEO_DIMENSIONS_MISMATCH` | As dimensões do vídeo não correspondem às informadas no envio | real ≠ declared width/height |
| `VIDEO_BITRATE` | Taxa de bits do vídeo acima de 1 Mbps. Converta o vídeo antes de enviar | video track or whole file over the cap |
| `AUDIO_BITRATE` | Taxa de bits do áudio acima de 128 kbps. Converta o vídeo antes de enviar | |
| `COVER_ASPECT` | A capa precisa ter a mesma proporção do vídeo (16:9 ou 9:16) | cover crop not 16:9/9:16, or cover aspect ≠ video aspect |
| `COVER_PURPOSE` / `COVER_NOT_READY` | A capa precisa ser enviada com purpose VIDEO_COVER / Finalize o envio da capa antes de usá-la | |
Cover of another owner → 403; unknown cover → 404; `/media/:id/cover` on a non-READY video → 409.

**Video plan limits** — 402 `PLAN_LIMIT`, `details { featureKey, current, limit, planKey }`. Audience: partner asset (`X-Partner-Id`) → PARTNER plan (`videos_per_day`, `video_max_seconds`), else OWNER plan (`owner_videos_per_day`, `owner_video_max_seconds`). Free: 1 video/day, ≤ 30 s; paid plans: 10/day, ≤ 60 s.
- Duration: declared `durationSeconds` > max at `/media/upload`, or real duration > max + 0.5 s at `/media/complete` (object deleted, asset REJECTED) → "Seu plano permite vídeos de até N segundos." (`current` = rounded seconds).
- Per day: videos created since 00:00 America/Sao_Paulo with status READY/FLAGGED, or PENDING created < 1 h ago (abandoned uploads stop counting after 1 h; REJECTED never counts). When count ≥ limit at `/media/upload` → "Seu plano permite N vídeo(s) por dia. Tente novamente amanhã ou faça upgrade."
- `GET /media/limits` (optional `X-Partner-Id`) returns the caller's `{ audience, planKey, videosPerDay, videosUsedToday, videoMaxSeconds, maxBytes }` (`null` = unlimited) so clients can check before transcoding (trim to `videoMaxSeconds`).
- `GET /ref/species` (with breeds) · `GET /ref/categories` (with subcategories) · `GET /ref/brands` (with lines) · `POST /ref/brands {name,line?}` suggest · `GET /ref/owner-terms` · `GET /ref/partner-types` · `GET /ref/cep?cep=` · `GET /ref/cnpj?cnpj=`
- `GET /notifications` · `PATCH /notifications` (mark all read) · `POST|DELETE /push-tokens {token,platform}`

## Account / contacts (owner side)
- `GET|POST /me/phones` (phoneSchema) · `PATCH|DELETE /me/phones/:id` · same for `/me/emails` (emailSchema) and `/me/addresses` (addressSchema; geocode on create/update; ViaCEP handled client side via /ref/cep)
- `GET|POST /me/family` (familyMemberSchema) · `PATCH|DELETE /me/family/:id`
- `GET /me/plan` → `{ planKey, limits, usage }` (ownerUsage)
- `GET /me/export` → JSON dump of user data (LGPD)
- `GET /me/home` → `{ tasksToday[], upcomingAppointments[], recentBadges[], pets[] , overdueInstallments[] }`

## Partners
- `POST /partners` (createPartnerSchema) → creates partner (slug from tradeName), OWNER membership, default subscription. `GET /partners/mine`.
- `GET /partners/:id` (member) full profile incl. types, socialLinks, businessHours, venuePhotos, phones, emails, addresses, plan usage
- `PATCH /partners/:id` (updatePartnerSchema; replaces socialLinks/businessHours arrays when provided) · `DELETE /partners/:id` (owner; soft)
- `POST /partners/:id/publish` → validates: verified email+phone, logo or address or radius, ≥1 published catalog item → `published=true`; returns `{ published, missing[] }`
- Contacts: `GET|POST /partners/:id/phones|emails|addresses`, `PATCH|DELETE /partners/:id/phones|emails|addresses/:cid`
- `GET|POST /partners/:id/venue-photos` (venuePhotoSchema, max 10) · `PATCH|DELETE /partners/:id/venue-photos/:pid` · `PUT /partners/:id/venue-photos/order {ids[]}`
- Team: `GET /partners/:id/members` · `POST /partners/:id/members` (inviteMemberSchema; user must exist by e-mail → creates membership; assertLimit team_members) · `PATCH /partners/:id/members/:mid {role?,canSeeFinance?,jobTitle?,baseAddressId?,costPerKm?,navApp?}` · `DELETE`
- `GET /partners/:id/plan` → `{ planKey, limits, usage }` (partnerUsage)
- `GET /partners/:id/dashboard` → `{ today: appointments[], receivable30d, overdue: installments[], counts{clients,pets,appointmentsWeek} }`

## Public
- `GET /public/partners` (partnerSearchQuery) → list `{ id, slug, tradeName, logoUrl, types[], ratingAvg, ratingCount, city, state, lat, lng, distanceKm?, featured, categories[] }`, only `published && deletedAt null`, ordered featured→rating→distance
- `GET /public/partners/:slug` → profile + published catalog items + venue photos + reviews (visible) + businessHours + addresses(primary) + socialLinks
- `GET /public/items/:id` → item + partner summary + reviews
- `GET /public/partners/:slug/slots?itemId&date&membershipId?` → `Slot[]` (delegates to scheduling)
- `GET /public/courses` · `GET /public/courses/:id`

## Catalog
- `GET /catalog` (partner ctx; `?status&type&q`) · `POST /catalog` (catalogItemSchema; assertLimit catalog_items) · `GET|PATCH|DELETE /catalog/:id`
- `PUT /catalog/:id/media` `{ media: [...] }` replaces media list

## Reviews
- `POST /reviews/items/:itemId` (reviewSchema; one per user, upsert; verified = user has COMPLETED appointment or ACTIVE/COMPLETED contract with partner) → recompute item + partner ratingAvg/ratingCount
- `POST /reviews/courses/:courseId` (reviewSchema)
- `GET /reviews/mine` · `DELETE /reviews/:id` (author)
- `POST /reviews/:id/reply` (reviewReplySchema; partner member, once) · `POST /reviews/:id/report` (reportSchema)
- `GET /partners/:id/reviews` (partner ctx)

## CRM (partner ctx via X-Partner-Id)
- `GET /clients` (clientSearchQuery; includes pets summary, primary phone/email, tags, linked user) · `POST /clients` (clientSchema; assertLimit crm_clients) · `GET|PATCH|DELETE /clients/:id`
- `GET|POST /clients/:id/phones|emails|addresses`, `PATCH|DELETE .../:cid` · `GET|POST /clients/:id/family`, `PATCH|DELETE /clients/:id/family/:fid`
- `POST /clients/:id/pets` (petSchema) creates a Pet with `createdByPartnerId`, links via ClientPet · `PUT /clients/:id/pets/:petId` link existing (by invite only) · `DELETE /clients/:id/pets/:petId` unlink
- `POST /clients/:id/invite` (clientInviteSchema) → ClientInvite token, e-mail sent with `${APP_URL}/convite/:token` · `GET /clients/:id/invites`
- `GET /invites/:token` (public) → `{ partner, clientName, pets[] }` · `POST /invites/accept` (acceptInviteSchema, auth) → sets client.userId, merges pets (`petMerges`: ownerPetId null = adopt partner pet as own: sets ownerId; otherwise link owner pet to client and soft-delete partner duplicate), returns client
- `GET /clients/birthdays?month=` → `{ clients[], pets[] }`
- `GET /clients/export` CSV · `POST /clients/import` (multipart `file` CSV: name,email,phone,petName,species) → `{ created, skipped }`

## Pets (owner side; partner side reads via clients)
- `GET /pets` (mine + shared via PetAccess; `?includeDeceased`; items have `role: "owner"|"shared"`, `owner{ id,name,username,avatarUrl }` and legacy `access` "OWNER"|"VIEW") · `POST /pets` (petSchema — `sex` MALE|FEMALE required on create; `microchip` null or exactly 15 digits (ISO 11784/11785; spaces/dots/dashes ignored); assertLimit owner_pets counting `createdByPartnerId null && status ACTIVE`) · `GET|PATCH|DELETE /pets/:id` (assertPetAccess; GET adds `role: "owner"|"shared"|"partner"`; `accesses[]` only lists everyone for the owner — a shared account sees only its own row; PATCH/DELETE owner only)
- `POST /pets/:id/deceased` (markDeceasedSchema: `deceasedAt`, `memorialNote?`, `password` — or `code` for accounts without a password): **irreversible** (no undo endpoint); requires the primary owner (or a linked partner for pets without an owner) to confirm with their password; rate limited (5 tries / 15 min); cancels future appointments (notify partners), pauses tasks, status DECEASED; audited (`pet.deceased`). Errors: 400 `PASSWORD_REQUIRED` / `PASSWORD_INVALID` / `CODE_REQUIRED`, 409 when already registered · `POST /pets/:id/deceased/code` sends a 10-minute e-mail code (only for accounts without a password)
- `GET|POST /pets/:id/access`, `DELETE /pets/:id/access/:uid` → **410 GONE** (replaced by invites, see **Pet sharing**)
- `GET /pets/:id/media?story=` · `POST /pets/:id/media` (petMediaSchema; assertFeature owner_gallery / owner_stories; story expiresAt = takenAt+24h) · `PATCH|DELETE /pets/:id/media/:mid`
- `GET /pets/:id/history` (timeline; merges PetHistoryEvent + completed appointments + vaccinations + measurements + earned badges, sorted desc) · `POST /pets/:id/history` (historyEventSchema; partner or owner)
- `GET|POST /pets/:id/foods` (petFoodSchema) · `PATCH|DELETE /pets/:id/foods/:fid` · `GET /pets/:id/foods/suggestions` → nearby partners with brand in catalog + active promos
- `GET /pets/:id/measurements?period=6m|1y|all` → `{ items[], lifeStage, reference? , alerts[] }` · `POST /pets/:id/measurements` (bodyMeasurementSchema; vetVerified when partner is vet_clinic) · `PATCH|DELETE .../:mid` (owner cannot edit partner rows) · `GET /pets/:id/measurements/export` (PDF-ish HTML printable)
- `GET /pets/:id/skills` → `{ skills[{ skillId,name,level,masteredAt,validated,markedBy }], available[] }` · `PUT /pets/:id/skills` (petSkillSchema) · `DELETE /pets/:id/skills/:sid` · `POST /pets/:id/skills/:sid/validate` (partner trainer)
- `GET /pets/:id/skills/comparison` (skillComparisonQuery) → `{ scope, groupSize, widened, perSkill[{skillId,name,pct}], summary{ mastered, percentile } }` reads SkillStat
- `GET|POST /pets/:id/vaccinations` (vaccinationSchema) · `PATCH|DELETE .../:vid`
- `GET /pets/:id/tasks` · `POST /pets/:id/tasks` (taskSchema) · `PATCH|DELETE /pets/:id/tasks/:tid` · `POST /pets/:id/tasks/:tid/complete` (taskCompleteSchema) · `POST /pets/:id/tasks/:tid/accept` (PROPOSED→ACTIVE) · `GET /pets/:id/tasks/templates`
- `GET /pets/:id/badges` · `GET /pets/:id/milestones` (shareable timeline)
- `GET /pets/:id/report-card` (birthday card data)

## Pet sharing & ownership transfer
One account owns a pet (`Pet.ownerId`); the owner shares it by **invite** with other accounts (found by @username or e-mail) which accept or decline.
**Shared accounts are read-only**: they see everything the owner sees (profile, history, health, measurements, vaccinations, skills, foods, badges, gallery items FAMILY/PARTNERS/PUBLIC, tasks, appointments) and may only **mark tasks done** (`POST /pets/:id/tasks/:tid/complete`). Every other pet mutation, booking/cancel/reschedule (`/bookings`, `/me/appointments/:id/*` — listing items carry `canManage`), course enrollment and partner revocation is owner-only (403). `PetAccess.level` is ignored.
Ownership can be transferred to a shared account 7 days after its sharing started (`PetAccess.createdAt`) and 7 days after the owner got the pet (`Pet.ownershipSince`, null = no cooldown). After the transfer the previous owner becomes a shared account (sharing restarts). Invites expire in 14 days, transfers in 7 (lazily). DECEASED pets: no invites/transfers (409). Pending invites/transfers become invalid (409 on accept) if the pet is deleted/deceased or changes owner.
- `GET /pets/:id/sharing` (owner or shared) → `{ role:"owner"|"shared", owner{ id,name,username,avatarUrl }, ownerSince, canTransferFrom: ISO|null, shares[{ userId,name,username,avatarUrl,since,transferEligibleAt,canTransferNow }] (shared role: only self), invites[{ id, to{…}, createdAt, expiresAt }] (owner only, PENDING), pendingTransfer{ id,to,createdAt,expiresAt }|null (shared role: only when addressed to self) }`
- `POST /pets/:id/share-invites { handle }` (shareInviteSchema; owner; `@user`, `user` or e-mail; 20/h per owner, lookups count) → 201 `{ id, to, createdAt, expiresAt }` · 404 "Nenhuma conta encontrada com esse usuário ou e-mail." · 409 already shared / pending invite / deceased · 400 self
- `DELETE /pets/:id/share-invites/:inviteId` (owner) → `{ canceled: true }` · `DELETE /pets/:id/shares/:userId` (owner; also cancels a pending transfer to it; notifies) → `{ removed: true }` · `POST /pets/:id/leave` (shared account; notifies owner) → `{ left: true }`
- `POST /pets/:id/ownership-transfers { toUserId, password?, code? }` (ownershipTransferSchema; owner; one PENDING per pet, 409) → 201 `{ id, to, createdAt, expiresAt }`; 400 reasons `TRANSFER_TOO_EARLY` (`details.availableAt`), `PASSWORD_REQUIRED`, `PASSWORD_INVALID`, `CODE_REQUIRED`; audited `pet.ownership_transfer_request` · `POST /pets/:id/ownership-transfers/code` (OAuth-only accounts; reauth action `pet_transfer`) → `{ sent: true }` · `DELETE /pets/:id/ownership-transfers/:transferId` (owner) → `{ canceled: true }`
- `GET /me/pet-invites` → `{ shares[{ id, pet{ id,name,avatarUrl,species{ id,key,label } }, from{ id,name,username,avatarUrl }, createdAt, expiresAt }], transfers[same] }` (PENDING, not expired)
- `POST /me/pet-invites/:id/accept|decline` → `{ id, status:"ACCEPTED"|"DECLINED", petId }` · `POST /me/pet-transfers/:id/accept|decline` → same; accept checks the recipient's `owner_pets` limit (402 PLAN_LIMIT; the pet counts unless partner-created), then atomically: owner = recipient, `ownershipSince` = now, recipient's PetAccess removed, PetAccess for the previous owner (createdAt now), other pending invites/transfers of the pet canceled; audited `pet.ownership_transfer`. Partner links (ClientPet) are unchanged. 404 not mine · 409 expired/answered/invalid
- `GET /me/home` adds `pendingPetInvites: number` (share invites + transfers) and `pets[].role`
- Notifications (`data: { petId, inviteId|transferId, route }`): `pet_share_invite` (→ invitee, route `/convites`, e-mail), `pet_share_accepted` / `pet_share_declined` (→ owner, `/pets/<id>`), `pet_share_removed` (→ removed account, `/pets`), `pet_share_left` (→ owner, `/pets/<id>`), `pet_transfer_request` (→ recipient, `/convites`, e-mail), `pet_transfer_accepted` (→ both, `/pets/<id>`, e-mail), `pet_transfer_declined` (→ owner, `/pets/<id>`, e-mail)

## Scheduling (partner ctx)
- `GET|PUT /schedule/availability?membershipId=` (availabilitySchema) · `GET|POST /schedule/time-off` (timeOffSchema) · `DELETE /schedule/time-off/:id`
- `GET /schedule/appointments` (agendaQuery) → includes pets, client, item, membership, address, travelLeg · `POST /schedule/appointments` (appointmentSchema; conflict check against availability, time-offs, other appointments+travel legs+buffer; recurrence generates series with `seriesId`; status CONFIRMED; creates TravelLeg for CLIENT_HOME using estimateTravel from previous appointment or member base address)
- `GET|PATCH|DELETE /schedule/appointments/:id` · `POST /schedule/appointments/:id/status` (appointmentStatusSchema; COMPLETED writes PetHistoryEvent VISIT with report/photos, notifies owner)
- `GET /schedule/slots` (slotsQuery) → `Slot[]` free slots for the item duration on that day (availability − time-offs − appointments − travel − buffer)
- `GET /schedule/day-route?date=&membershipId=` → `{ stops[{ appointmentId, order, address, lat,lng, startsAt, legDistanceKm, legMinutes, estimated, alert? }], totalKm, totalMinutes, googleMapsUrl, suggestions[] }`
- `GET /schedule/ical/:calendarToken` (public, text/calendar)
- Owner side: `GET /me/appointments?from&to` · `POST /bookings` (bookingRequestSchema → REQUESTED, notifyPartner) · `POST /me/appointments/:id/cancel {reason}` (respects partner.cancellationHours) · `POST /me/appointments/:id/reschedule {startsAt}` → new REQUESTED proposal

## Finance (partner ctx, `finance` permission)
- `GET /finance/contracts?status&clientId` · `POST /finance/contracts` (contractSchema; assertLimit active_contracts; generates installments: total−discount split, last absorbs rounding; optional generateAppointments for PACKAGE via scheduling) · `GET|PATCH /finance/contracts/:id` · `POST /finance/contracts/:id/status` (contractStatusSchema) · `GET /finance/contracts/:id/pdf` (HTML printable)
- `GET /finance/installments?status&from&to&clientId` · `POST /finance/installments/:id/payments` (paymentSchema; partial allowed; PAID when paidAmount ≥ amount; audit log) · `DELETE /finance/payments/:pid` · `POST /finance/installments/:id/remind` (notify owner)
- `GET|POST /finance/transactions` (transactionSchema) · `DELETE /finance/transactions/:id`
- `GET /finance/summary` (financeReportQuery) → `{ receivable, overdue[], receivedByMonth[], receivedByMethod[], receivedByService[], cashflow[] }`
- `GET /finance/export?type=installments|transactions&from&to` CSV
- Owner: `GET /me/contracts` · `GET /me/contracts/:id` · `POST /me/contracts/:id/accept` (records acceptedAt, ip) · `GET /me/installments?status`

## Courses (partner ctx)
- `GET|POST /courses` (courseSchema; assertLimit courses; paid requires assertFeature paid_courses) · `GET|PATCH|DELETE /courses/:id`
- `POST /courses/:id/modules {title}` · `PATCH|DELETE /courses/:id/modules/:mid`
- `GET|POST /courses/:id/lessons` (lessonSchema; assertLimit lessons_per_course) · `PATCH|DELETE /courses/:id/lessons/:lid`
- `GET /courses/:id/students` → enrollments + progress + questions
- Owner: `POST /public/courses/:id/enroll` (enrollSchema; paid → creates Contract type COURSE) · `GET /me/courses` · `GET /me/courses/:enrollmentId` · `POST /me/courses/:enrollmentId/lessons/:lid` (lessonProgressSchema; completing lesson with exerciseRule creates pet Task; 100% → Certificate + badge) 

## Reports
- `GET /reports/pets` (petReportQuery; partner ctx = own book with contact; admin = aggregated, groups <5 → "menos de 5") → `{ items[], groups[{key,count}], total }` · `GET /reports/pets/export` CSV
- `GET /reports/brands` (partner/admin) aggregated demand by brand/city

## Admin (role ADMIN)
- CRUD: `/admin/owner-terms`, `/admin/categories`, `/admin/subcategories`, `/admin/species`, `/admin/breeds`, `/admin/brands` (+approve), `/admin/product-lines`, `/admin/skills`, `/admin/life-stage-rules`, `/admin/badges`, `/admin/plans` (planSchema with limits), `/admin/features`, `/admin/add-ons`, `/admin/settings`
- `GET /admin/users?q` · `PATCH /admin/users/:id {role?, planKey?}` · `GET /admin/partners?q` · `PATCH /admin/partners/:id {planKey?, featured?, published?}`
- `GET /admin/reports?status` · `POST /admin/reports/:id` (moderationSchema) · `GET /admin/media?status=FLAGGED` · `POST /admin/media/:id {action}`

## Jobs (protected by `CRON_SECRET` header `x-cron-secret`)
- `POST /jobs/reminders` (24h/2h appointment reminders; installment due reminders) · `POST /jobs/overdue` (PENDING→OVERDUE) · `POST /jobs/skill-stats` (recompute SkillStat) · `POST /jobs/weight-alerts` · `POST /jobs/streaks` (streak + badges) · `POST /jobs/stories-cleanup`

## Blog
Full contract: **`docs/blog-contract.md`** — public `/blog/**` (posts, categories, views, hearts, comments), admin `/admin/blog/**` (`requireBlogEditor`: ADMIN or EDITOR; posts, categories, media multipart upload, stats, comment moderation) and jobs `/jobs/blog-views`, `/jobs/blog-publish-scheduled`. `PATCH /admin/users/:id` accepts `role: "EDITOR"`.
