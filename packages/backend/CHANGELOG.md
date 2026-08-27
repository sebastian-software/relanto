# Changelog

## [0.19.8](https://github.com/sebastian-software/relanto/compare/backend-v0.19.7...backend-v0.19.8) (2026-07-22)


### Bug Fixes

* return generic 5xx instead of leaking DB errors in API auth ([#212](https://github.com/sebastian-software/relanto/issues/212)) ([1492132](https://github.com/sebastian-software/relanto/commit/1492132f7eb3f0f20be6e1ed8f272ba4f57f2099))

## [0.19.7](https://github.com/sebastian-software/relanto/compare/backend-v0.19.6...backend-v0.19.7) (2026-07-10)


### Miscellaneous Chores

* **backend:** Synchronize relanto versions

## [0.19.6](https://github.com/sebastian-software/relanto/compare/backend-v0.19.5...backend-v0.19.6) (2026-07-10)


### Miscellaneous Chores

* **backend:** Synchronize relanto versions

## [0.19.5](https://github.com/sebastian-software/relanto/compare/backend-v0.19.4...backend-v0.19.5) (2026-07-10)


### Bug Fixes

* migrate legacy TLS versions ([#205](https://github.com/sebastian-software/relanto/issues/205)) ([0bd13dc](https://github.com/sebastian-software/relanto/commit/0bd13dc40d808e404d090407611db27cad4aa929))

## [0.19.4](https://github.com/sebastian-software/relanto/compare/backend-v0.19.3...backend-v0.19.4) (2026-07-09)


### Bug Fixes

* migrate legacy token scopes ([#203](https://github.com/sebastian-software/relanto/issues/203)) ([ddf114f](https://github.com/sebastian-software/relanto/commit/ddf114fe98d15aac2636e9d25580e64098638b1e))

## [0.19.3](https://github.com/sebastian-software/relanto/compare/backend-v0.19.2...backend-v0.19.3) (2026-07-09)


### Bug Fixes

* repair local dev runtime errors ([#200](https://github.com/sebastian-software/relanto/issues/200)) ([9792aaf](https://github.com/sebastian-software/relanto/commit/9792aafb52307bd5f38cddacfbfeee76ded2d2dd))

## [0.19.2](https://github.com/sebastian-software/relanto/compare/backend-v0.19.1...backend-v0.19.2) (2026-07-09)


### Miscellaneous Chores

* **backend:** Synchronize relanto versions

## [0.19.1](https://github.com/sebastian-software/relanto/compare/backend-v0.19.0...backend-v0.19.1) (2026-07-09)


### Bug Fixes

* **deps:** update dashboard dependencies ([#190](https://github.com/sebastian-software/relanto/issues/190)) ([7ad12d9](https://github.com/sebastian-software/relanto/commit/7ad12d964d62cf28706f1875a03a8a49e78d428f))
* **deps:** update eslint and oxc toolchain ([#192](https://github.com/sebastian-software/relanto/issues/192)) ([97cadba](https://github.com/sebastian-software/relanto/commit/97cadbabcc0eaf410439cb45e574852b70a28089))

## [0.19.0](https://github.com/sebastian-software/relanto/compare/backend-v0.18.0...backend-v0.19.0) (2026-07-09)


### Features

* add per-application send rate limit ([#187](https://github.com/sebastian-software/relanto/issues/187)) ([3604024](https://github.com/sebastian-software/relanto/commit/360402474cf9e1bc0d8a1803e38467ed81a98787))


### Bug Fixes

* separate mailer crypto keys ([#189](https://github.com/sebastian-software/relanto/issues/189)) ([bdf96e3](https://github.com/sebastian-software/relanto/commit/bdf96e3d1e322e3e2b529d91bd5265e69678adef))

## [0.18.0](https://github.com/sebastian-software/relanto/compare/backend-v0.17.3...backend-v0.18.0) (2026-07-08)


### Features

* add delivery status polling API ([#180](https://github.com/sebastian-software/relanto/issues/180)) ([92c1357](https://github.com/sebastian-software/relanto/commit/92c1357aa84547f7cd1935dc50dde12a9e0752b5))
* add IP and per-token rate limiting for token and send endpoints ([#138](https://github.com/sebastian-software/relanto/issues/138)) ([da51f3f](https://github.com/sebastian-software/relanto/commit/da51f3f36d2c2227cd086ac62289d46df58f08bb))
* add structured stdout logging for job results and rejected requests ([#149](https://github.com/sebastian-software/relanto/issues/149)) ([6fb3a3f](https://github.com/sebastian-software/relanto/commit/6fb3a3fbdc33dc57cabd027a29f7f14751d2a14a))
* generate an OpenAPI 3.1 spec from the Zod schemas ([#177](https://github.com/sebastian-software/relanto/issues/177)) ([77dd7c7](https://github.com/sebastian-software/relanto/commit/77dd7c715317c57ff848d60fe7c2c6e208443d45))


### Bug Fixes

* add mail_jobs indexes for claim, metrics and list queries ([#131](https://github.com/sebastian-software/relanto/issues/131)) ([6cdb705](https://github.com/sebastian-software/relanto/commit/6cdb7059b8e4201379e2b7e298abb0b00869c370))
* classify SMTP 5xx responses as permanent failures ([#148](https://github.com/sebastian-software/relanto/issues/148)) ([c753ea5](https://github.com/sebastian-software/relanto/commit/c753ea5e7be0ec48342cd2658adeabe3abb521d1))
* eliminate N+1 ownership filtering in job and config list endpoints ([#153](https://github.com/sebastian-software/relanto/issues/153)) ([9407a40](https://github.com/sebastian-software/relanto/commit/9407a4025374f9c89f77bb95497f79b9d43c7260))
* enable WAL mode, busy_timeout and synchronous NORMAL on SQLite ([#139](https://github.com/sebastian-software/relanto/issues/139)) ([79003ef](https://github.com/sebastian-software/relanto/commit/79003ef05b44f098ef4bc1c0d36ca88fc1ce161d))
* harden backend service (retry backoff, transport close, DB boundary) ([#169](https://github.com/sebastian-software/relanto/issues/169)) ([1f07177](https://github.com/sebastian-software/relanto/commit/1f07177532c0c26148b6d42176063440f41b5900))
* invalidate access tokens issued before a same-millisecond token rotation ([#150](https://github.com/sebastian-software/relanto/issues/150)) ([787946c](https://github.com/sebastian-software/relanto/commit/787946ce1526374c73d809300814dd55cbc8fab4))
* reclaim stuck processing jobs on startup and shut down worker gracefully ([#133](https://github.com/sebastian-software/relanto/issues/133)) ([4482233](https://github.com/sebastian-software/relanto/commit/4482233113a6451721207df5e8812e4b5378fe62))
* reject oversized request bodies before parsing ([#146](https://github.com/sebastian-software/relanto/issues/146)) ([b4fe5cd](https://github.com/sebastian-software/relanto/commit/b4fe5cd0b82e52a40d78a595142a0a0038d16deb))
* run retention outside the worker hot loop with set-based SQL ([#134](https://github.com/sebastian-software/relanto/issues/134)) ([45c9fb5](https://github.com/sebastian-software/relanto/commit/45c9fb5e728b0dc3376e22d61ec96adb693cb555))
* validate recipients and reject CRLF in email headers ([#140](https://github.com/sebastian-software/relanto/issues/140)) ([d96fc45](https://github.com/sebastian-software/relanto/commit/d96fc45963afed7dbb696843d2ab66b9a013b329))
* validate required environment variables at boot (fail-fast) ([#141](https://github.com/sebastian-software/relanto/issues/141)) ([f7ff3be](https://github.com/sebastian-software/relanto/commit/f7ff3bedbb44e84faf921b36f74dadf884f5201b))
* wrap related database writes in transactions ([#147](https://github.com/sebastian-software/relanto/issues/147)) ([3e81e89](https://github.com/sebastian-software/relanto/commit/3e81e89a9c89614cc6f229d6041c04e3395924b6))

## [0.17.3](https://github.com/sebastian-software/relanto/compare/backend-v0.17.2...backend-v0.17.3) (2026-06-20)


### Bug Fixes

* **deps:** update dependency nodemailer to v9 ([e760e03](https://github.com/sebastian-software/relanto/commit/e760e031631b44ebbec754f3d7e3488f338ff7f3))
* **deps:** update dependency nodemailer to v9 ([5ace043](https://github.com/sebastian-software/relanto/commit/5ace04386273828f6b2bafd484cbaafd4d83046c))

## [0.17.2](https://github.com/sebastian-software/relanto/compare/backend-v0.17.1...backend-v0.17.2) (2026-06-08)

### Miscellaneous Chores

- **backend:** Synchronize relanto versions

## [0.17.1](https://github.com/sebastian-software/relanto/compare/backend-v0.17.0...backend-v0.17.1) (2026-06-08)

### Bug Fixes

- **deps:** release pending dependency updates ([9b67ab6](https://github.com/sebastian-software/relanto/commit/9b67ab6bf15f63820c7e777678f405f39bfd60cc))

## [0.17.0](https://github.com/sebastian-software/relanto/compare/backend-v0.16.0...backend-v0.17.0) (2026-06-08)

### Features

- allow renaming application admins and applications ([7ffed90](https://github.com/sebastian-software/relanto/commit/7ffed90a61c0b005e973ef25676c3a9bf413fa32))

## [0.16.0](https://github.com/sebastian-software/relanto/compare/backend-v0.15.0...backend-v0.16.0) (2026-06-05)

### Miscellaneous Chores

- **backend:** Synchronize relanto versions

## [0.15.0](https://github.com/sebastian-software/relanto/compare/backend-v0.14.0...backend-v0.15.0) (2026-06-05)

### Miscellaneous Chores

- **backend:** Synchronize relanto versions

## [0.14.0](https://github.com/sebastian-software/relanto/compare/backend-v0.13.0...backend-v0.14.0) (2026-06-04)

### Features

- descriptive Zod validation messages for API schemas ([99ff1ea](https://github.com/sebastian-software/relanto/commit/99ff1eab09278dfe1e12a0e106ca513d391a749a))

## [0.13.0](https://github.com/sebastian-software/relanto/compare/backend-v0.12.0...backend-v0.13.0) (2026-06-04)

### Features

- log and surface 4xx API failures in admin panel ([14b7ce8](https://github.com/sebastian-software/relanto/commit/14b7ce8f2d1dea086e126c802de0bb1d4921a2bc))

## [0.12.0](https://github.com/sebastian-software/relanto/compare/backend-v0.11.1...backend-v0.12.0) (2026-06-01)

### Features

- add application token SMTP config endpoint ([c4c2f62](https://github.com/sebastian-software/relanto/commit/c4c2f6261a5925a90edf876bf9c65c08f527e4c3))

## [0.11.1](https://github.com/sebastian-software/relanto/compare/backend-v0.11.0...backend-v0.11.1) (2026-04-21)

### Miscellaneous Chores

- **backend:** Synchronize relanto versions

## [0.11.0](https://github.com/sebastian-software/relanto/compare/backend-v0.10.0...backend-v0.11.0) (2026-04-21)

### Features

- add health and metrics API endpoints ([09ee7b8](https://github.com/sebastian-software/relanto/commit/09ee7b87d920214d4378ed00566c3e39e968df5f))

## [0.10.0](https://github.com/sebastian-software/relanto/compare/backend-v0.9.1...backend-v0.10.0) (2026-04-02)

### Miscellaneous Chores

- **backend:** Synchronize relanto versions

## [0.9.1](https://github.com/sebastian-software/relanto/compare/backend-v0.9.0...backend-v0.9.1) (2026-04-02)

### Miscellaneous Chores

- **backend:** Synchronize relanto versions

## [0.9.0](https://github.com/sebastian-software/relanto/compare/backend-v0.8.1...backend-v0.9.0) (2026-04-02)

### Features

- add lock and unlock for SMTP configurations ([7df5bda](https://github.com/sebastian-software/relanto/commit/7df5bda013f4ae7b9adf9bf3266e6768102165ed))

## [0.8.1](https://github.com/sebastian-software/relanto/compare/backend-v0.8.0...backend-v0.8.1) (2026-04-01)

### Miscellaneous Chores

- **backend:** Synchronize relanto versions

## [0.8.0](https://github.com/sebastian-software/relanto/compare/backend-v0.7.0...backend-v0.8.0) (2026-04-01)

### Features

- allow updating token scopes via API and dashboard UI ([7a8601b](https://github.com/sebastian-software/relanto/commit/7a8601bc4ab6c909108f04e865ca06ca4c68ee51))

## [0.7.0](https://github.com/sebastian-software/relanto/compare/backend-v0.6.1...backend-v0.7.0) (2026-04-01)

### Features

- replace plain token auth with client credentials and JWT access tokens ([5bae3ea](https://github.com/sebastian-software/relanto/commit/5bae3eaf2caaaf8c874f3671b6e2d8d709dd77cf))

## [0.6.1](https://github.com/sebastian-software/relanto/compare/backend-v0.6.0...backend-v0.6.1) (2026-03-31)

### Miscellaneous Chores

- **backend:** Synchronize relanto versions

## [0.6.0](https://github.com/sebastian-software/relanto/compare/backend-v0.5.0...backend-v0.6.0) (2026-03-31)

### Features

- add default smtp from address fallback ([710990a](https://github.com/sebastian-software/relanto/commit/710990a8491d492e3e003e8d9e7028a71c577416))

## [0.5.0](https://github.com/sebastian-software/relanto/compare/backend-v0.4.1...backend-v0.5.0) (2026-03-31)

### Miscellaneous Chores

- **backend:** Synchronize relanto versions

## [0.4.1](https://github.com/sebastian-software/relanto/compare/backend-v0.4.0...backend-v0.4.1) (2026-03-31)

### Bug Fixes

- surface smtp diagnostics and retry fallback targets ([e5700cb](https://github.com/sebastian-software/relanto/commit/e5700cb7f805f55b72aeedc56745d9790c9bec94))

## [0.4.0](https://github.com/sebastian-software/relanto/compare/backend-v0.3.0...backend-v0.4.0) (2026-03-31)

### Miscellaneous Chores

- **backend:** Synchronize relanto versions

## [0.3.0](https://github.com/sebastian-software/relanto/compare/backend-v0.2.2...backend-v0.3.0) (2026-03-31)

### Features

- send smtp test emails from the dashboard ([f12e786](https://github.com/sebastian-software/relanto/commit/f12e7867d1f34e0d47cb78af258a51b7e82aa24e))

## [0.2.2](https://github.com/sebastian-software/relanto/compare/backend-v0.2.1...backend-v0.2.2) (2026-03-31)

### Bug Fixes

- trigger patch release ([c567c1e](https://github.com/sebastian-software/relanto/commit/c567c1e66327adf924448b29da7a414b4671229f))

## [0.2.1](https://github.com/sebastian-software/relanto/compare/backend-v0.2.0...backend-v0.2.1) (2026-03-31)

### Miscellaneous Chores

- **backend:** Synchronize relanto versions

## [0.2.0](https://github.com/sebastian-software/relanto/compare/backend-v0.1.2...backend-v0.2.0) (2026-03-30)

### Features

- redact job payloads in readStatus APIs ([4a8f60f](https://github.com/sebastian-software/relanto/commit/4a8f60fa081167de8e3280103efd5265f877ecff))

### Bug Fixes

- attribute admin creation audit logs to the acting user ([b04c06d](https://github.com/sebastian-software/relanto/commit/b04c06de390affd6456c37145254fd7a2badb4a8))
- bind smtp connections to validated ip addresses ([cac7549](https://github.com/sebastian-software/relanto/commit/cac7549a869df5f0efb8539c658be3f768000c37))
- block non-global smtp target addresses ([b2e8a92](https://github.com/sebastian-software/relanto/commit/b2e8a922d56ca434a8f0f00521b9ff3e82ec0c89))
- hide deleted jobs and free their idempotency keys ([e4b1408](https://github.com/sebastian-software/relanto/commit/e4b14084806b3454b050d1dc7623734b8a08388d))
- keep smtp configs bound to their application ([c4bc92d](https://github.com/sebastian-software/relanto/commit/c4bc92d9603bebb4dea976686d2b2cd6f6e5b581))
- prevent overlapping worker ticks ([336cb5e](https://github.com/sebastian-software/relanto/commit/336cb5e40827c459330605e20d631231d5f037f2))
- reject pausing and deleting processing jobs ([823e319](https://github.com/sebastian-software/relanto/commit/823e3193cba5ebbe9eba58df1fd55f31f158b805))
- reject placeholder runtime secrets ([fb694d0](https://github.com/sebastian-software/relanto/commit/fb694d0beba954f2478c85d7ae1a70baffc7ca0a))
- remove deprecated manageOwnTokens scope ([019f5ec](https://github.com/sebastian-software/relanto/commit/019f5ecafdf58ddb793a7b36b87cd7119423a01a))
- require an explicit mailer db path outside development ([555f87d](https://github.com/sebastian-software/relanto/commit/555f87d2ba8c7fdfb038b4c841094ef3876e7d2b))
- start the worker deterministically on server boot ([2853462](https://github.com/sebastian-software/relanto/commit/285346214f631f4b53bd1ac75fea9efe1a82efd7))
- switch sqlite access to better-sqlite3 ([200dee5](https://github.com/sebastian-software/relanto/commit/200dee5234ba2c4b85cbaa21d3a9950bef2ec391))

## [0.1.2](https://github.com/sebastian-software/relanto/compare/backend-v0.1.1...backend-v0.1.2) (2026-03-30)

### Miscellaneous Chores

- **backend:** Synchronize relanto versions

## [0.1.1](https://github.com/sebastian-software/relanto/compare/backend-v0.1.0...backend-v0.1.1) (2026-03-30)

### Miscellaneous Chores

- **backend:** Synchronize relanto versions

## [0.1.0](https://github.com/sebastian-software/relanto/compare/backend-v0.0.1...backend-v0.1.0) (2026-03-30)

### Features

- add mailer api and system admin dashboard ([07c1b40](https://github.com/sebastian-software/relanto/commit/07c1b40fca2286ef37a0069a11c2a759b4010e67))
- enforce send-mail payload limits ([b31f3fe](https://github.com/sebastian-software/relanto/commit/b31f3fe148f5b6f2d6c632786558b5f68cf32ed5))
- scaffold monorepo with frontend and backend packages ([16c4264](https://github.com/sebastian-software/relanto/commit/16c4264815c8f5488a332324f78acd82e5628e69))
- split mailer ownership into applications and admin roles ([db63a4a](https://github.com/sebastian-software/relanto/commit/db63a4afd5b580acae297e2a6db1360b89d39216))

### Bug Fixes

- apply job retention from token policies ([7308992](https://github.com/sebastian-software/relanto/commit/73089928e17637f297a09f88b558efc8d3a27a50))
- claim due mail jobs atomically ([9b3c052](https://github.com/sebastian-software/relanto/commit/9b3c052475fcb0dcf8c1a702e19e0b3e9aafb3ab))
- migrate principals away from external references ([73965b6](https://github.com/sebastian-software/relanto/commit/73965b66974887f8a5a51ccc08816e487bf1ef7f))
