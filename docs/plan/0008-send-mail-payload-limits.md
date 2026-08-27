# 0008: Send-Mail-Payload-Limits

**Planungsstatus:** Umgesetzt

## Anforderung

Haertung der Send-Mail-API gegen zu grosse Payloads:

- serverseitige Limits fuer HTML und Text
- serverseitige Limits fuer Anzahl, Einzelgroesse und Gesamtgroesse von Anhaengen
- fachliche Fehlermeldungen fuer API-Clients statt generischer Fehler
- Regressionstests fuer Grenzfaelle

## Architekturentscheidungen

- Die Payload-Limits werden zentral im Backend-Schema umgesetzt, damit sie sowohl fuer API-Routen als auch fuer direkte Service-Nutzung gelten.
- Die decodierte Base64-Groesse wird vor dem Persistieren berechnet, damit Limits fuer Einzelanhaenge und Gesamtpayload fachlich korrekt auf Nutzdaten statt auf Transportdarstellung wirken.
- Die Send-API uebersetzt Validierungsfehler in gezielte 4xx-Antworten:
  - `400` fuer uebrige Payload-Verstoesse wie HTML- oder Textgroesse
  - `413` fuer Anhangs- und Gesamtgroessenverstosse
- Die bestehenden Persistierungs- und Versandpfade bleiben unveraendert; ungueltige Requests werden vor `mail_jobs` abgewiesen.

## Betroffene Dateien

| Datei                                                                                                  | Beschreibung                                                   |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| [packages/backend/src/types.ts](../../packages/backend/src/types.ts)                                   | zentrale Limits fuer Send-Mail-Payloads und Validierungsregeln |
| [packages/frontend/app/routes/api.send.ts](../../packages/frontend/app/routes/api.send.ts)             | fachliche Fehlerabbildung fuer Validierungsfehler der Send-API |
| [packages/backend/src/send-mail-limits.test.mjs](../../packages/backend/src/send-mail-limits.test.mjs) | Backend-Grenzfalltests fuer erlaubte und abgelehnte Payloads   |
| [packages/frontend/app/routes/api.send.test.ts](../../packages/frontend/app/routes/api.send.test.ts)   | API-Tests fuer fachliche Fehlerantworten                       |
| [packages/frontend/README.md](../../packages/frontend/README.md)                                       | dokumentierte Payload-Limits fuer Integrationen                |
| `review-report-2026-03-30-1.md`                                                                        | Finding `R-003` als umgesetzt markiert                         |

## Implementierungsdetails

- Eingefuehrte harte Limits:
  - HTML: maximal `200000` Zeichen
  - Text: maximal `100000` Zeichen
  - Anhaenge: maximal `10`
  - Einzelanhang: maximal `5 MiB` decodiert
  - Gesamte Anhangsgroesse: maximal `20 MiB` decodiert
- `sendMailInputSchema` validiert jetzt:
  - Body-Groessen
  - Anzahl der Anhaenge
  - decodierte Einzelgroesse je Anhang
  - decodierte Gesamtgroesse aller Anhaenge
- `api.send.ts` verlaesst sich fuer Mail-Payloads auf die Backend-Validierung und gibt den ersten fachlichen Fehler als JSON zurueck.
- Die Antwortform fuer Validierungsfehler ist:
  - `{ ok: false, error: "<fachliche Meldung>" }`

## Testergebnisse

- `pnpm --filter @relanto/backend test` erfolgreich
- `pnpm --filter @relanto/frontend test -- app/routes/api.send.test.ts` erfolgreich
- `pnpm agent:check` erfolgreich

## Review-Findings und Behebung

**Review-Ergebnisse**

Zusammenfassung:
| Schweregrad | Anzahl | Behoben | Offen |
|---|---|---|---|
| Kritisch | 0 | 0 | 0 |
| Wichtig | 0 | 0 | 0 |
| Hinweis | 0 | 0 | 0 |

- Interne Review-Pruefung der geaenderten Dateien ergab keine offenen Findings.
