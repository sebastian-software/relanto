# Sicherheitsrichtlinie

## Unterstützte Versionen

Sicherheitskorrekturen werden für die neueste Version auf dem Standard-Branch bereitgestellt. Ältere Versionen werden nicht separat gepflegt - aktualisiere auf die neueste Version, um eine Korrektur zu erhalten.

## Sicherheitslücke vertraulich melden

Melde eine vermutete Sicherheitslücke vertraulich. Erstelle dafür kein öffentliches Issue, keine öffentliche Diskussion und keinen Pull Request.

Zwei private Wege stehen zur Verfügung:

- **GitHub Private Vulnerability Reporting** - öffne den Tab **Security** dieses Repositorys und wähle **Report a vulnerability**.
- **E-Mail** - security@sebastian-software.de.

Eine hilfreiche Meldung enthält, soweit möglich:

- die betroffene Relanto-Version oder den betroffenen Commit,
- eine Beschreibung der Sicherheitslücke und ihrer möglichen Auswirkungen,
- nachvollziehbare Schritte zur Reproduktion oder einen kleinen Proof of Concept,
- relevante, bereinigte Protokollauszüge oder Screenshots und
- bekannte Abhilfen oder Umgehungsmöglichkeiten.

Übermittle keine Zugangsdaten, personenbezogenen Daten oder nicht erforderlichen Produktionsdaten. Vermeide bei der Untersuchung außerdem Tests, die Daten beschädigen oder Dienste beeinträchtigen könnten.

## Reaktionserwartungen

Maintainer bemühen sich darum:

- eine private Meldung innerhalb von 7 Tagen zu bestätigen,
- Schweregrad und betroffene Versionen innerhalb von 14 Tagen einzuschätzen,
- eine Korrektur und einen Veröffentlichungszeitplan mit der meldenden Person abzustimmen und
- die meldende Person zu nennen, wenn das gewünscht und passend ist.

Die Zeiten können bei Meldungen mit geringen Auswirkungen oder bei Korrekturen in vorgelagerten Abhängigkeiten variieren.

## Umfang

Im Umfang: alles in diesem Repository, mit dem jemand etwas lesen, ändern oder ausführen kann, was nicht erlaubt sein sollte - einschließlich der ausgelieferten Artefakte sowie Build- und Release-Automation.

In der Regel außerhalb des Umfangs: Meldungen ohne konkreten Auswirkungspfad, Schwachstellen in Drittanbieter-Abhängigkeiten bei dokumentierter Nutzung und Probleme, die eine bereits kompromittierte Maschine oder einen absichtlich beschädigten lokalen Zustand voraussetzen.

Halte die Details der Sicherheitslücke vertraulich, bis eine Korrektur veröffentlicht wurde oder wir gemeinsam einen anderen Zeitpunkt für die Offenlegung vereinbart haben.
