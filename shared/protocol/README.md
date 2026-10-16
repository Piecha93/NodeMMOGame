# Application protocol v2

This module contains immutable network DTOs, schemas, codecs and input validation.
It imports no world entities, decorators, graphics, persistence or transport code.
`encodeSnapshot` never consumes dirty state. `decodeSnapshot` validates every frame
and returns one immutable snapshot before a caller can publish any records.
World lifecycle failure during a later apply step remains the adapter's concern.

Use `encodeSnapshot(snapshot)` to obtain an array of frames and
`decodeSnapshot(frames)` to validate their complete batch. `decodeFrame` is useful
for inspection; applying its result individually would bypass batch atomicity.
Frames may arrive in any order, but missing, duplicated or mixed batches fail.
Only batch zero may carry `localPlayerState`, which is a complete `DefaultPlayer`.
An empty snapshot is valid and can acknowledge idle input.

## Frame header

All multibyte numbers use network byte order. The header is 32 bytes.

| Offset | Bytes | Meaning |
| ---: | ---: | --- |
| 0 | 4 | Magic `NMM2` (`0x4e4d4d32`) |
| 4 | 1 | Protocol version, `2` |
| 5 | 1 | Flags: bit 0 means ACK present; bit 1 means local player present |
| 6 | 2 | Header length, `32` |
| 8 | 4 | Total frame byte length, including header |
| 12 | 4 | Server simulation tick, uint32 |
| 16 | 4 | Snapshot sequence, uint32 |
| 20 | 4 | Last processed input sequence, uint32; zero when ACK flag is absent |
| 24 | 2 | Zero-based batch index |
| 26 | 2 | Number of frames in this snapshot |
| 28 | 2 | Number of normal entity records in this frame |
| 30 | 2 | Schema revision, `1` |

A local player, when flagged, is encoded as a complete create record immediately
after the header and is excluded from the normal record count. Normal records
follow it. The same entity may occur once among the normal records in addition to
its local-player state. Normal entity IDs must be unique across the entire batch.

## Records and fields

A record starts with its total uint32 byte length, a uint8 kind (`1` create,
`2` update, `3` destroy), a uint8 prefab ID and a uint32 entity sequence. Prefab
IDs are explicitly fixed to `A` through `H` for the eight original prefabs.
`I` appends the expedition's static marker without renumbering existing types.
The expedition requires an updated v2 client; sandbox modes keep legacy admission.
An entity ID combines its registered prefix and the canonical unsigned decimal sequence.

Destroy records end after these ten bytes. Create and update records append a
uint16 field count, followed by fields. Each field has a uint16 field ID, uint8
type ID and uint32 payload length, then exactly that many bytes. Unknown fields,
duplicate fields, incorrect types, inconsistent lengths and trailing bytes fail.
Create records require every field of their prefab schema; updates require at
least one field. Domain class and decorator order have no effect on v2 IDs.

| Field IDs | Meaning | Wire type |
| --- | --- | --- |
| 1–5 | x, y, scaleX, scaleY, rotation | float64 |
| 6 | velocity | float64 |
| 7 | invisible | boolean |
| 8 | spriteName (base resource name) | UTF-8 |
| 16 | actor name | UTF-8 |
| 17–18 | maxHp, hp | uint16 |
| 19 | animationType | UTF-8 |
| 20–21 | horizontal, vertical | float64, range −1 to 1 |
| 32 | isOpen (Doors) | boolean |
| 33 | power (FireBall) | uint16 |
| 34 | owner (FireBall) | UTF-8 |
| 35 | isAttached (Portal) | boolean |

Type IDs are `1` float64, `2` uint16, `3` boolean and `4` UTF-8. Boolean payloads
are exactly one byte, `0` or `1`, and decode to actual booleans. All numbers must
be finite. UTF-8 decoding is fatal on malformed input and preserves a leading
BOM. Unpaired input UTF-16 surrogates are rejected instead of silently replaced.
String limits are byte limits: sprite name 128, actor name 256, animation 64 and
owner 64. Coordinate and scale bounds are fixed in `Schema.ts`.

`V2_LIMITS` is shared by the encoder and decoder: 64 KiB per frame, 256 records
per frame, 256 frames, 65,536 normal records and 8 MiB total per snapshot. Records
are never split internally. A single record that cannot fit is rejected. Larger
snapshots require an application-level interest or pagination policy.

## Input and serial numbers

`validateInputCommand(unknown)` returns an immutable copied command with a uint32
`seq`, horizontal and vertical directions in `-1 | 0 | 1`, and up to eight
gameplay actions. Actions are primary/secondary/middle pointer positions,
interaction with an entity ID, and weapon switching. Extra properties, including
a client-supplied `dt`, fail validation. The server chooses simulation duration
and authorizes each action at its own boundary.

`nextSequence` and `isNewerSequence` implement wrapping uint32 serial arithmetic.
A sequence exactly half the uint32 space away is ambiguous and is not newer;
the application must keep its live acknowledgement window below 2^31.

## Compatibility

V2 is separately negotiated. It does not change v1 bytes or v1 declaration-order
metadata. The old codec remains a separate compatibility path until the legacy
adapter is removed. Changing the field table, prefab table or field meaning
requires a schema/protocol revision and an explicit compatibility decision.
