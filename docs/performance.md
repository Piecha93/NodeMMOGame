# Poligon — test obciążenia

Wybierz **Poligon / test wydajności** na stronie wejścia lub w nagłówku gry. Zalogowany gracz może otworzyć `/game?mode=performance`. Sterowanie pozostaje takie samo: WASD i przytrzymany LPM. Nie ma celów, limitu czasu ani obrażeń gracza.

## Ustawienia

- **100 / 500 / 1000 / 2000 przeciwników** — populacja tworzona partiami, po maksymalnie 80 obiektów na tick. Licznik pokazuje postęp.
- **Wokół mnie** — siatka wokół bieżącej pozycji gracza; duże populacje wykraczają poza ekran i obszar zainteresowania klienta.
- **Cała mapa** — populacja rozłożona między chunkami. Odległe chunki pozostają aktywne, więc cały świat nadal wykonuje symulację, a klient otrzymuje własną okolicę.
- **Bezruch / Ruch / Walka i pociski** — porównanie kosztu nieruchomych obiektów, ruchu i kolizji oraz AI ze strzelaniem do graczy w zasięgu.
- **Załaduj** zastępuje poprzednią populację i usuwa jej pociski. **Wyczyść** ustawia liczbę przeciwników na zero.

Ustawienia są wspólne dla wszystkich graczy na poligonie. Zmiana jest ograniczona do jednej na sekundę. Wyprawa działa w oddzielnym świecie i przestrzeni Socket.IO; zmiany poligonu nie modyfikują jej obiektów ani celów. Oba światy współdzielą proces Node, więc silne obciążenie poligonu nadal może opóźnić wyprawę.

## Co mierzy panel

| Licznik | Znaczenie |
| --- | --- |
| FPS klienta | Liczba rzeczywistych klatek na czas z RAF, uśredniona w oknie co najmniej 250 ms. |
| Na ekranie / znane klientowi | Obiekty widoczne po cullingu kamery / wszystkie otrzymane i nadal obecne obiekty. To nie liczba przeciwników na serwerze. |
| Przeciwnicy na serwerze | Żywe obiekty populacji testowej / zadana liczba. Zestrzelone jednostki nie odradzają się automatycznie. |
| Wszystkie obiekty / aktywne chunki | Obiekty całego świata, w tym gracze i pociski, oraz aktywne / wszystkie chunki. |
| Tick serwera p50 / p95 | Czas wykonania symulacji mierzony zegarem monotonicznym, z ostatnich maksymalnie 256 ticków. Obejmuje tworzenie populacji i obsługę wejścia; nie obejmuje serializacji ani wysyłki snapshotów. |
| Budżet ticka | Docelowe 15,625 ms przy 64 Hz. |
| Porzucony czas | Łączny zaległy czas odrzucony przez ograniczenie nadrabiania symulacji w tym świecie. Nie jest czasem pracy CPU ani liczbą utraconych pakietów. |
| Dane świata do tego klienta | Suma rozmiarów binarnych snapshotów na sekundę. Bez czatu, nagłówków MessagePack, Socket.IO, HTTP i TCP. |

Porównuj ten sam scenariusz, pozycję kamery, rozmiar okna i przeglądarkę. Poczekaj na zakończenie tworzenia populacji, żeby odróżnić koszt startu od stałego kosztu symulacji. Statyczna populacja generuje mniej delt niż ruchoma. Liczba 2000 to limit narzędzia, a nie deklaracja wydajności czy liczby obsługiwanych graczy.

## Konfiguracja

Poligon jest domyślnie dostępny w development i test. W produkcji wymaga jawnego `ENABLE_PERF_TESTS=true`; `ENABLE_PERF_TESTS=false` wyłącza go również lokalnie. Wykorzystuje tę samą sesję i kontrolę dostępu co gra; wylogowanie kończy połączenia obu światów.
