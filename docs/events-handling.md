# Events Handling

This document outlines how to add events functionality to your existing `Vault` class. The events system lets consumers listen to changes via standard EventTarget APIs, with optional cross-context fan-out available via middleware.

---

## 1) Event Types

The events system uses these internal types:

```ts
type ChangeOp = "set" | "remove" | "clear";
type ChangeEvent = { op: ChangeOp; key?: string; meta?: any; version?: number };
```

* `version` is a simple **LWW** (Last Write Wins) guard (`Date.now()` at write time).
* No public exposure; purely internal.

---

## 2) Private Event Bus Field

Add this private field to the `Vault` class:

```ts
// — internal event bus (same-process)
private __bus = new EventTarget();

// (No cross-context transport in core; see sync middleware doc)
```

Note: No BroadcastChannel setup in core; cross-context sync is provided by middleware.

---

## 3) Public Event APIs (Standard EventTarget)

Expose standard EventTarget-style methods on the instance (forwarded to the internal bus). This is additive and doesn't change any existing method signatures.

```ts
public addEventListener(
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
): void {
  this.__bus.addEventListener(type, listener as any, options as any);
}

public removeEventListener(
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | EventListenerOptions
): void {
  this.__bus.removeEventListener(type, listener as any, options as any);
}

public dispatchEvent(event: Event): boolean {
  return this.__bus.dispatchEvent(event);
}

// Optional DOM-like property handler for convenience
public onchange?: (e: CustomEvent<ChangeEvent>) => void;
```

### Usage Example

```ts
// Key-scoped listener filters by e.detail.key
vault.addEventListener("change", (e: Event) => {
  const ev = (e as CustomEvent<ChangeEvent>).detail;
  if (ev.key === "profile") {
    // handle profile updates
  }
});
```

This uses **EventTarget**—small and native. ([MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget))

---

## 4) Emit Helper (Internal)

Add this private method to handle event emission:

```ts
private __emit(ev: ChangeEvent) {
  const evt = new CustomEvent<ChangeEvent>("change", { detail: ev });
  this.__bus.dispatchEvent(evt);
  // Optional DOM-like handler
  if (typeof this.onchange === "function") {
    try { this.onchange(evt as any); } catch {}
  }
}
```

Note: Cross-context fan-out can be implemented by an optional sync middleware.

---

## 5) Integration with Vault Methods

To wire up events, you'll need to add `__emit` calls to your existing vault methods:

### In `setItem`:
```ts
// After successful storage operation
this.__emit({ op: "set", key, meta: context.meta, version });
```

### In `removeItem`:
```ts
// After successful removal
this.__emit({ op: "remove", key, meta: context.meta, version: Date.now() });
```

### In `clear`:
```ts
// After clearing storage
this.__emit({ op: "clear", version: Date.now() });
```

---

## 6) Cross-Context Synchronization

* **Cross-context sync (optional)**: available via middleware; see `docs/browser-sync-middleware.md`.
* **Conflict resolution**: LWW with a top-level `version` field.

The core events system handles same-process events only. For cross-tab/cross-context synchronization, implement optional middleware that:

1. Listens to local vault events
2. Broadcasts changes via BroadcastChannel or other transport
3. Applies remote changes to local vault instances

---

## 7) Behavior & Guarantees

* **No breaking changes**: original behavior remains intact.
* **Standard EventTarget API**: familiar interface for web developers.
* **Local events only**: cross-context sync handled by optional middleware.
* **Type-safe**: full TypeScript support with proper event typing.

---

## 8) Event Testing Checklist

* Local event emission works for all operations (set, remove, clear).
* Event listeners receive proper event data structure.
* Multiple listeners can be attached to the same vault instance.
* Event removal works correctly.
* Cross-tab behavior is covered in middleware tests (see sync middleware doc).

---

This keeps your **Vault class simple and maintainable**, while adding the events capability you want using well-supported native browser APIs.