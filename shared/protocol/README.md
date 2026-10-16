# Application protocols v2 and v3

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

V3 uses the same immutable DTOs and batch semantics through `encodeSnapshotV3`,
`decodeSnapshotV3` and diagnostic `decodeFrameV3`. Negotiation chooses the highest
common version from `[3, 2, 1]`; the v2 and legacy codecs retain their own bytes.

## Compact v3 records

The v3 header retains the 32-byte layout below, changing the magic to `NMM3`,
protocol version to `3`, and using its own schema revision `1`. No record length,
field count, field type or per-field payload length is repeated when the schema
already determines it. A normal record contains:

1. One byte: the high two bits identify create (`0`), update (`1`) or destroy
   (`2`); low six bits identify the explicitly registered prefab wire ID minus
   `0x41` (`A`). Kind `3` and unregistered prefab IDs are invalid.
2. A canonical unsigned base-128 varint with the uint32 entity sequence.
3. For create/update, a canonical unsigned varint field-presence mask. Bit
   `field.id - 1` refers to that stable field ID. Bits for unregistered fields
   fail. Create requires the entire prefab mask; update requires a nonzero mask.
4. Selected values in ascending field-ID order. Remote float fields use
   network-order IEEE float32, uint16 values use bounded canonical varints,
   booleans use one byte (`0` or `1`), and strings use a bounded varint byte
   length followed by strict UTF-8. Destroy ends after its entity sequence.

Array/decorator/property order still cannot change field identity. A changed
field table or wire meaning requires a new schema/protocol revision. Compact
records intentionally reject unknown fields rather than guessing their size.
V3 keeps the same frame, batch, total byte and record-count limits as v2.
Overlong or overflowing varints, trailing bytes, mixed batches and malformed
UTF-8 fail with `ProtocolError` before the snapshot can be applied.

The special `localPlayerState` record always uses float64 for **every** numeric
float field. Reconciliation therefore receives exact authoritative positions,
movement directions and velocity. Other records use float32 for presentation;
the rounding error in the allowed ±1,000,000-pixel coordinate range is at most
1/32 pixel, and is substantially smaller near the playable area. Finite values
which overflow float32, such as an extraordinarily large rotation, are rejected
by the v3 encoder. Its validation also checks the rounded value against schema
bounds, so it never knowingly creates a frame its decoder would reject.

A deterministic regression fixture with 2000 enemy updates containing x/y
uses **84,256 bytes in v2 and 24,129 bytes in v3**, including all eight frame
headers: 71.36% fewer application-protocol bytes. This measures identical
records, before transport overhead or interest-area filtering; it is not a
claim about every live workload or all bandwidth used by Socket.IO.

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
The expedition requires a v2 or newer client; sandbox modes keep legacy admission.
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

V3 is also separately negotiated, preserves v2 DTO meanings with the documented
remote float precision, and leaves both older codecs intact. Its field mask is
stateless relative to previous snapshots: it needs no new baseline negotiation
or transport ACK. Incremental record creation and per-client baselines remain
the replication adapter's responsibility, and require ordered reliable delivery.
