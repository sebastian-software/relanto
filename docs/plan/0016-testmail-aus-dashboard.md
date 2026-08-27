# 0016 Testmail aus dem Dashboard

**Planungsstatus:** Umgesetzt

## Ziel

Neben `Konfiguration validieren` gibt es im Dashboard einen zweiten Button `Testmail senden`.
Die Testmail nutzt die bestehende SMTP-Konfiguration, wird an die E-Mail-Adresse des aktuell
angemeldeten Pocket-ID-Benutzers gesendet und läuft über denselben direkten Versandpfad wie die
API mit `deliveryMode: "direct"`.

## Umsetzung

- Backend-Helfer `sendSystemAdminTestMail(...)` erzeugt einen echten Job mit
  `delivery_mode = "direct"` und verarbeitet ihn sofort.
- Das Dashboard erhält den neuen Intent `sendTestMail`.
- Ohne `user.email` aus Pocket ID schlägt der Flow mit einer klaren Fehlermeldung fehl.
- Erfolg gilt nur bei finalem Jobstatus `sent`.
- Fehlerzustände werden im Dashboard als fachliche Notice angezeigt.

## Validierung

- Backend-Regressionen für erfolgreichen und fehlgeschlagenen Testversand
- Frontend-Regressionen für Button-Rendering, Success-Response, fehlende Benutzer-E-Mail und
  fehlgeschlagenen Direct-Send
