# Demand proof of sensitive preconditions

> An operation that is only safe after a check takes a parameter that only the
> check can produce, and that proof names the exact values it is about.

From Matt Noonan's
[Ghosts of Departed Proofs](https://kataskeue.com/gdp.pdf). A boolean check
that passes and then calls the operation with the same raw IDs leaves nothing to
stop a later caller from skipping the check, or from checking record A and
acting on record B. A proof parameter makes both mistakes fail to compile.

## When to use one

Use a proof for preconditions whose absence would be an incident: the record
belongs to this tenant, the member approved this action, the account was
verified, consent was recorded, the plan includes the feature. Do not prove
every fact. A precondition with no security, privacy, or money consequence is
ordinary control flow.

## Shape

1. **Name the values.** Wrap the values a proof is about in names that exist only
   for one scope, so a proof about one value cannot be presented for another.
2. **Prove in one trusted module.** One small module per fact runs the real check
   (a database read, a policy decision) and returns the proof or nothing. The
   proof constructor never leaves that module. A client-supplied token or ID
   proves nothing until that module has checked it.
3. **Demand the proof where the harm happens.** The data layer or effectful
   operation takes the named values plus the proof. If it records an actor, it
   takes the actor as a named value too.
4. **Check in the handler, close to the data.** Name the values, obtain the
   proofs, and turn a missing proof into the not-found or forbidden response
   before doing the work.

## Limits

- **Point in time.** A proof says the check passed when it ran. When the fact can
  change underneath it, the statement that acts re-asserts the fact or a
  constraint holds it; see
  [database-craft](../../database-craft/SKILL.md#proofs-and-the-database). Take
  no manual lock to keep the proof true.
- **Request-scoped.** A proof means nothing after serialization. A job, queue
  message, or cache entry carries IDs, and its consumer names and proves again.
- **Forgeable by escape hatches.** A cast, `any`-style escape, or non-null
  assertion can conjure a proof in most languages. The linter bans them on proof
  types, and the proof module is the only place allowed to construct one.
- **Unwrapping.** Code that unwraps a named value and calls a raw-ID function
  bypasses the proof. The functions that do harm accept only named values.

## Without a proof library

Where the language or project has no naming mechanism, the trusted module
returns a capability object that carries the checked IDs, with a constructor
only that module can call. Callers read the ID from the capability instead of
passing it alongside. This cannot stop a capability from being reused in the
wrong scope, but it still prevents acting on an ID that was never checked.

## Prove the proofs

Keep a small compile-fail file of the mistakes the proofs must reject: a raw ID
where a named one is required, a possibly-absent proof, and a proof about
another value. Each line asserts a type error, so loosening a proof type breaks
the build. See the language reference for the spelling.
