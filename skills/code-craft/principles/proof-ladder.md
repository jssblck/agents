# The proof ladder

> Every invariant has one owner: the strongest rung that can actually prove it.

A rung is stronger when it covers more of a property and catches a violation
earlier. A type proof holds for every value at every call site before the code
runs. A test holds only for the cases it samples, and only when it runs. Push
each invariant as high as it can honestly go, and let lower rungs own only what
the rungs above cannot express.

## The rungs

1. **Types and linters.** The type system proves which values can exist.
   Decoders are the door: parse once at the boundary into branded values and
   tagged unions, and the fact travels everywhere
   ([parse, don't validate](parse-dont-validate.md),
   [illegal states](illegal-states.md)). Linters extend the type system by
   closing its holes: they ban casts, `any`-style escapes, non-null assertions,
   and forged proofs, and they enforce exhaustiveness.
2. **Effects.** The effect system proves what a computation requires, how it can
   fail, and which resources it owns ([effects](effects.md)). It is still
   checked at compile time, but it describes computations rather than data, the
   runtime enforces part of it, and it has more sanctioned exits.
3. **Proofs.** A proof parameter shows that a runtime check passed for these
   exact values ([proof parameters](proof-parameters.md)). The compiler proves
   the check ran; it cannot prove the check was correct or that the fact still
   holds.
4. **Database constraints.** Constraints hold for every writer, including
   concurrent transactions, jobs, and manual SQL the type system never sees. They
   are the strongest owner for facts that span writers, such as uniqueness and
   ownership. See [database-craft](../../database-craft/SKILL.md).
5. **Unit tests.** Direct calls on pure functions, and service logic with typed
   doubles at its dependencies.
6. **Integration tests.** Real boundaries: SQL on Postgres, providers on an
   emulator, native modules, processes.
7. **End-to-end tests.** A small deterministic set that drives the running
   product and gates releases. It owns only what nothing above can show:
   navigation, authentication, and wiring between processes and platforms.

[testing-craft](../../testing-craft/SKILL.md) covers rungs 5 to 7.

## Strongest, not cheapest

Choose by the guarantee, not by effort. A proof parameter beats an authorization
test even when the test is less work to write. Cost breaks ties only among the
test rungs, where the strongest test and the cheapest usually coincide.

"Can actually prove it" is the other half. Do not stretch a rung to claim what
it cannot hold. Types cannot prove SQL semantics, ordering, timing, or
rendering. A state machine drops an event its current state does not handle; it
does not prove the event is impossible.

## Linters close holes

A lint rule sits on the first rung only when it fails the gate. An advisory rule
proves nothing. An unexplained suppression comment opens the same hole as a
cast, so every suppression states why it is safe. A custom rule checks syntax:
it can ban a construct, but it cannot show that a domain fact holds.

## One owner, stated precisely

Some cases look like two owners but are two invariants. A proof plus a unique
constraint is not double coverage: the proof owns "this code path ran the
check", and the constraint owns "no stored row breaks the rule".

Once a stronger rung owns an invariant, weaker rungs stop testing it. An
end-to-end flow passes through a formatter, but it does not own the
formatter's edge cases. When a type, decoder, proof, or constraint takes over a
test's cases, delete the test and name the new owner.

## Name the guarantee

In the change description, name which invalid input, state, or call no longer
compiles or constructs, and where. For each remaining test, name the defect it
catches and why no stronger rung could own it.
