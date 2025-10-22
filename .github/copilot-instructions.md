# Project Overview

udonarium_switch is a derivative fork of [udonarium](https://github.com/TK11235/udonarium), a virtual tabletop software for playing tabletop RPGs online. This fork adds SwordWorld 2.5-specific features.

- **Language**: TypeScript
- **Framework**: Angular (frontend only, no backend in this repository)
- **Communication**: WebRTC-based peer-to-peer synchronization

# Key Directories

| Path | Description |
|------|-------------|
| `src/app/class/` | Domain models (GameObject subclasses) |
| `src/app/class/bcdice/` | BCDice integration (DO NOT modify) |
| `src/app/class/core/` | Core infrastructure (DO NOT modify) |
| `src/app/class/database/` | Database-related classes (DO NOT modify) |
| `src/app/class/transform/` | Data transformation utilities (DO NOT modify) |
| `src/app/component/` | Angular components (UI) |
| `src/app/directive/` | Angular directives (UI behavior) |
| `src/app/pipe/` | Angular pipes (data formatting) |
| `src/app/service/` | Angular services (business logic) |

# Code Style

- Comments and documentation: Japanese (簡潔な日本語)
- Variable/function names: English
- Follow [Angular Style Guide](https://angular.io/guide/styleguide)