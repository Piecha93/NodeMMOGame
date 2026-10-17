# Żar — najazdy na polanę

Mała gra akcji dla 1–4 graczy: walka o polanę w wiosce, zbieranie łupu i rozwój bohatera pomiędzy najazdami. Cel jest blisko i czytelny: pokonaj sześć fal, w tym końcowego Kolossa. Nie ma szukania ruin, rdzeni ani obowiązkowego marszu przez mapę.

## Pętla rozgrywki

1. Po wejściu masz 15 sekund przygotowania przy ognisku.
2. Nadchodzi fala: kolejno 4, 6, 8, 10, 12 i 15 przeciwników. Następna nigdy nie dokłada się do niedokończonej walki.
3. Pokonaj wszystkich przeciwników i zbierz kryształy PD, monety oraz mikstury.
4. Między falami dostajesz 20 sekund odpoczynku. Żywi gracze odzyskują jednorazowo 30 HP, można wydać punkty i monety.
5. Pokonanie szóstej fali wygrywa rundę. Wspólny limit 8 minut zapobiega nieskończonej rundzie. Zegar i etap zatrzymują się przy pustej drużynie.

Śmierć wyłącza ruch i strzelanie; po 3 sekundach wracasz przy ognisku z pełnym zdrowiem i 3 sekundami ochrony. Rozwój pozostaje do końca rundy. Nowa runda oraz ponowne dołączenie jako nowa postać zaczynają od poziomu 1.

## Walka i przeciwnicy

- WASD — ruch, mysz — celowanie, przytrzymany LPM — strzelanie.
- PPM — fala mocy: 12 krótkich pocisków po 28 obrażeń, odnowienie 3 sekundy.
- Q — zmiana odblokowanej broni; Enter — czat. Interfejs i czat nie uruchamiają strzałów.
- Biegacz ma 45 HP i atakuje z bliska po 12 obrażeń, co najmniej 850 ms między trafieniami.
- Plujek ma 80 HP, utrzymuje dystans i strzela wolniejszym pociskiem za 14 obrażeń co 1800 ms.
- Koloss ma 550 HP, mocniejsze ataki z bliska i powolne pierścienie ośmiu pocisków. Pojawia się w ostatniej fali.
- Przeciwnicy obchodzą scenerię po wspólnej siatce; domy i woda blokują ich ataki na wprost. Poligon zachowuje wcześniejsze zachowanie AI.

| Broń | Odblokowanie | Obrażenia | Odnowienie | Zachowanie |
| --- | ---: | ---: | ---: | --- |
| Żar | poziom 1 | 25 | 180 ms | Szybki pojedynczy pocisk. |
| Rozprysk | poziom 2 | 3 × 22 | 460 ms | Krótki wachlarz. |
| Przebicie | poziom 3 | 60 | 650 ms | Przelatuje przez trzech różnych przeciwników. |

Ulepszenia zwiększają obrażenia, skracają odnowienie, dodają zdrowie lub szybkość ruchu; każda kategoria ma 5 rang. Zmiana broni nie zeruje odnowienia, a zwiększenie maksymalnego zdrowia zachowuje dotychczasowy ubytek HP. Pociski zaczynają wewnątrz sylwetki i nie przeskakują cienkiej osłony przy postaci przy 64 Hz. Gracze nie ranią członków drużyny.

## Łup i wydawanie monet

Pokonany przeciwnik zostawia 10 PD i monetę; co piąty również miksturę za 45 HP. Podejdź po łup: przyciąganie działa w promieniu 140 pikseli, podniesienie w promieniu 52. Zebrane PD i monety dostaje cała aktualna drużyna, leczenie tylko ranny żywy gracz. Łup znika po minucie, maksymalnie 128 przedmiotów pozostaje w świecie.

Pierwszy awans wymaga 20 PD, każdy kolejny o 15 więcej; maksymalny poziom to 20. Awans daje punkt rozwoju. Panel pokazuje broń, punkty i ulepszenia dopiero po potwierdzeniu serwera.

W przygotowaniu i przerwach sklep oferuje wybór:

- Opatrunek: 6 monet, przywraca 60 HP kupującemu. Nie można marnować monet przy pełnym zdrowiu ani leczyć martwej postaci.
- Trening: 10 monet, 20 PD dla kupującego. Można zachować monety na leczenie lub przyspieszyć rozwój.

Zakupy w walce są zablokowane. Wybór należy do gotowej postaci danego połączenia; klient nie podaje ceny, ilości doświadczenia ani identyfikatora innego gracza.

## Teren z kafelków

Wspólny `VillageMap` opisuje trawę, ścieżki, wodę, most i położenie obiektów. Deterministyczne warianty rozbijają powtarzalność, a maska czterech sąsiadów dobiera brzegi wody. Z tych samych elementów można układać kolejne mapy; obecna polana jest ręcznie skomponowana pod walkę, a nie losowana przy wejściu.

Domki, drzewa, skały i płoty dają osłony. Woda jest nieprzechodnia, most zapewnia przejście. Opis przeszkód służy zarówno kolizjom serwera, jak i klientowi przewidującemu ruch. Ziemia jest renderowana w cache chunków; opis mapy nie płynie w każdym snapshotcie. Obiekty scenerii i postacie są porządkowane po głębokości.

[Grafika postaci](art-assets.md) i [grafika wioski](village-art.md) mają zapisane prompty oraz pochodzenie. Efekty trafień, broń, ognisko i przedmioty animują się lokalnie bez zmiany stanu fizyki.

## Architektura i testy

`DEMO_SCENARIO=expedition` włącza tę rozgrywkę. `ExpeditionController` prowadzi rundę i drużynę, `AdventureController` sześć fal, postęp i łup, a `VillageMapController` statyczne kolizje. Wszystkie czasy rozgrywki wynikają z kroków symulacji. Uśpienie chunka nie liczy się jako zabicie przeciwnika; aktywna fala zachowuje stan slotów i zdrowie. Zakończenie oraz reset usuwają pociski, również po śmierci właściciela.

Binarne schematy v1/v2/v3 pozostają bez zmian. Stan rundy i rozwoju ma osobne walidowane komunikaty. Oddzielny [Poligon](performance.md) zachowuje własną mapę, testowe AI i brak obrażeń gracza; nie uruchamia fal, sklepu ani kolizji wioski.

Regresje obejmują granice etapów, brak nakładających się fal, zwycięstwo, reset, uśpienie chunków, zakupy i ich autoryzację przez prawdziwy transport, role przeciwników oraz zgodność terenu z kolizjami.
