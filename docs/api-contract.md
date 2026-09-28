# tinyPet API contract (v1)

Base: `/api/v1`. JSON. Envelope: `{ ok: true, data, meta? }` | `{ ok: false, error: { code, message, details } }`.
Auth: web → NextAuth cookie (`/api/auth/*`); mobile → `Authorization: Bearer <jwt>` from `POST /auth/login|register`.
Partner context: header `X-Partner-Id` (membership required). Pagination: `?page=&pageSize=` → `meta { page, pageSize, total }`.
All request bodies validated by Zod schemas in `packages/shared/src/schemas.ts` (schema names in parentheses).
Errors: 400 VALIDATION/BAD_REQUEST · 401 UNAUTHORIZED · 402 PLAN_LIMIT `{featureKey,current,limit,planKey}` · 403 FORBIDDEN · 404 · 409 CONFLICT · 429.

## Implemented (base)
- `POST /auth/register` (registerSchema) → `{ token, user, memberships }` · `POST /auth/login` (loginSchema) → same
- `GET /auth/me` → `{ user{ id,name,email,role,avatarUrl,ownerTerm,ownerTermId,emailVerified,plan,marketingConsent,statsConsent }, memberships[{ membershipId,partnerId,partnerName,slug,logoUrl,role,canSeeFinance,plan,published }] }` · `PATCH /auth/me` (updateProfileSchema) · `DELETE /auth/me` (LGPD)
- `POST /auth/verify {channel:"EMAIL"|"PHONE", target?}` sends code · `PUT /auth/verify` (verifyCodeSchema) confirms
- `POST /media/upload` (uploadRequestSchema) → `{ assetId, uploadUrl, method:"PUT", headers, url }` · `PUT /media/upload/:assetId` (local dev sink) · `POST /media/complete` (uploadCompleteSchema, optional crop) → `{ id,url,thumbUrl,kind,width,height,sizeBytes }`
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
- `GET /pets` (mine + shared via PetAccess; `?includeDeceased`) · `POST /pets` (petSchema; assertLimit owner_pets counting `createdByPartnerId null && status ACTIVE`) · `GET|PATCH|DELETE /pets/:id` (assertPetAccess)
- `POST /pets/:id/deceased` (markDeceasedSchema): cancels future appointments (notify partners), pauses tasks, status DECEASED · `DELETE /pets/:id/deceased` undo
- `GET|POST /pets/:id/access` (petAccessSchema by e-mail) · `DELETE /pets/:id/access/:uid`
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
