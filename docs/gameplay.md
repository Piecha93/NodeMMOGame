# Ruiny — pierwsza grywalna wyprawa

Roboczy kierunek projektu to krótka kooperacyjna wyprawa dla 1–4 graczy. Duży świat i chunki służą eksploracji trzech miejsc, do których trzeba dotrzeć. Rozgrywka ma zamknięty cel i da się ją powtórzyć bez tworzenia konta.

## Pętla rozgrywki

1. Drużyna pojawia się razem w bezpiecznym obozie.
2. Kompas i mapa celów prowadzą do Starej strażnicy, Kamiennego kręgu i Zapomnianego gaju.
3. Każde miejsce ma trzech strażników. Po pokonaniu wszystkich odsłania się rdzeń; podejście podnosi go dla całej drużyny.
4. Po odzyskaniu trzech rdzeni wszyscy aktualni członkowie drużyny muszą żywi wrócić do świetlistego kręgu w obozie.
5. Limit wynosi 10 minut. Ekran wyniku pozwala rozpocząć kolejną wyprawę w tej samej sesji.

Zegar zaczyna biec po dołączeniu pierwszego gracza i zatrzymuje się, gdy nikogo nie ma w świecie. Dołączenie wznawia tę samą wyprawę. Postęp celów jest wspólny. Odłączeni gracze nie blokują zakończenia rundy.

## Walka i sterowanie

- **WASD** — ruch, **mysz** — celowanie, **przytrzymany lewy przycisk** — strzały.
- **Enter** — czat; pisanie i klikanie interfejsu nie steruje postacią.
- Gracz ma 200 HP, strażnik 100 HP. Pocisk zadaje 25 obrażeń, broń gracza ma 240 ms czasu odnowienia, a przeciwnika 1200 ms.
- Przeciwnicy zauważają żywego gracza w promieniu 480, podchodzą do dystansu 200 i wracają po oddaleniu się od swojej strażnicy.
- Współpracujący gracze nie ranią się wzajemnie. Mikstury przy ruinach leczą 50 HP rannemu, żywemu graczowi.
- Śmierć wyłącza ruch i strzelanie. Po 3 sekundach postać odradza się w obozie z pełnym zdrowiem i 3 sekundami ochrony. Wspólny postęp pozostaje.

To pierwsze wartości do ogrania i strojenia, a nie gotowy balans.

## Zakres pierwszej wersji

Jedna zaprojektowana mapa, jedna broń, jeden rodzaj przeciwnika, mikstury i trzy cele. Grafika wykorzystuje istniejące assety oraz nowe znaczniki wektorowe. Nie ma jeszcze trwałego ekwipunku, klas, craftingu, rozwoju konta ani proceduralnego świata.

Najbliższa decyzja po ograniu: czy przyjemność daje samo celowanie i ruch, oraz czy odległości między ruinami zachęcają do wspólnej wyprawy. Dopiero na podstawie tej próby warto wybierać kolejne mechaniki.

## Uruchamianie i architektura

Domyślny `DEMO_SCENARIO=expedition` włącza wyprawę. `walls` zachowuje techniczny sandbox, a `none` pusty świat do testów. Wyprawa wymaga aktualnego klienta v2; starszy klient otrzymuje kontrolowany komunikat zamiast nieznanych obiektów.

`ExpeditionController` po stronie serwera prowadzi cele, zegar, populację i wynik. Klient otrzymuje walidowany `ExpeditionState` i wyświetla HUD; nie decyduje o zabiciu, podniesieniu ani zwycięstwie. Zegar i odnowienia używają czasu symulacji.

Obrażenia strażnika, pokonane sloty i zużyte mikstury są zapamiętywane niezależnie od aktywnych obiektów chunków. Uśpienie sektora nie przyznaje zabójstwa, nie usuwa celu i nie uzupełnia zużytego leczenia. Kontroler ponownie tworzy potrzebną populację po powrocie gracza. Prefab `ExpeditionMarker` ma dopisany identyfikator `I`; istniejące identyfikatory pozostają stabilne.

Regresje obejmują walkę, śmierć i odrodzenie, cooldowny, wspólne cele, uśpienie sektorów, powrót całej drużyny, nową rundę i rzeczywisty transport dwóch klientów.
