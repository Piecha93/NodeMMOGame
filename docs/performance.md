# Poligon — test obciążenia

Wybierz **Poligon / test wydajności** na stronie wejścia lub w nagłówku gry. Zalogowany gracz może otworzyć `/game?mode=performance`. Sterowanie pozostaje takie samo: WASD i przytrzymany LPM. Nie ma celów, limitu czasu ani obrażeń gracza.

## Ustawienia

- **100 / 500 / 1000 / 2000 przeciwników** — populacja tworzona partiami, po maksymalnie 80 obiektów na tick. Licznik pokazuje postęp.
- **Wokół mnie** — siatka wokół bieżącej pozycji gracza; duże populacje wykraczają poza ekran i obszar zainteresowania klienta.
- **Cała mapa** — populacja rozłożona między chunkami. Odległe chunki pozostają aktywne, więc cały świat nadal wykonuje symulację, a klient otrzymuje własną okolicę.
- **Bezruch / Ruch / Walka i pociski** — porównanie kosztu nieruchomych obiektów, ruchu i kolizji oraz AI ze strzelaniem do graczy w zasięgu.
- **Załaduj** zastępuje poprzednią populację i usuwa jej pociski. **Wyczyść** ustawia liczbę przeciwników na zero.

Ustawienia są wspólne dla wszystkich graczy na poligonie. Zmiana jest ograniczona do jednej na sekundę. Wyprawa działa w oddzielnym świecie i przestrzeni Socket.IO; zmiany poligonu nie modyfikują jej obiektów ani celów. Oba światy współdzielą proces Node, więc silne obciążenie poligonu nadal może opóźnić wyprawę.

Przeciążony poligon nadrabia najwyżej dwa ticki świata w jednej turze, aby częściej oddawać czas obsłudze sieci. Ruch gracza odtwarza każdą potwierdzoną komendę ze stałym krokiem, także gdy AI nadąża wolniej. Budżet czasu serwera ogranicza to do 8 komend na tick i 8 ticków zapasu; numer sekwencji ani zalewanie komendami nie przyznają dodatkowego czasu ruchu. Zwykła gra zachowuje obsługę jednej komendy na tick. Przy skrajnym przeciążeniu nadal możliwy jest zaległy input; panel pokazuje faktyczne Hz, porzucony czas i wielkość korekt.

## Co mierzy panel

| Licznik | Znaczenie |
| --- | --- |
| FPS klienta | Liczba rzeczywistych klatek na czas z RAF, uśredniona w oknie co najmniej 250 ms. |
| Korekta pozycji: ostatnia / max 1 s | Odległość w pikselach między przewidzianą pozycją lokalnego gracza przed snapshotem a pozycją po zastosowaniu stanu serwera i ponownym odtworzeniu niepotwierdzonego wejścia. Pokazuje ostatnią korektę oraz maksimum z ostatniej sekundy; tekst odświeża się w oknach co najmniej 250 ms. Pozwala wykryć cofanie gracza przy dobrym FPS. Teleport lub odrodzenie również może dać dużą wartość. |
| Na ekranie / znane klientowi | Obiekty widoczne po cullingu kamery / wszystkie otrzymane i nadal obecne obiekty. To nie liczba przeciwników na serwerze. |
| Przeciwnicy na serwerze | Żywe obiekty populacji testowej / zadana liczba. Zestrzelone jednostki nie odradzają się automatycznie. |
| Wszystkie obiekty / aktywne chunki | Obiekty całego świata, w tym gracze i pociski, oraz aktywne / wszystkie chunki. |
| Tick serwera p50 / p95 | Czas wykonania symulacji mierzony zegarem monotonicznym, z ostatnich maksymalnie 256 ticków. Obejmuje tworzenie populacji i obsługę wejścia; nie obejmuje serializacji ani wysyłki snapshotów. |
| Rzeczywiste tempo symulacji / snapshotów | Przyrost ticków i liczba wykonanych aktualizacji sieciowych podzielone przez rzeczywisty czas zegara monotonicznego. Okno trwa co najmniej sekundę; po uruchomieniu lub zmianie testu wartości wynoszą zero do zamknięcia pierwszego okna. Nie są to zadane częstotliwości timerów. Przerwy event loop obniżają wynik, nawet gdy pojedynczy tick jest tani. |
| Snapshot p95 CPU | Czas całej aktualizacji sieciowej: zebrania stanu, kodowania i przekazania danych do transportu, z ostatnich maksymalnie 128 aktualizacji. Nie obejmuje czekania na dostarczenie pakietu, RTT ani pracy przeglądarki. |
| Budżet ticka | Docelowe 15,625 ms przy 64 Hz. |
| Porzucony czas | Łączny zaległy czas odrzucony przez ograniczenie nadrabiania symulacji w tym świecie. Nie jest czasem pracy CPU ani liczbą utraconych pakietów. |
| Dane świata do tego klienta | Suma rozmiarów binarnych snapshotów na sekundę. Bez czatu, nagłówków MessagePack, Socket.IO, HTTP i TCP. |

Porównuj ten sam scenariusz, pozycję kamery, rozmiar okna i przeglądarkę. Poczekaj na zakończenie tworzenia populacji, żeby odróżnić koszt startu od stałego kosztu symulacji. Statyczna populacja generuje mniej delt niż ruchoma. Liczba 2000 to limit narzędzia, a nie deklaracja wydajności czy liczby obsługiwanych graczy.

500 KiB/s oznacza 512 000 bajtów/s, czyli 4,096 Mb/s binarnego stanu świata na jednego klienta. To oddzielna miara od czasu CPU. Szybszy serwer może nawet pokazać większy transfer, ponieważ wysyła więcej aktualizacji w ciągu sekundy. Przy porównaniu gier trzeba podać liczbę aktywnych i replikowanych obiektów, faktyczne Hz, zachowanie AI/kolizji, sprzęt oraz narzut transportu.

W lokalnym profilu z 16 października 2026, dla 2000 pobliskich poruszających się przeciwników i jednego odbiorcy v2, zbędne kodowanie v1 zajmowało p50 39,14 ms na publikację. Zastąpienie go samym porządkowaniem stanu kosztowało p50 0,73 ms; przygotowanie v2 zmieniło się z 4,05 na 3,30 ms po usunięciu pośrednich tablic w diffie. Próba wykonywała 220 publikacji po 3 ticki świata, z pierwszymi 20 publikacjami pominiętymi w statystykach. Rozmiar danych pozostał identyczny. To kontrolowany pomiar CPU w tym środowisku, bez kosztu przeglądarki i bez deklaracji obsługiwanej liczby graczy.

## Konfiguracja

Poligon jest domyślnie dostępny w development i test. W produkcji wymaga jawnego `ENABLE_PERF_TESTS=true`; `ENABLE_PERF_TESTS=false` wyłącza go również lokalnie. Wykorzystuje tę samą sesję i kontrolę dostępu co gra; wylogowanie kończy połączenia obu światów.
