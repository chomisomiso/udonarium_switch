---
applyTo: "**"
---

# Architecture

## Network Synchronization

This is an **online collaborative tool** where state must sync across all connected peers.

- All synchronizable entities extend `GameObject` (see `src/app/class/core/synchronize-object/`)
- Classes like `DiceBot`, `GameCharacter`, `ChatMessage` extend `GameObject` to participate in network sync
- Angular Services (e.g., `DiceBotService`) handle business logic but do NOT sync directly
- **Rule**: If state needs to sync across peers, it MUST be a `GameObject` subclass

## Upstream Compatibility

Design decisions should prioritize **ease of tracking upstream changes**:

- Keep abstraction layers (e.g., `MessageProcessor`) thin and aligned with upstream patterns
- Use module-scope variables (as upstream does) over static class members when equivalent
- Extract fork-specific logic into separate Service layers to minimize merge conflicts
- Example: `DiceBot` class remains close to upstream; `DiceBotService` contains fork-specific logic

## Dependency Direction

```
Services → Abstractions (MessageProcessor, GameObject)
     ↓
Abstractions define shared types (e.g., MessageProcessResult)
     ↓
Concrete classes implement abstractions
```

- Services depend on abstractions, NOT the reverse
- Shared types belong in the abstraction layer that defines the contract


