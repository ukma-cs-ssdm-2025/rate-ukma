# Notes from First Team Meeting

- [x] Team/project name chosen (ABVH)  
- [x] Roles assigned  

## Roles
- Katya: Repo Maintainer
- Nastya: CI Maintainer
- Milana: Docs Lead
- Andrii: Tracker Lead

## Meetings
- Weekly: Friday 13:00  

## Communication
- Discord (main channel)  

## Areas
- Parser
- Auth
- Deduplication
- Backend API
- Frontend UI
- Deploy  

## Tech Stack
Backend: Python + Django · Frontend: React · API: OpenAPI

## Workflow: GitHub Flow + Trunk‑based Development

- **Main branch (`main`)**  
  - Always stable, no direct pushes → only via Pull Requests.  

- **Branches** (per issue/task)  
  - Format: `type/#<issue-number>-short-description`  
  - Example: `feature/#3-teamcharter-setup`  

- **Commits** (semantic + issue link)  
  - Format: `<type>(#<issue-number>): short message`  
  - Examples:  
    - `feat(#3): add TeamCharter.md`  
    - `fix(#2): correct CI workflow`
  - _See [Semantic Commits](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716)_

- **Big tasks** → split into smaller subtasks/PRs  
  - Example: schema → backend → frontend.  

- **PRs**  
  - Open early (Drafts welcome).  
  - Require at least one approval before merging.  

- **Integration**  
  - Merge often → avoid long‑lived branches and big conflicts.
