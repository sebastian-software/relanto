# Changelog

## [0.19.8](https://github.com/sebastian-software/relanto/compare/frontend-v0.19.7...frontend-v0.19.8) (2026-07-22)


### Bug Fixes

* return generic 5xx instead of leaking DB errors in API auth ([#212](https://github.com/sebastian-software/relanto/issues/212)) ([1492132](https://github.com/sebastian-software/relanto/commit/1492132f7eb3f0f20be6e1ed8f272ba4f57f2099))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @relanto/backend bumped to 0.19.8

## [0.19.7](https://github.com/sebastian-software/relanto/compare/frontend-v0.19.6...frontend-v0.19.7) (2026-07-10)


### Bug Fixes

* hide closed dashboard confirmation modals and set email autocomplete ([#209](https://github.com/sebastian-software/relanto/issues/209)) ([a998398](https://github.com/sebastian-software/relanto/commit/a998398e4846233b4dcfc648ddbec355e4dcda63))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @relanto/backend bumped to 0.19.7

## [0.19.6](https://github.com/sebastian-software/relanto/compare/frontend-v0.19.5...frontend-v0.19.6) (2026-07-10)


### Bug Fixes

* keep dashboard detail panel alive when optional data fails to load ([#207](https://github.com/sebastian-software/relanto/issues/207)) ([1327c0f](https://github.com/sebastian-software/relanto/commit/1327c0f4307d46742b3c268895eb2b1544038772))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @relanto/backend bumped to 0.19.6

## [0.19.5](https://github.com/sebastian-software/relanto/compare/frontend-v0.19.4...frontend-v0.19.5) (2026-07-10)


### Miscellaneous Chores

* **frontend:** Synchronize relanto versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @relanto/backend bumped to 0.19.5

## [0.19.4](https://github.com/sebastian-software/relanto/compare/frontend-v0.19.3...frontend-v0.19.4) (2026-07-09)


### Miscellaneous Chores

* **frontend:** Synchronize relanto versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @relanto/backend bumped to 0.19.4

## [0.19.3](https://github.com/sebastian-software/relanto/compare/frontend-v0.19.2...frontend-v0.19.3) (2026-07-09)


### Bug Fixes

* repair local dev runtime errors ([#200](https://github.com/sebastian-software/relanto/issues/200)) ([9792aaf](https://github.com/sebastian-software/relanto/commit/9792aafb52307bd5f38cddacfbfeee76ded2d2dd))
* stabilize dashboard hydration and detail errors ([#202](https://github.com/sebastian-software/relanto/issues/202)) ([8babf14](https://github.com/sebastian-software/relanto/commit/8babf14306249c95bbd616e634eff3e609bfc8ca))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @relanto/backend bumped to 0.19.3

## [0.19.2](https://github.com/sebastian-software/relanto/compare/frontend-v0.19.1...frontend-v0.19.2) (2026-07-09)


### Bug Fixes

* keep backend code out of client bundles ([#198](https://github.com/sebastian-software/relanto/issues/198)) ([ff4caba](https://github.com/sebastian-software/relanto/commit/ff4cabae3d809e185feeb2e0981791bbffd9f1af))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @relanto/backend bumped to 0.19.2

## [0.19.1](https://github.com/sebastian-software/relanto/compare/frontend-v0.19.0...frontend-v0.19.1) (2026-07-09)


### Bug Fixes

* **deps:** update dashboard dependencies ([#190](https://github.com/sebastian-software/relanto/issues/190)) ([7ad12d9](https://github.com/sebastian-software/relanto/commit/7ad12d964d62cf28706f1875a03a8a49e78d428f))
* **deps:** update eslint and oxc toolchain ([#192](https://github.com/sebastian-software/relanto/issues/192)) ([97cadba](https://github.com/sebastian-software/relanto/commit/97cadbabcc0eaf410439cb45e574852b70a28089))
* **deps:** update palamedes to v1 ([#194](https://github.com/sebastian-software/relanto/issues/194)) ([fe00451](https://github.com/sebastian-software/relanto/commit/fe00451391d20d6f18deee7ab33176dbc4754ced))
* **deps:** update react-router monorepo to v8.1.0 ([#197](https://github.com/sebastian-software/relanto/issues/197)) ([2e8493b](https://github.com/sebastian-software/relanto/commit/2e8493b56db110d5bdf50526374d38988ebe7c4f))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @relanto/backend bumped to 0.19.1

## [0.19.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.18.0...frontend-v0.19.0) (2026-07-09)


### Features

* add per-application send rate limit ([#187](https://github.com/sebastian-software/relanto/issues/187)) ([3604024](https://github.com/sebastian-software/relanto/commit/360402474cf9e1bc0d8a1803e38467ed81a98787))
* lazy-load dashboard details ([#185](https://github.com/sebastian-software/relanto/issues/185)) ([bf2ee91](https://github.com/sebastian-software/relanto/commit/bf2ee9162f4bc74451b4c74a48a1823f879d3c5c)), closes [#110](https://github.com/sebastian-software/relanto/issues/110)


### Bug Fixes

* add admin UI security headers ([#181](https://github.com/sebastian-software/relanto/issues/181)) ([977c95e](https://github.com/sebastian-software/relanto/commit/977c95e3926c7842c3a63f568151e34051eca1b1))
* split dashboard route module ([#184](https://github.com/sebastian-software/relanto/issues/184)) ([8222974](https://github.com/sebastian-software/relanto/commit/8222974ebd00dbccd68f81ffdc5758695598a1b4)), closes [#109](https://github.com/sebastian-software/relanto/issues/109)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @relanto/backend bumped to 0.19.0

## [0.18.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.17.3...frontend-v0.18.0) (2026-07-08)


### Features

* add delivery status polling API ([#180](https://github.com/sebastian-software/relanto/issues/180)) ([92c1357](https://github.com/sebastian-software/relanto/commit/92c1357aa84547f7cd1935dc50dde12a9e0752b5))
* add IP and per-token rate limiting for token and send endpoints ([#138](https://github.com/sebastian-software/relanto/issues/138)) ([da51f3f](https://github.com/sebastian-software/relanto/commit/da51f3f36d2c2227cd086ac62289d46df58f08bb))
* add localized meta exports with Open Graph tags to UI routes ([#166](https://github.com/sebastian-software/relanto/issues/166)) ([6f4d1ed](https://github.com/sebastian-software/relanto/commit/6f4d1ed825dd20f5284e7cd629cd5afff1b21121))
* add structured stdout logging for job results and rejected requests ([#149](https://github.com/sebastian-software/relanto/issues/149)) ([6fb3a3f](https://github.com/sebastian-software/relanto/commit/6fb3a3fbdc33dc57cabd027a29f7f14751d2a14a))
* brand login entry and remove dead welcome starter code ([#165](https://github.com/sebastian-software/relanto/issues/165)) ([cb2a9f1](https://github.com/sebastian-software/relanto/commit/cb2a9f10a4ec1276da2ed8dfd1a505f6e26374c8))
* generate an OpenAPI 3.1 spec from the Zod schemas ([#177](https://github.com/sebastian-software/relanto/issues/177)) ([77dd7c7](https://github.com/sebastian-software/relanto/commit/77dd7c715317c57ff848d60fe7c2c6e208443d45))
* use PATCH for token scope updates and document HTTP method conventions ([#126](https://github.com/sebastian-software/relanto/issues/126)) ([be4d84a](https://github.com/sebastian-software/relanto/commit/be4d84a0ee29bf51899c9c323e4093e89eea81b0))


### Bug Fixes

* add accessible names, live regions and ARIA state to the admin UI ([#158](https://github.com/sebastian-software/relanto/issues/158)) ([fc33faf](https://github.com/sebastian-software/relanto/commit/fc33faf5d9c6269ea29c69b1edad2aab275de116))
* add focus management, trap and escape to the confirmation dialog ([#155](https://github.com/sebastian-software/relanto/issues/155)) ([cd53df2](https://github.com/sebastian-software/relanto/commit/cd53df288587c9607e86c292b171dbf6072c9e25))
* add job-delete confirmation, secret copy button, login polish and password autocomplete ([#159](https://github.com/sebastian-software/relanto/issues/159)) ([f6176f8](https://github.com/sebastian-software/relanto/commit/f6176f844843f030b5ee9e9ed454b7c175cdde01))
* close i18n gaps in the admin UI (missing keys, plurals, locale-aware dates) ([#157](https://github.com/sebastian-software/relanto/issues/157)) ([f2f6869](https://github.com/sebastian-software/relanto/commit/f2f68695d9a5f7afb6f55ca7f42f8846dec78872))
* disable submit buttons and show pending state during submission ([#156](https://github.com/sebastian-software/relanto/issues/156)) ([a9dc9f1](https://github.com/sebastian-software/relanto/commit/a9dc9f109dcc879c2648bbd8192dd48815205d6c))
* eliminate N+1 ownership filtering in job and config list endpoints ([#153](https://github.com/sebastian-software/relanto/issues/153)) ([9407a40](https://github.com/sebastian-software/relanto/commit/9407a4025374f9c89f77bb95497f79b9d43c7260))
* log framework 405 and metrics auth failures via logApiFailure ([#154](https://github.com/sebastian-software/relanto/issues/154)) ([aa8c921](https://github.com/sebastian-software/relanto/commit/aa8c9213b9a73465d241cc4b99d24d18bae1f442))
* prevent logout via GET (logout CSRF) ([#168](https://github.com/sebastian-software/relanto/issues/168)) ([45bb3e8](https://github.com/sebastian-software/relanto/commit/45bb3e852c421770b7b96b212a2d7e5406eb2b41))
* reject oversized request bodies before parsing ([#146](https://github.com/sebastian-software/relanto/issues/146)) ([b4fe5cd](https://github.com/sebastian-software/relanto/commit/b4fe5cd0b82e52a40d78a595142a0a0038d16deb))
* remove wildcard CORS preflight from send and token endpoints ([#125](https://github.com/sebastian-software/relanto/issues/125)) ([c3924a7](https://github.com/sebastian-software/relanto/commit/c3924a7d6525b40cf0f1b1e711bfd46e9458c6eb))
* return 400 for malformed or non-object JSON request bodies ([#145](https://github.com/sebastian-software/relanto/issues/145)) ([1dfca6b](https://github.com/sebastian-software/relanto/commit/1dfca6b405bbcd0dc52309ce4ec3c9c6da0b8721))
* return 403 for authenticated tokens missing the required scope ([#151](https://github.com/sebastian-software/relanto/issues/151)) ([ca41761](https://github.com/sebastian-software/relanto/commit/ca41761b5de7fc1444629d2f83cab253ea056044))
* unify send and token error handling via withDomainErrorJson with issues ([#152](https://github.com/sebastian-software/relanto/issues/152)) ([9e051b4](https://github.com/sebastian-software/relanto/commit/9e051b434d7900de43ed2da14a1fbfb0311c0fee))
* validate required environment variables at boot (fail-fast) ([#141](https://github.com/sebastian-software/relanto/issues/141)) ([f7ff3be](https://github.com/sebastian-software/relanto/commit/f7ff3bedbb44e84faf921b36f74dadf884f5201b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @relanto/backend bumped to 0.18.0

## [0.17.3](https://github.com/sebastian-software/relanto/compare/frontend-v0.17.2...frontend-v0.17.3) (2026-06-20)


### Bug Fixes

* **deps:** migrate react-router config to v8 ([f11069e](https://github.com/sebastian-software/relanto/commit/f11069ec276360f90bf36a961f5346fd65e0e339))
* **deps:** update react-router monorepo to v7.18.0 ([98142bb](https://github.com/sebastian-software/relanto/commit/98142bb5902939458de90225babee1464fd045cc))
* **deps:** update react-router monorepo to v7.18.0 ([4a6cdf0](https://github.com/sebastian-software/relanto/commit/4a6cdf0b0f03289f3aad870c0403828f97810941))
* **deps:** update react-router monorepo to v8 ([20b61e0](https://github.com/sebastian-software/relanto/commit/20b61e074b99bc412b0ba5221c6df0ac5b2b00db))
* **deps:** update react-router monorepo to v8 ([017936f](https://github.com/sebastian-software/relanto/commit/017936f4a3c6f3e1a0f879d24c958dc182cc317e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @relanto/backend bumped to 0.17.3

## [0.17.2](https://github.com/sebastian-software/relanto/compare/frontend-v0.17.1...frontend-v0.17.2) (2026-06-08)

### Bug Fixes

- resolve validation errors from final check ([2ba9fff](https://github.com/sebastian-software/relanto/commit/2ba9fff991ebae935decb3cdbfb37c30d886f36b))
- stop double-encoding json error response bodies ([89a1255](https://github.com/sebastian-software/relanto/commit/89a12550a25f93fc21105b04727c0dccc27d1324))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.17.2

## [0.17.1](https://github.com/sebastian-software/relanto/compare/frontend-v0.17.0...frontend-v0.17.1) (2026-06-08)

### Bug Fixes

- **deps:** release pending dependency updates ([9b67ab6](https://github.com/sebastian-software/relanto/commit/9b67ab6bf15f63820c7e777678f405f39bfd60cc))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.17.1

## [0.17.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.16.0...frontend-v0.17.0) (2026-06-08)

### Features

- allow renaming application admins and applications ([7ffed90](https://github.com/sebastian-software/relanto/commit/7ffed90a61c0b005e973ef25676c3a9bf413fa32))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.17.0

## [0.16.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.15.0...frontend-v0.16.0) (2026-06-05)

### Features

- add reload button for the recent jobs panel ([e8c777f](https://github.com/sebastian-software/relanto/commit/e8c777fc0013cacec0b27a53116036eca37d049d))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.16.0

## [0.15.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.14.0...frontend-v0.15.0) (2026-06-05)

### Features

- jump from recent jobs to the application's configuration card ([d35fe91](https://github.com/sebastian-software/relanto/commit/d35fe912aa9f5324284ac342b817497591f06f1e))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.15.0

## [0.14.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.13.0...frontend-v0.14.0) (2026-06-04)

### Miscellaneous Chores

- **frontend:** Synchronize relanto versions

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.14.0

## [0.13.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.12.0...frontend-v0.13.0) (2026-06-04)

### Features

- log and surface 4xx API failures in admin panel ([14b7ce8](https://github.com/sebastian-software/relanto/commit/14b7ce8f2d1dea086e126c802de0bb1d4921a2bc))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.13.0

## [0.12.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.11.1...frontend-v0.12.0) (2026-06-01)

### Features

- add application token SMTP config endpoint ([c4c2f62](https://github.com/sebastian-software/relanto/commit/c4c2f6261a5925a90edf876bf9c65c08f527e4c3))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.12.0

## [0.11.1](https://github.com/sebastian-software/relanto/compare/frontend-v0.11.0...frontend-v0.11.1) (2026-04-21)

### Bug Fixes

- register health and metrics routes in routes.ts ([d64306e](https://github.com/sebastian-software/relanto/commit/d64306ef31d0300a8b69412bef8370ba87ed68e0))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.11.1

## [0.11.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.10.0...frontend-v0.11.0) (2026-04-21)

### Features

- add health and metrics API endpoints ([09ee7b8](https://github.com/sebastian-software/relanto/commit/09ee7b87d920214d4378ed00566c3e39e968df5f))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.11.0

## [0.10.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.9.1...frontend-v0.10.0) (2026-04-02)

### Features

- show error details for failed and uncertain jobs in dashboard ([376fc0b](https://github.com/sebastian-software/relanto/commit/376fc0b356756a7c87bc5797bf901c6ff39f0ec7))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.10.0

## [0.9.1](https://github.com/sebastian-software/relanto/compare/frontend-v0.9.0...frontend-v0.9.1) (2026-04-02)

### Bug Fixes

- register applications and token scopes API routes ([1263e08](https://github.com/sebastian-software/relanto/commit/1263e080a162c20f5006ebe4ee8e40ce66c6ef70))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.9.1

## [0.9.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.8.1...frontend-v0.9.0) (2026-04-02)

### Features

- add API endpoints for listing and creating applications ([2398180](https://github.com/sebastian-software/relanto/commit/23981804425109e23263c04fb2e90029d1d392d5))
- add application admin filter dropdown to dashboard ([153a5e0](https://github.com/sebastian-software/relanto/commit/153a5e064aab94e0f8bde5b9156f88fd38b6dbc6))
- add HTTP method validation to all API and dashboard routes ([3e65282](https://github.com/sebastian-software/relanto/commit/3e65282c327c7f6c0ff1041e68d4bcbd72985369))
- add lock and unlock for SMTP configurations ([7df5bda](https://github.com/sebastian-software/relanto/commit/7df5bda013f4ae7b9adf9bf3266e6768102165ed))

### Bug Fixes

- handle Zod validation errors as 400 JSON responses in API error wrapper ([3e7cdf5](https://github.com/sebastian-software/relanto/commit/3e7cdf5389a1ba513d8ceeb65c900f76508df8e1))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.9.0

## [0.8.1](https://github.com/sebastian-software/relanto/compare/frontend-v0.8.0...frontend-v0.8.1) (2026-04-01)

### Bug Fixes

- return consistent JSON error responses instead of throwing raw Response objects ([5702ed3](https://github.com/sebastian-software/relanto/commit/5702ed3232370c808097ba3b29749767962d65a3))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.8.1

## [0.8.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.7.0...frontend-v0.8.0) (2026-04-01)

### Features

- allow updating token scopes via API and dashboard UI ([7a8601b](https://github.com/sebastian-software/relanto/commit/7a8601bc4ab6c909108f04e865ca06ca4c68ee51))

### Bug Fixes

- return JSON error responses from API auth middleware ([3c27faf](https://github.com/sebastian-software/relanto/commit/3c27faf615ca648c147c9c17f4dfa59549e5d74d))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.8.0

## [0.7.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.6.1...frontend-v0.7.0) (2026-04-01)

### Features

- replace plain token auth with client credentials and JWT access tokens ([5bae3ea](https://github.com/sebastian-software/relanto/commit/5bae3eaf2caaaf8c874f3671b6e2d8d709dd77cf))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.7.0

## [0.6.1](https://github.com/sebastian-software/relanto/compare/frontend-v0.6.0...frontend-v0.6.1) (2026-03-31)

### Bug Fixes

- move api routes to api v1 paths ([bb4f5e1](https://github.com/sebastian-software/relanto/commit/bb4f5e1dfd047a5cb2d2b3838a8ff7fa5bd5443e))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.6.1

## [0.6.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.5.0...frontend-v0.6.0) (2026-03-31)

### Features

- add default smtp from address fallback ([710990a](https://github.com/sebastian-software/relanto/commit/710990a8491d492e3e003e8d9e7028a71c577416))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.6.0

## [0.5.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.4.1...frontend-v0.5.0) (2026-03-31)

### Features

- **frontend:** show application ids in dashboard ([28deb23](https://github.com/sebastian-software/relanto/commit/28deb233f7aba0c4638c51a0c814e610e8cdbd19))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.5.0

## [0.4.1](https://github.com/sebastian-software/relanto/compare/frontend-v0.4.0...frontend-v0.4.1) (2026-03-31)

### Bug Fixes

- surface smtp diagnostics and retry fallback targets ([e5700cb](https://github.com/sebastian-software/relanto/commit/e5700cb7f805f55b72aeedc56745d9790c9bec94))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.4.1

## [0.4.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.3.0...frontend-v0.4.0) (2026-03-31)

### Features

- show build metadata in the admin footer ([5ac48fa](https://github.com/sebastian-software/relanto/commit/5ac48fa55718d139d4eb31f6ef184ed5b7e762e2))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.4.0

## [0.3.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.2.2...frontend-v0.3.0) (2026-03-31)

### Features

- send smtp test emails from the dashboard ([f12e786](https://github.com/sebastian-software/relanto/commit/f12e7867d1f34e0d47cb78af258a51b7e82aa24e))

### Bug Fixes

- include smtp validation details in dashboard notices ([6f321a0](https://github.com/sebastian-software/relanto/commit/6f321a065cd9ca91cd6a861904b05a127e5a477d))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.3.0

## [0.2.2](https://github.com/sebastian-software/relanto/compare/frontend-v0.2.1...frontend-v0.2.2) (2026-03-31)

### Bug Fixes

- trigger patch release ([c567c1e](https://github.com/sebastian-software/relanto/commit/c567c1e66327adf924448b29da7a414b4671229f))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.2.2

## [0.2.1](https://github.com/sebastian-software/relanto/compare/frontend-v0.2.0...frontend-v0.2.1) (2026-03-31)

### Bug Fixes

- guard dashboard submits until required fields are filled ([c7c9ac8](https://github.com/sebastian-software/relanto/commit/c7c9ac83b9c3d5716760b2ff4af325585120f59a))
- guard dashboard token creation until form state is valid ([9108651](https://github.com/sebastian-software/relanto/commit/9108651f652fa6f5c0da33a2c546ef117bc21624))
- keep dashboard create forms editable ([aacdee8](https://github.com/sebastian-software/relanto/commit/aacdee828ce57bf3fd7b6168b7acf291e1c072bd))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.2.1

## [0.2.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.1.2...frontend-v0.2.0) (2026-03-30)

### Features

- add host backup and restore scripts ([7f024ec](https://github.com/sebastian-software/relanto/commit/7f024ecf2828c4afb7a8ee2843e813ac64416aed))
- redact job payloads in readStatus APIs ([4a8f60f](https://github.com/sebastian-software/relanto/commit/4a8f60fa081167de8e3280103efd5265f877ecff))

### Bug Fixes

- align api route scope requirements ([4dca7f2](https://github.com/sebastian-software/relanto/commit/4dca7f2b498af5d2ac9b25dbd32aa49b31a2f84e))
- attribute admin creation audit logs to the acting user ([b04c06d](https://github.com/sebastian-software/relanto/commit/b04c06de390affd6456c37145254fd7a2badb4a8))
- clear flashed login errors after rendering ([77af2f5](https://github.com/sebastian-software/relanto/commit/77af2f5b675dc960f7e9e33762aa20467ff1247f))
- clear transient oidc session values on login ([2d40f3c](https://github.com/sebastian-software/relanto/commit/2d40f3ca5f67853f3784991aa72ed87f2959a767))
- keep smtp configs bound to their application ([c4bc92d](https://github.com/sebastian-software/relanto/commit/c4bc92d9603bebb4dea976686d2b2cd6f6e5b581))
- map api domain errors to json responses ([6ff77b9](https://github.com/sebastian-software/relanto/commit/6ff77b91ef285994ce2315b6026ccb0726edf4a8))
- reject placeholder runtime secrets ([fb694d0](https://github.com/sebastian-software/relanto/commit/fb694d0beba954f2478c85d7ae1a70baffc7ca0a))
- reload the document when switching locales ([b99339a](https://github.com/sebastian-software/relanto/commit/b99339a9780f3ec78a6d1f231c98fcf4c428e281))
- remove deprecated manageOwnTokens scope ([019f5ec](https://github.com/sebastian-software/relanto/commit/019f5ecafdf58ddb793a7b36b87cd7119423a01a))
- report direct send failures in api responses ([128bab2](https://github.com/sebastian-software/relanto/commit/128bab2a8af1108b848b74372c4b155b0cf48dfa))
- require an explicit mailer db path outside development ([555f87d](https://github.com/sebastian-software/relanto/commit/555f87d2ba8c7fdfb038b4c841094ef3876e7d2b))
- require an explicit oidc redirect uri outside development ([507683e](https://github.com/sebastian-software/relanto/commit/507683e3103db54d1f78f38d460b9ddc066c0f44))
- require Node 24 for sqlite support ([a24c65d](https://github.com/sebastian-software/relanto/commit/a24c65d360958f4d9abb99e7d218e759ef66ec14))
- return json error responses from the send api ([070e959](https://github.com/sebastian-software/relanto/commit/070e9596250f66259928a172ac6db3838615ecd9))
- start the worker deterministically on server boot ([2853462](https://github.com/sebastian-software/relanto/commit/285346214f631f4b53bd1ac75fea9efe1a82efd7))
- surface oidc callback failures on the login page ([0880f9e](https://github.com/sebastian-software/relanto/commit/0880f9e31ff09c22f532a9dee0882613c90501b1))
- switch sqlite access to better-sqlite3 ([200dee5](https://github.com/sebastian-software/relanto/commit/200dee5234ba2c4b85cbaa21d3a9950bef2ec391))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.2.0

## [0.1.2](https://github.com/sebastian-software/relanto/compare/frontend-v0.1.1...frontend-v0.1.2) (2026-03-30)

### Bug Fixes

- read npm credentials from NPM_TOKEN during image builds ([ea2b5db](https://github.com/sebastian-software/relanto/commit/ea2b5dbee94ae551bc8961488afc2ade9035e39b))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.1.2

## [0.1.1](https://github.com/sebastian-software/relanto/compare/frontend-v0.1.0...frontend-v0.1.1) (2026-03-30)

### Bug Fixes

- publish containers from the release please workflow ([b49b015](https://github.com/sebastian-software/relanto/commit/b49b015be7ed0d4bc575efd48e65c3a71f2a858e))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.1.1

## [0.1.0](https://github.com/sebastian-software/relanto/compare/frontend-v0.0.1...frontend-v0.1.0) (2026-03-30)

### Features

- add branded svg favicon ([d01e132](https://github.com/sebastian-software/relanto/commit/d01e1323ad4f3b9a17d38a879e684fc7ac7c6ea5))
- add mailer api and system admin dashboard ([07c1b40](https://github.com/sebastian-software/relanto/commit/07c1b40fca2286ef37a0069a11c2a759b4010e67))
- add palamedes i18n integration ([a215aea](https://github.com/sebastian-software/relanto/commit/a215aea7d898e7c6203d58dcec113a8a6fb9ee0d))
- add release please deployment path ([88ac272](https://github.com/sebastian-software/relanto/commit/88ac27232e7a7dadf745806ba8c0ef781cdbb515))
- collapse dashboard details behind manage actions ([136ff1e](https://github.com/sebastian-software/relanto/commit/136ff1e4dfc73318106dbfff77ac063ab30a08d8))
- confirm destructive token actions in the dashboard ([25cddc1](https://github.com/sebastian-software/relanto/commit/25cddc1c6982c0a1a1c8750cb3f5b162450fba5e))
- enforce send-mail payload limits ([b31f3fe](https://github.com/sebastian-software/relanto/commit/b31f3fe148f5b6f2d6c632786558b5f68cf32ed5))
- improve dashboard form validation and feedback ([fa1d103](https://github.com/sebastian-software/relanto/commit/fa1d103d670183938a2dd20a261a8ba3fd33ad24))
- scaffold monorepo with frontend and backend packages ([16c4264](https://github.com/sebastian-software/relanto/commit/16c4264815c8f5488a332324f78acd82e5628e69))
- show created principals in the dashboard ([7f5a2e4](https://github.com/sebastian-software/relanto/commit/7f5a2e49437d5cc2f92fc587312e44aee5fae937))
- split mailer ownership into applications and admin roles ([db63a4a](https://github.com/sebastian-software/relanto/commit/db63a4afd5b580acae297e2a6db1360b89d39216))

### Bug Fixes

- align dashboard cards and lists to the top ([de1041b](https://github.com/sebastian-software/relanto/commit/de1041b5aafcd1f686f00b4bc5ba3bb5ddc9b9d3))
- apply dashboard row borders through table cells ([8373727](https://github.com/sebastian-software/relanto/commit/8373727a4492a4981c6d2bbb2776cdc899313c0f))
- enable frontend server-side rendering ([38e4622](https://github.com/sebastian-software/relanto/commit/38e462246ac8cae97d834699e9f90210d33d0c7e))
- make required oidc admin group configurable ([bad696c](https://github.com/sebastian-software/relanto/commit/bad696c15dc281023bbe2eee26892c3a101388c4))
- migrate principals away from external references ([73965b6](https://github.com/sebastian-software/relanto/commit/73965b66974887f8a5a51ccc08816e487bf1ef7f))
- require an explicit app session secret ([9656e62](https://github.com/sebastian-software/relanto/commit/9656e627a99596cc8cae9ac9ed6b82ec2e8933c1))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @relanto/backend bumped to 0.1.0
