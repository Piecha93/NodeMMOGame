# Ruiny — walka i rozwój bohatera

Mała wyprawa dla 1–4 graczy łączy eksplorację trzech ruin z walką, zbieraniem przedmiotów i rozwojem postaci. W trakcie drogi pojawiają się kolejne grupy upiorów. Pokonani przeciwnicy zostawiają łup, doświadczenie odblokowuje bronie i punkty ulepszeń, a drużyna próbuje wrócić do obozu z trzema rdzeniami przed końcem dziesięciu minut.

## Pętla rozgrywki

1. Drużyna pojawia się razem w obozie.
2. Kompas i mapa celów prowadzą do Starej strażnicy, Kamiennego kręgu i Zapomnianego gaju.
3. Każde miejsce ma trzech strażników. Po pokonaniu wszystkich odsłania się rdzeń; podejście podnosi go dla całej drużyny.
4. Po odzyskaniu trzech rdzeni wszyscy aktualni członkowie drużyny muszą żywi wrócić do świetlistego kręgu w obozie.
5. Limit wynosi 10 minut. Ekran wyniku pozwala rozpocząć kolejną wyprawę w tej samej sesji.

Zegar zaczyna biec po dołączeniu pierwszego gracza i zatrzymuje się, gdy nikogo nie ma w świecie. Dołączenie wznawia tę samą wyprawę. Postęp celów jest wspólny. Odłączeni gracze nie blokują zakończenia rundy.

## Walka i sterowanie

- **WASD** — ruch, **mysz** — celowanie, **przytrzymany lewy przycisk** — strzały.
- **Prawy przycisk myszy** — fala mocy: 12 krótkich pocisków wokół postaci, po 28 obrażeń, odnowienie 3 sekundy. Działa także podczas odnowienia zwykłego strzału.
- **Q** — przełączanie odblokowanych broni. Można też kliknąć broń w panelu bohatera.
- **Enter** — czat; pisanie i klikanie interfejsu nie steruje postacią.
- Gracz zaczyna z 200 HP, strażnik ruin ma 100 HP, a upiór z fali 70 HP. Przeciwnicy używają własnego odnowienia 1200 ms.
- Przeciwnicy zauważają żywego gracza w promieniu 480, podchodzą do dystansu 200 i wracają po oddaleniu się od swojej strażnicy.
- Współpracujący gracze nie ranią się wzajemnie. Mikstury przy ruinach leczą 50 HP rannemu, żywemu graczowi; mikstury z łupu leczą 45 HP.
- Śmierć wyłącza ruch i strzelanie. Po 3 sekundach postać odradza się w obozie z pełnym zdrowiem i 3 sekundami ochrony. Wspólny postęp pozostaje.

| Broń | Odblokowanie | Obrażenia podstawowe | Odnowienie | Zachowanie |
| --- | ---: | ---: | ---: | --- |
| Żar | poziom 1 | 25 | 180 ms | Szybki, pojedynczy pocisk ognia. |
| Rozprysk | poziom 2 | 3 × 22 | 460 ms | Trzy pociski w wachlarzu; krótki zasięg. |
| Przebicie | poziom 3 | 60 | 650 ms | Szybka włócznia energii, trafiająca do trzech różnych przeciwników. |

Każda broń korzysta z ulepszeń postaci. Obrażenia są zaokrąglane do liczb całkowitych zgodnie ze schematem sieciowym. Przełączenie broni nie zeruje odnowienia. Pociski zachowują wydłużoną geometrię w kierunku lotu i powstają wewnątrz sylwetki gracza; regresja sprawdza cienką osłonę przy postaci dla wszystkich trzech broni przy 64 Hz. To wartości do ogrania i strojenia.

## Doświadczenie i przedmioty

Każdy pokonany przeciwnik zostawia kryształ za 10 PD i monetę. Co piąty dodatkowo zostawia miksturę. Podejdź po łup: przedmioty przyciągają się w promieniu 140 pikseli, a zbierają w promieniu 52. Kryształy i monety dostają wszyscy obecni członkowie drużyny, więc gracze nie rywalizują o ostatnie trafienie ani podniesienie. Ranny, żywy gracz zbiera leczenie dla siebie; pełne zdrowie nie marnuje mikstury.

Pierwszy awans wymaga 20 PD; każdy następny o 15 więcej. Awans przyznaje punkt rozwoju i może odblokować broń. Maksymalny poziom wynosi 20. Panel w prawym górnym rogu pokazuje PD, poziom, łup i zbliżającą się falę; przy dostępnych punktach rozwija wybór ulepszeń:

- **Moc** — +18% obrażeń za rangę.
- **Szybkostrzelność** — −8% podstawowego czasu między strzałami za rangę.
- **Witalność** — +30 maksymalnego HP za rangę, z zachowaniem wcześniejszego ubytku zdrowia.
- **Zwinność** — +5% prędkości ruchu za rangę.

Każde ulepszenie ma maksymalnie 5 rang. Serwer sprawdza poziom, punkty i limity; interfejs czeka na potwierdzenie. Śmierć zachowuje rozwój. Nowa runda i ponowne dołączenie jako nowa postać zaczynają od poziomu 1; nie jest to trwały rozwój konta.

## Fale i czytelność walki

Pierwsza grupa pojawia się po 3 sekundach, następne co 12 sekund. Grupy rosną od 3 do 8 przeciwników, z limitem 32 żywych upiorów fal. Powstają 330–430 pikseli od żywych graczy, wyłącznie w aktywnych chunkach. Zegar zatrzymuje się wraz z rundą. Koniec rundy, reset i wyjście ostatniego gracza usuwają także pociski fal. Przedmioty znikają po minucie; na ziemi pozostaje maksymalnie 128.

Nowe atlasy bohatera i upiorów zastępują sylwetki techniczne w wyprawie. Ruch ma animowany chód, oddech i kierunek; trzymana broń celuje kursorem, reaguje odrzutem i błyskiem wystrzału. Trafienia pokazują liczby obrażeń, a przedmioty unoszą się i pulsują. [Źródła grafiki, prompty i pliki](art-assets.md) opisują nowe zasoby.

## Zakres pierwszej wersji

Jedna mapa, trzy bronie, fala mocy, rozwój bohatera, łup i trzy cele wyprawy tworzą zamkniętą rozgrywkę. Fale zapewniają walkę także podczas drogi między ruinami.

Do swobodnego sprawdzania ruchu, strzelania i obciążenia służy osobny [Poligon](performance.md). Nie ma tam celów, zegara ani śmierci gracza.

## Uruchamianie i architektura

Domyślny `DEMO_SCENARIO=expedition` włącza wyprawę. `walls` zachowuje techniczny sandbox, a `none` pusty świat do testów. Wyprawa wymaga klienta v2 lub nowszego; starszy klient otrzymuje kontrolowany komunikat zamiast nieznanych obiektów.

`ExpeditionController` po stronie serwera prowadzi cele, zegar, populację i wynik. Klient otrzymuje walidowany `ExpeditionState` i wyświetla HUD; nie decyduje o zabiciu, podniesieniu ani zwycięstwie. Zegar i odnowienia używają czasu symulacji.

`AdventureController` osobno prowadzi fale, łup i rozwój. Wysyła ograniczony, walidowany `AdventureState`; żądania wyboru dotyczą wyłącznie gotowej postaci danego połączenia i podlegają limitowi częstotliwości. `AdventureWeapon` utrzymuje odnowienie niezależnie od wybranej broni. XP nie wynika z zniknięcia obiektu przy uśpieniu chunka. Łup używa istniejącego prefabu znacznika bez trwałości chunkowej i powstaje po transakcji zniszczenia przeciwnika. Binarne schematy v1/v2/v3 pozostają bez zmian.

Poligon nie tworzy kontrolera rozwoju, fal ani łupu. Zachowuje poprzednią broń i zasoby `template`; dodatkowe napisy obrażeń i efekty bohatera dotyczą wyprawy.

Obrażenia strażnika, pokonane sloty i zużyte mikstury są zapamiętywane niezależnie od aktywnych obiektów chunków. Uśpienie sektora nie przyznaje zabójstwa, nie usuwa celu i nie uzupełnia zużytego leczenia. Kontroler ponownie tworzy potrzebną populację po powrocie gracza. Prefab `ExpeditionMarker` ma dopisany identyfikator `I`; istniejące identyfikatory pozostają stabilne.

Regresje obejmują walkę, śmierć i odrodzenie, cooldowny, wspólne cele, uśpienie sektorów, powrót całej drużyny, nową rundę i rzeczywisty transport dwóch klientów.
