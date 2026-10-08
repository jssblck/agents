# Dependencies, failures, and lifetimes belong in the signature

> A caller should be unable to forget a dependency, ignore an expected failure,
> or leak a resource, because the signature makes each one visible and the
> compiler enforces it.

This is the second rung of the [proof ladder](proof-ladder.md). Types say which
values exist; the signature of an effectful operation says what it needs, how
it can fail, and what it owns.

## Requirements

An operation declares the services it uses, and the program cannot run until
each one is provided. Read collaborators once when a service is built, and
return methods that need nothing further, so callers do not inherit the
service's dependencies. Construct with collaborators; call with work.

Supplying a different implementation at that declared seam is how tests replace
a dependency. The seam is typed, so the substitute must match the real
interface.

## Failures

Expected failures appear in the signature as a closed set of typed errors the
caller can match on; [errors as values](errors-as-values.md) covers the
expected/defect split. Anything else is a defect: let it terminate the operation
instead of declaring a failure no caller can handle.

## Lifetimes

A resource (connection, listener, stream, subscription, queue consumer, child
process) belongs to a scope. The scope acquires it, and its finalizer runs on
success, failure, or cancellation. Cancellation propagates into the work the
operation started. Do not release resources by hand on each exit path.

## Running

Convert an effect into a plain result only at the edges: process entrypoints,
framework adapters, and a few named bridges. Each conversion is a place where
typed failures and requirements stop being checked, so keep them few and listed.

## By language

- **TypeScript:** Effect. Services and Layers carry requirements, tagged errors
  carry failures, and scopes carry lifetimes; see
  [TypeScript](../languages/typescript.md#effect).
- **Rust:** aerosol capability rows for requirements, `Result` with a small
  snafu enum for failures, and ownership with `Drop` for lifetimes; see
  [Rust](../languages/rust.md#server-stack-effect-taken-apart).
- **Go:** constructor-injected interfaces, returned `error` values, `defer`,
  and `context.Context` for cancellation.
- **Python:** constructor injection, specific exceptions, and context managers.
