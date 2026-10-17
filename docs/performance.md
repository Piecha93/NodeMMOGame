# Poligon — test obciążenia

Wybierz **Poligon / test wydajności** na stronie wejścia lub w nagłówku gry. Zalogowany gracz może otworzyć `/game?mode=performance`. Sterowanie pozostaje takie samo: WASD i przytrzymany LPM. Nie ma celów, limitu czasu ani obrażeń gracza.

## Ustawienia

- **Przeciwnicy: 0–20 000** — wpisz dowolną liczbę całkowitą. Populacja powstaje partiami po maksymalnie 80 obiektów na tick, z celem 1 ms CPU na tworzenie, rejestrację i wstawienie do indeksu kolizji. Budżet maleje, gdy poprzedni tick zostawił mało zapasu. Pojedynczej konstrukcji ani GC nie można przerwać; każda partia tworzy przynajmniej jednego NPC. Licznik pokazuje postęp, a limit i walidacja są wspólne dla klienta oraz serwera.
- **Wokół mnie** — siatka wokół bieżącej pozycji gracza; duże populacje wykraczają poza ekran i obszar zainteresowania klienta.
- **Cała mapa** — populacja rozłożona między chunkami. Odległe chunki pozostają aktywne, więc cały świat nadal wykonuje symulację, a klient otrzymuje własną okolicę.
- **Bezruch / Ruch / Walka i pociski** — porównanie kosztu nieruchomych obiektów, ruchu i kolizji oraz AI ze strzelaniem do graczy w zasięgu.
- **Załaduj** zastępuje poprzednią populację i usuwa jej pociski. **Wyczyść** ustawia liczbę przeciwników na zero.

Ustawienia są wspólne dla wszystkich graczy na poligonie. Zmiana jest ograniczona do jednej na sekundę. Wyprawa działa w oddzielnym świecie i przestrzeni Socket.IO; zmiany poligonu nie modyfikują jej obiektów ani celów. Poligon ma własny worker thread: jego symulacja, kolizje, baselines replikacji i kodowanie snapshotów nie wykonują się na głównej pętli zdarzeń HTTP i wyprawy. Oba wątki nadal korzystają z zasobów tego samego komputera.

Poligon nadrabia najwyżej osiem rzeczywistych ticków świata w jednej turze, tak jak zwykły świat. Własny worker pozwala wykonać ten ograniczony zapas po krótkim skoku ładowania lub snapshotu. Kolejka inputu rezerwuje komendy dla nadchodzących ticków; tylko nadmiar odtwarza dodatkowy ruch i kolizje. Każda potwierdzona komenda nadal wykonuje stały krok ruchu. Budżet czasu serwera ogranicza to do 8 komend na tick i 8 ticków zapasu; numer sekwencji ani zalewanie komendami nie przyznają dodatkowego czasu ruchu. Zwykła gra zachowuje obsługę jednej komendy na tick. Przy skrajnym przeciążeniu nadal możliwy jest zaległy input; panel pokazuje faktyczne Hz, porzucony czas i wielkość korekt. Licznik porzuconego czasu pozostaje sumą od uruchomienia świata i nie zeruje się przy zmianie populacji.

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

Panel pokazuje też wynegocjowaną wersję protokołu. Nowy klient wybiera v3: zwarty identyfikator rekordu, maska stabilnych ID pól, liczby całkowite o zmiennej długości i float32 dla zdalnych obiektów. Stan własnego gracza pozostaje float64. Replikacja obejmuje prostokąt 1536×1024 wokół gracza, konserwatywne granice obiektów oraz 96 px histerezy przy wychodzeniu; zapas pokrywa kamerę 1024×576, jej wyprzedzenie i wczytywanie okolicy. Zmniejsza to transfer i liczbę obiektów klienta, a cały świat nadal wykonuje tę samą symulację. Starsi klienci zachowują format i obszar replikacji v1/v2.

Porównuj ten sam scenariusz, pozycję kamery, rozmiar okna i przeglądarkę. Poczekaj na zakończenie tworzenia populacji, żeby odróżnić koszt startu od stałego kosztu symulacji. Statyczna populacja generuje mniej delt niż ruchoma. Liczba 20 000 to limit narzędzia, a nie deklaracja wydajności czy liczby obsługiwanych graczy. Duże populacje na całej mapie mają poprawne, unikalne pozycje wewnątrz granic świata; wczytywanie nadal przeplata odległe chunki.

500 KiB/s oznacza 512 000 bajtów/s, czyli 4,096 Mb/s binarnego stanu świata na jednego klienta. To oddzielna miara od czasu CPU. Szybszy serwer może nawet pokazać większy transfer, ponieważ wysyła więcej aktualizacji w ciągu sekundy. Przy porównaniu gier trzeba podać liczbę aktywnych i replikowanych obiektów, faktyczne Hz, zachowanie AI/kolizji, sprzęt oraz narzut transportu.

W lokalnym profilu z 16 października 2026, dla 2000 pobliskich poruszających się przeciwników i jednego odbiorcy v2, zbędne kodowanie v1 zajmowało p50 39,14 ms na publikację. Zastąpienie go samym porządkowaniem stanu kosztowało p50 0,73 ms; przygotowanie v2 zmieniło się z 4,05 na 3,30 ms po usunięciu pośrednich tablic w diffie. Próba wykonywała 220 publikacji po 3 ticki świata, z pierwszymi 20 publikacjami pominiętymi w statystykach. Rozmiar danych pozostał identyczny. To kontrolowany pomiar CPU w tym środowisku, bez kosztu przeglądarki i bez deklaracji obsługiwanej liczby graczy.

## Powtarzalny benchmark protokołu i CPU

```sh
npm run bench -- --count=2000 --samples=120 --scenario=moving
```

Warianty: `--count=0..20000`, `--samples=30..500`, `--scenario=static|moving|combat`. Skrypt buduje serwer i wykonuje deterministyczną próbę z poruszającym się graczem, 20 publikacjami rozgrzewki oraz 3 tickami na publikację. Używa kooperacji tak samo jak prawdziwy poligon, żeby sojusznicze pociski nie zmniejszały testowanej populacji. Zestawia v2, v3 dla identycznych rekordów i v3 z obszarem kamery. Raportuje bajty pierwszego stanu i kolejnych delt oraz percentyle CPU symulacji, przygotowania, kodowania i dekodowania z zastosowaniem stanu do prawdziwej repliki klienta.

Próba lokalna z 16 października 2026 (Node 24.19, Windows x64, 2000 pobliskich przeciwników, `moving`, 120 próbek) dała:

| Wariant | Pierwszy snapshot | Średnia kolejnych snapshotów |
| --- | ---: | ---: |
| V2, pierwotny obszar chunków | 381 485 B | 73 249 B |
| V3, identyczne rekordy | 111 122 B | 24 737 B |
| V3, obszar kamery | 58 832 B | 15 258 B |

Samo kodowanie zmniejszyło delty o 66,2%, a wraz z filtrowaniem okolicy o 79,2%. Wynik zależy od ruchu, liczby zmienianych pól i położenia gracza. Przy identycznych 25 publikacjach/s te średnie odpowiadają około 1788 / 604 / 372 KiB/s; to przeliczenie bajtów, a nie zmierzona przepustowość sieci. Skrypt wykonuje wszystkie warianty po kolei, więc jego łącznego czasu nie należy interpretować jako tempa działającego serwera. Nie obejmuje renderowania, RTT ani nagłówków transportu.

Osobna próba CPU na identycznej symulacji walki (2000 przeciwników, ruch gracza, 160 ticków rozgrzewki + 400 mierzonych) wykazała spadek ticka p50 z 44,15 do 29,68 ms, p95 z 142,09 do 70,20 ms. Prostokąty bez obrotu unikają wielokrotnego rzutowania wierzchołków; różnicowe testy porównują wynik, normalną i penetrację z biblioteką, a koła, obroty i zmienione wielokąty zachowują pełny SAT. Liczba obiektów i końcowa pozycja gracza w porównaniu pozostały identyczne.

Po stronie repliki częściowa aktualizacja zmienia tylko przesłane pola, a indeks chunków i geometrię odświeżają tylko obiekty ze zmienionym transformem. Próbka 2000 obiektów na Node 24 zmniejszyła medianę nakładania pozycji z 9,11 do 3,57 ms, pól skalarnych z 6,28 do 0,42 ms, a zbierania i interpolacji pozycji z 2,86 do 0,66 ms. To izolowane koszty CPU, bez renderowania GPU; rzeczywisty FPS trzeba odczytać w przeglądarce.

## Rzeczywiste tempo serwera

```sh
npm run bench:server -- --count=2000 --seconds=20 --warmup=5
```

Ten benchmark uruchamia prawdziwą aplikację na losowym lokalnym porcie oraz klienta Socket.IO w osobnym procesie. Poligon działa w workerze serwera, a raport podaje jego identyfikator wątku. Gość loguje się przez HTTP, negocjuje v3 i WebSocket, ładuje żądaną populację, następnie chodzi po kwadracie, zmieniając kierunek co 800 ms. Wysyła input z docelowym tempem 64 Hz, ale nie strzela, żeby liczba testowanych przeciwników pozostawała stała. Przeciwnicy wykonują zwykłą walkę i strzelają; reguły kooperacji i kolizji pozostają włączone. Drugi klient jest obecny w zwykłym świecie i mierzy jego heartbeaty; co 500 ms wykonywany jest też odczyt HTTP. Sekcja `isolation` pokazuje tempo zwykłego świata i opóźnienia tych prób podczas obciążenia workera.

Domyślna faza `--phase=steady` zaczyna pomiar po zakończeniu ładowania oraz rozgrzewce. Raport zawiera faktyczny przyrost ticków względem czasu monotonicznego, wszystkie zmierzone czasy ticków, snapshoty i bajty odebrane przez klienta, RTT heartbeatów, przyrost porzuconego czasu i minimum/maksimum żywych NPC. Inna niż zadana liczba NPC przerywa próbę. Skrypt zamyka własne procesy, sockety i timery także po błędzie. Zakresy parametrów: `--count=0..20000`, `--seconds=1..120`, `--warmup=0..30`, `--scenario=static|moving|combat`, `--movement=idle|square`, `--direction-ms=100..10000` (domyślnie 800). Dłuższy bok trasy angażuje więcej NPC i może znacznie zwiększyć koszt walki.

Żeby zmierzyć także spawn i pierwsze sekundy pracy pełnej populacji:

```sh
npm run bench:server -- --phase=spawn --count=5000 --movement=square --settle=5
```

Faza `spawn` rozpoczyna pomiar i wysyłanie inputu przed konfiguracją populacji. Po odebraniu pełnej liczby NPC i `pending=0` pobiera checkpoint z workera, a następnie kontynuuje wejście, snapshoty i sondy przez `--settle=0..30` sekund (domyślnie 3). Raport rozdziela przyrost porzuconego czasu podczas ładowania i po nim oraz podaje pełną sumę i wartości licznika na początku i końcu. `loadingElapsedSeconds` obejmuje oczekiwanie na telemetrię publikowaną co 250 ms; checkpoint obejmuje też opóźnienie odczytu z workera. Nie jest to dokładny czas samej fabryki. Ta faza nie przyjmuje `--seconds` ani `--warmup`; `steady` nie przyjmuje `--settle`.

Przed wydzieleniem workera, na Node 24.19 / Windows x64 próba 2000 NPC, 5 s rozgrzewki + 20 s ciągłego ruchu pokazała:

| Pomiar | Przed | Po |
| --- | ---: | ---: |
| Rzeczywiste ticki/s | 21,49 | 62,77 |
| CPU ticka p50 | 38,70 ms | 9,26 ms |
| CPU ticka p95 | 67,40 ms | 15,77 ms |
| Odebrane snapshoty/s | 10,74 | 24,99 |
| RTT heartbeatów p95 | 92,49 ms | 16,85 ms |
| Żywi przeciwnicy min / max | 2000 / 2000 | 2000 / 2000 |

Osobna próba ustabilizowanej pracy (10 s rozgrzewki + 30 s pomiaru, te same 2000 NPC i ciągły ruch) osiągnęła 1921 ticków w 30,012 s: **64,01 Hz**, snapshoty **24,99 Hz**, tick p50 / p95 **7,40 / 10,90 ms**. Liczba NPC przez cały pomiar wynosiła 2000, a przyrost porzuconego czasu 2,38 ms. Krótszy pomiar porównawczy powyżej celowo pozostaje oddzielny; wyniki zależą też od rozgrzewki i chwilowego obciążenia systemu.

Oszczędności pochodzą z pomijania pustych kierunkowych kontaktów niesolidnych aktorów, konserwatywnej szybkiej ścieżki bez kandydatów na solidną geometrię oraz filtrowania stabilnych sojuszniczych interakcji pocisków. Własne callbacki, drzwi, nieznane drużyny i dynamiczna geometria zachowują ścieżkę ogólną. Pętle czasowe odejmują też czas pracy od następnego oczekiwania, zamiast dodawać go do okresu. Osobny deterministyczny test 560 ticków zachował identyczny stan świata i 4915 utworzonych pocisków.

W zwykłym świecie AI korzysta z żywego indeksu graczy; nie przegląda wszystkich obiektów dla każdego NPC. Poligon miał już własny zbiór graczy, więc ten zysk dotyczy przede wszystkim normalnej rozgrywki. Pomiar serwera nie zawiera renderowania, prediction klienta ani GPU i nie jest testem wielu graczy. Wynik 20 000 NPC sprawdza limit i poprawność generowania; nie oznacza 64 Hz przy takiej populacji.

Po przeniesieniu poligonu do workera wykonano pomiar na tym samym Node 24.19 / Windows x64. Drugi klient był obecny w pustym zwykłym świecie (`DEMO_SCENARIO=none`); był nieruchomy, a sondy HTTP czytały uwierzytelnioną stronę gry:

| Pomiar | 2000 NPC, rozgrzewka 10 s + pomiar 30 s | 10 000 NPC, rozgrzewka 5 s + pomiar 10 s |
| --- | ---: | ---: |
| Poligon, rzeczywiste ticki/s | 63,98 | 6,23 |
| CPU ticka p50 / p95 | 7,35 / 8,75 ms | 154,70 / 163,31 ms |
| Odebrane snapshoty/s | 24,99 | 3,11 |
| Zwykły świat, rzeczywiste ticki/s | 63,98 | 64,02 |
| Zwykły świat, porzucony czas | 0 ms | 0 ms |
| Zwykły świat, heartbeat RTT p95 | 0,61 ms | 0,59 ms |
| HTTP RTT p95 | 5,72 ms | 6,05 ms |
| Żywi przeciwnicy min / max | 2000 / 2000 | 10 000 / 10 000 |

To dowód izolacji pętli zdarzeń, nie przyspieszenia jednej symulacji proporcjonalnie do liczby rdzeni. Przy 10 000 NPC poligon jest przeciążony: ruch i ACK pozostają opóźnione, a dłuższa praca może wypełnić ograniczoną kolejkę inputu i zakończyć połączenie. Nie należy traktować krótkiej próby jako obsługiwanej pojemności. Następnym ograniczeniem pozostaje koszt symulacji tłumu i kontaktów, podczas gdy HTTP oraz zwykły świat zachowują responsywność.

## Profilowanie kolizji i eksperyment z pulą workerów

```sh
npm run profile:collisions -- --count=10000 --ticks=30 --warmup=32 --scenario=combat --movement-steps=8
npm run bench:collision-workers -- --count=10000 --samples=60 --warmup=64
```

Profiler wykonuje trzy oddzielne, identycznie zasiane przebiegi: bez instrumentacji, z licznikami faz i z próbkowaniem CPU przez Node Inspector. Sprawdza zgodność końcowych stanów. `--movement-steps=8` dodaje siedem kroków `simulateMovement` przed tickiem świata, żeby zbadać ścieżkę zaległego inputu. Jest to kontrolowany test CPU, nie pomiar rzeczywistych Hz. `--cpu-profile=test-results/example.cpuprofile` zapisuje profil do nowego pliku, a `--artifacts=directory` pozwala wskazać wcześniej skompilowaną wersję. Czasy faz są zagnieżdżone; nie należy ich sumować. Koszt instrumentacji i niezależne gorące funkcje są w raporcie.

Na wersji sprzed tych optymalizacji, przy 10 000 NPC i ośmiu krokach ruchu, zaobserwowano 16 globalnych aktualizacji indeksu na tick. W przebiegu z licznikami zajęły one łącznie około 153,5 ms/tick, podczas gdy szacowany narrowphase wyniósł około 0,14 ms/tick. Przebieg bez instrumentacji miał tick p50 157,57 ms. Próbkowanie CPU wskazało przede wszystkim odświeżanie indeksu oraz refleksyjne sprawdzanie polityki solidności.

Po rozdzieleniu publikacji geometrii i odświeżania polityki ten sam test zachował 16 publikacji BVH, ale tylko 8 pełnych odświeżeń polityki. Tick bez instrumentacji miał p50 87,00 ms, p95 91,35 ms; końcowy fingerprint świata pozostał identyczny. Usuwanie obiektów przez indeks kontaktów przychodzących zmniejszyło zmierzony koszt cleanupu z około 0,49 do 0,027 ms/tick. Standardowy trigger gracza pomija też puste zapytania, zachowując ścieżkę ogólną dla drzwi i własnych callbacków.

Oddzielne porównanie starej i nowej wersji przez 560 kolejnych ticków, z ruchem i strzelaniem obu stron, zachowało identyczny stan każdego ticka, końcową geometrię colliderów i transkrypt tworzenia/niszczenia. W próbie powstało 4259 pocisków; pozostało 1997 z 2000 NPC. To sprawdzenie zgodności symulacji, bez deklaracji przepustowości.

Końcowy benchmark prawdziwego serwera, z klientem v3 poruszającym się przez WebSocket i walczącymi NPC, dał:

| NPC | Rozgrzewka + pomiar | Rzeczywiste Hz | Tick p50 / p95 |
| --- | --- | ---: | ---: |
| 2000 | 10 s + 20 s | 63,97 | 6,06 / 9,07 ms |
| 5000 | 10 s + 20 s | 59,83 | 12,10 / 20,84 ms |
| 10 000 | 5 s + 10 s | 15,97 | 56,63 / 91,57 ms |

Bezpośrednia próba sprzed zmian przy 10 000 NPC, również 5 s + 10 s, wyniosła 6,62 Hz i tick p50 / p95 144,28 / 157,55 ms. W końcowej próbie zwykły świat utrzymał 63,98 Hz, HTTP p95 6,30 ms. Populacja w każdym benchmarku pozostała stała. Gracz nie strzelał, żeby nie zmniejszać liczby NPC; rendering przeglądarki nie wchodzi do pomiaru. To krótkie lokalne próby: 5000 NPC nie osiąga pełnych 64 Hz, a 10 000 nadal przeciąża symulację.

Ręczna próba w przeglądarce przy 5000 NPC potwierdziła ruch, strzelanie, trafienia i brak błędów konsoli. Po dłuższym przejściu gracza skupienie NPC i dodatkowe pociski dały chwilowy odczyt panelu 26,8 Hz symulacji / 49 FPS; po zatrzymaniu i wygaśnięciu pocisków odczyt wrócił w okolice 60 Hz / 60 FPS. To inna trasa i zmienne obciążenie niż krótki kwadrat benchmarku. Wyniku 59,83 Hz nie należy traktować jako gwarancji płynności każdej walki z taką populacją.

Eksperyment puli przechwytuje rzeczywiste wywołania `Collider.collides` z kolejnych ticków gry, wraz z geometrią w momencie zapytania. Callbacki wykonują się normalnie podczas przechwytywania; późniejszy replay oblicza tylko czysty SAT. Porównuje wykonanie szeregowe ze stałymi pulami 2 i 4 workerów, wlicza pakowanie, wiadomości, transfer buforów i zebranie wyników. Każdy wynik jest porównywany z pierwotnym zapytaniem, także penetracja i normalna udanych kontaktów. Nie zwielokrotnia pracy w pojedynczym batchu. Nie bada równoległej mutacji świata ani kolejności callbacków i nie używa prostokątnej szybkiej ścieżki produkcyjnego `Collider`.

Próba na Node 24.19 / Windows x64 / Ryzen 5 2600, 10 000 NPC, 60 przechwyconych ticków po 64 tickach rozgrzewki, zawierała 1236 rzeczywistych zapytań (średnio 20,6/tick). Wszystkie wyniki były zgodne:

| Wykonanie replay geometrii | Średni czas batcha | p95 |
| --- | ---: | ---: |
| Szeregowo | 0,041 ms | 0,070 ms |
| Pula 2 workerów | 0,140 ms | 0,185 ms |
| Pula 4 workerów | 0,163 ms | 0,282 ms |

Pula pozostaje eksperymentem uruchamianym osobnym poleceniem. Gra zachowuje sekwencyjne callbacki w workerze świata; przy tak małej ilości pracy geometrycznej dodatkowe wiadomości nie dały zysku. Rozruch workerów jest raportowany osobno i nie wchodzi do powyższych czasów.

## Spawn 5000 NPC — 17 października 2026

Po dodaniu budżetu spawnu pomiar obejmuje cały start populacji. Fabryka nie tworzy już tymczasowego `WorldContext` dla każdego obiektu i transformu. Poligon wykonuje do ośmiu zaległych ticków, a input rezerwuje komendy dla tych ticków, unikając podwójnej pracy globalnego indeksu kolizji. Licznik porzuconego czasu i jego reguły pozostają bez zmian.

Profil wskazał też koszt wielokrotnych dynamicznych odczytów metod kolizyjnych. Jawne odczyty zachowują ich kolejność i wykrywanie własnych callbacków, a silnik JavaScript może je specjalizować. Puste kontakty aktorów bez kandydatów solid zachowują swój istniejący pusty zbiór zamiast tworzyć kolejny. Pełna ścieżka dla zmienionych callbacków, geometrii i starych kontaktów pozostaje aktywna.

Kontrolowana próba CPU z 5000 walczącymi NPC, 192 tickami rozgrzewki i 80 mierzonymi tickami ruchu zmniejszyła p50 / p95 z **15,28 / 19,67 ms** do **9,49 / 12,18 ms**. Końcowy fingerprint świata był identyczny. Oddzielne porównanie każdego z 400 ticków przy 5000 NPC zachowało identyczny stan, geometrię i przebieg tworzenia/usuwania obiektów, w tym 2842 utworzone pociski. Koszt odświeżania polityki w osobnym instrumentowanym przebiegu spadł z 4,42 do 1,87 ms/tick. Czasy faz są zagnieżdżone i zawierają narzut pomiaru.

Prawdziwy serwer i klient v3/WebSocket, Node 24.19 / Windows x64 / Ryzen 5 2600, `combat`, pobliska populacja, input 64 Hz:

| Próba | Ładowanie do pełnej telemetrii | Obserwacja po checkpointcie | Rzeczywiste Hz całej próby | Porzucony czas: ładowanie / po nim |
| --- | ---: | ---: | ---: | ---: |
| Ruch po kwadracie, 1 | 1,37 s | 5,01 s | 63,81 | 0 / 0 ms |
| Postój | 1,38 s | 5,01 s | 63,93 | 0 / 0 ms |
| Ruch po kwadracie, 2 | 1,39 s | 5,01 s | 63,83 | 0 / 0 ms |

Każda próba zaczynała się od 0 NPC i licznika 0 ms, kończyła z 5000 NPC i licznikiem 0 ms. W początkowej wersji bez tych zmian sam spawn z ruchem dawał 69,75 ms porzuconego czasu. Oddzielna próba `steady`, 5 s rozgrzewki + 15 s pomiaru ruchu, wykonała **961 ticków w 15,008 s: 64,03 Hz**, tick p50 / p95 **8,91 / 13,70 ms**, bez przyrostu porzuconego czasu. Populacja pozostawała 5000 / 5000; zwykły świat utrzymał 63,96 Hz, HTTP p95 5,22 ms.

Są to lokalne próby jednej trasy i jednego gracza bez renderowania. Gracz nie strzela, aby nie zmniejszać populacji; NPC normalnie strzelają i wykonują kolizje. Historyczne wyniki powyżej dotyczą wcześniejszych wersji.

**Pozostałe ograniczenie:** dwukrotnie dłuższy bok trasy (`--direction-ms=1600 --settle=10`) angażuje większy tłum i ujawnił 51,88 Hz oraz 2004 ms porzuconego czasu po ładowaniu. Samo ładowanie nadal miało 0 ms. W przeglądarce spawn podczas ruchu także zakończył się z 5000 / 5000 NPC i 0 ms; dłuższe przejście z około 775 pociskami dało chwilowo 50,1 Hz / 53 FPS i 397 ms porzuconego czasu. To nie jest jeszcze gwarancja 64 Hz i braku strat podczas każdej walki z 5000 NPC.

Profil całego workera dla trudniejszej trasy wskazuje przede wszystkim aktualizację geometrii, przechodzenie po BVH i odświeżanie polityki solidności; przygotowanie oraz wysyłka snapshotów stanowiły około 6,5% próbkowanego czasu. Drzewo po spawnie miało maksymalną głębokość 113 przy 5097 liściach, ale prywatne eksperymenty z większym paddingiem i balansowaniem zachowującym kolejność liści nie poprawiły wyniku. Nie zostały włączone do gry. Kolejne zmiany należy weryfikować również na tej dłuższej trasie.

## Konfiguracja

Poligon jest domyślnie dostępny w development i test. W produkcji wymaga jawnego `ENABLE_PERF_TESTS=true`; `ENABLE_PERF_TESTS=false` wyłącza go również lokalnie. Wykorzystuje tę samą sesję i kontrolę dostępu co gra; wylogowanie kończy połączenia obu światów.
