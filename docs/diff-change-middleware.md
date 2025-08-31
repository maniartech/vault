# Diff: Change Middleware

Provide richer, previous/next-aware change events without increasing core complexity or payload sizes. This middleware observes Vault operations and re-emits focused events with diffs.

Goals

- Keep core events tiny: a single "change" event with { op, key?, meta?, version }
- Opt-in richer events: emit previous/next snapshots for value and meta
- No core API changes: implemented entirely as middleware using existing hooks

Event surface (emitted by this middleware)

- "change:value" — detail: { key: string, op: "set" | "remove", previousValue: any | null, nextValue: any | null }
- "change:meta" — detail: { key: string, op: "set" | "remove" | "clear", previousMeta: any | null, nextMeta: any | null }

Design notes

- Uses core pipeline fields previousValue/previousMeta (already populated by Vault before hooks)
- Re-emits only after successful operations in after(), so listeners see confirmed results
- Does not perform deep equality; it always emits when an operation is executed (apps can filter if needed)
- Payloads still avoid large clones in core; only apps that opt-in pay the cost

Type references

- Middleware and MiddlewareContext are defined in `src/types/middleware.ts`

Example implementation

```ts
import type { Middleware, MiddlewareContext } from "../src/types/middleware";

export function diffChangeMiddleware(): Middleware {
	return {
		name: "diff-change",

		// No need for before unless you want to compute custom prev state; core already provides it
		async after(ctx: MiddlewareContext, result: any) {
			const vault = (ctx.vaultInstance ?? this) as any;
			const key = ctx.key as string | undefined;
			const op = ctx.operation;

			// Value-focused changes
			if ((op === "set" || op === "remove") && key) {
				const previousValue = ctx.previousValue ?? null;
				const nextValue = op === "set" ? ctx.value ?? null : null;
				try {
					vault.dispatchEvent?.(new CustomEvent("change:value", {
						detail: { key, op, previousValue, nextValue }
					}));
				} catch {}
			}

			// Meta-focused changes (includes clear with no key)
			if (op === "set" || op === "remove") {
				if (key) {
					const previousMeta = ctx.previousMeta ?? null;
					const nextMeta = ctx.meta ?? null;
					try {
						vault.dispatchEvent?.(new CustomEvent("change:meta", {
							detail: { key, op, previousMeta, nextMeta }
						}));
					} catch {}
				}
			} else if (op === "clear") {
				// For clear, emit a meta event without a key (listeners can treat this as a wildcard)
				try {
					vault.dispatchEvent?.(new CustomEvent("change:meta", {
						detail: { key: undefined, op, previousMeta: null, nextMeta: null }
					}));
				} catch {}
			}
			return result;
		}
	};
}
```

Usage

```ts
const vault = new Vault("app").use(diffChangeMiddleware());

vault.addEventListener("change:value", (e) => {
	const d = (e as CustomEvent).detail;
	// d = { key, op, previousValue, nextValue }
});

vault.addEventListener("change:meta", (e) => {
	const d = (e as CustomEvent).detail;
	// d = { key?, op, previousMeta, nextMeta }
});
```

Caveats and guidance

- Equality rules are app-specific; this middleware does not perform deep comparisons
- For very large values, consider filtering events by key or operation
- If you need persistence or cross-tab delivery of diff events, compose with the Sync middleware

Tests (ideas)

- Emits change:value on set/remove with correct previous/next
- Emits change:meta on set/remove and once on clear
- Does not throw if vault has no dispatchEvent (defensive checks)