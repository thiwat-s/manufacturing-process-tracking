# Project Development Rules

## Code Quality

- Follow the project's Prettier configuration.
- Format every newly created or modified source file.
- Use TypeScript strict typing where applicable.
- Avoid unnecessary `any`.
- Remove unused imports and variables.
- Use clear and consistent naming conventions.
- Keep components and functions maintainable.
- Avoid unnecessarily complex nested logic.
- Reuse existing components and utilities where appropriate.
- Do not duplicate business logic.
- Do not disable ESLint rules just to make the checks pass.

## Responsive Design

- Every new UI component must support mobile, tablet, and desktop layouts.
- Follow mobile-first responsive design principles.
- Test UI changes at appropriate viewport sizes.
- Prevent unintended horizontal page overflow.
- Preserve usability and important information on mobile.
- Check dialogs, tables, charts, forms, and navigation on small screens.

## Final Validation

After every significant implementation:

- Run Prettier.
- Run ESLint.
- Run TypeScript checks.
- Run relevant automated tests.
- Check responsive behavior when UI changes are involved.
