---
applyTo: '**'
---
# Global Coding Standards and Preferences

## General Principles
- Write clear and idiomatic typescrypt code.
- Prioritize readability and simplicity over cleverness.
- Avoid unnecessary repetition and boilerplate.
- Keep functions and files focused and concise.
- Document non-obvious logic, business rules, and intent, but avoid generic or redundant comments.
- Run `ng build` to validate edits

## Comments
- **Preserve custom, domain-specific, or explanatory comments.**
- **Do not add generic comments** for code that is self-explanatory or follows standard patterns (e.g., `// increment i` for `i++`).
- Use comments to clarify intent, edge cases, or complex logic, not to restate what the code does.
- Prefer doc comments for exported functions, types, and packages/modules.
- Mark TODOs, FIXMEs, and HACKs clearly, with context and a date if possible.

## Error Handling
- Handle errors explicitly and thoughtfully.

## Testing
- Write tests for all critical logic, edge cases, and business rules.
- Use mocks/stubs/fakes for external dependencies.

## Domain Knowledge & Business Logic
- Capture business rules and domain logic in code and comments where not obvious.
- Use domain terminology consistently.
- Prefer explicitness in business logic over implicit or "magic" behavior.

