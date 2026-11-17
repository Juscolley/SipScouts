# SipScouts Workspace Rules

- **Auto-commit and push after code changes:** After completing code edits in `SipScout App Idea` (and verifying they pass typechecks/tests), automatically stage only the files edited for the task, commit with a clear message, and push to `origin/main`—unless the user explicitly asks to hold off on committing/pushing. Do not stage unrelated untracked or local database/scratch files (such as `*.db` or ad-hoc `.sql` files) unless requested.
