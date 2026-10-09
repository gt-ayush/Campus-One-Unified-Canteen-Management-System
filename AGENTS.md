# AGENTS.md

# Every rule here must be followed.

## 1. Build from existing patterns, not new ones

* You are building this app as a pattern-recognition model; everything you write should come from patterns and coding practices already in the codebase.


* Never invent your own architecture, pull in your own libraries, or start a new pattern without first confirming that a similar one doesn't already exist.


* The app runs on a Source of Truth global architecture—your job is to build into it and globalize what you write so features are plug-in rather than rewrites.



## 2. How to search: `grep -l` first

* The whole codebase carries a `SOURCE OF TRUTH KEYWORDS` line at the top of each file and code block precisely so you can find things without reading everything, keeping context pollution at zero and preventing session limit burns.


* Before creating any type, function, constant, or component, grep for it by keyword using `-l` to find the exact file where it lives or should live.


* If you create something new, give it its own `SOURCE OF TRUTH KEYWORDS` line with 5 to 6 specific keywords so the next agent can understand how it works. Never duplicate existing work.



## 3. The layered architecture

1. **Protected procedure** is the heart of the app; every important router endpoint must use it to handle feature gates, usage checks, and server-side authorization.


2. **Routers** consume the protected procedure and hold business logic, validation, and orchestration.


3. **Service layer** is the only layer that touches the database directly and must start with `import "server-only"`. Import services into routers using `import * as` for proper object references.



* Remember to wire up any permission the feature requires, and never create `middleware.ts` (the framework reads `proxy.ts` instead).



## 4. Production-grade TypeScript

* Never use `any`, `unknown`, hardcoded types, or TypeScript bypasses.


* For types, check Prisma types first if related to the database, or check `lib/types` to see if a custom type already exists.


* Run a TypeScript check every single time you hand something over to prove the codebase is clean.



## 5. Validate every input with Zod

* Every component, form, and endpoint that takes input uses a Zod schema every single time, with React Hook Form following the shadcn approach to prevent data corruption.



## 6. Inline comment context injection

* Above every function or block, write a comment block containing Source of Truth keywords, WHAT the block is, WHY it's needed, and WHERE it's being used.


* Add ordinary inline comments too, keeping them minimal and outcome-based rather than narrating the code.



## 7. UI

* Design every component for reuse without hardcoding logic, layouts, or data.


* Place components reusable across routes in `components/global/COMPONENT_NAME_FOLDER` and route-specific ones in `THE_ROUTE/_components`.


* Never hardcode theme colors (no hex values, `text-white`, `bg-[#...]`, or forced `dark` classes); always use theme tokens like `bg-background`, `text-foreground`, `bg-card`, `bg-primary`, and `border`.



## 8. Delivery

* Keep everything production-grade: never create scripts, Prisma scripts, seed files, or probe/tester files that couldn't be pushed to production without asking permission.


* Use barrel exports wherever possible and never skip features or leave them incomplete.


* Don't use git unless told to do so.


