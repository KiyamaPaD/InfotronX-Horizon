# InfotronX Horizon — team setup

**Team name:** InfotronX Horizon  
**Team season:** 2026–2027  
**Challenge entry:** Mars Atlas — NASA Space Apps Challenge **2026**

The official NASA event is annual and identified as 2026; the team's season label is separate. The team is an independent participant, not a NASA department.

## Recommended repository home

Preferred GitHub display organization: **InfotronX Horizon**. Preferred URL slug: **`InfotronX-Horizon`**, subject to availability.

The existing repository `KiyamaPaD/Mars-Atlas-NASA-2026` already has source history, pull requests and issues. **Do not delete it.** Best migration route: a team owner creates the organization and transfers the current repository after backup and review. The repository can be renamed to `Mars-Atlas` after the transfer if desired, with links and deployments updated afterward.

## Create the team organization (owner action)

1. Go to https://github.com/organizations/new and choose the name **InfotronX Horizon** and an available slug.
2. Choose initial organization owners: one responsible lead plus a trusted recovery owner. Do not give everybody organization owner permissions.
3. Create a dedicated `Developers` team and assign appropriate repository access (typically `Write`).
4. In the existing repository go to **Settings → General → Danger Zone → Transfer ownership** and select the organization. Take a full Git mirror backup first and ensure the destination can accept the repository.
5. Verify commits, branches, PRs, issues, release URLs and permissions after transfer; replace old repository URLs and Git remotes only after confirming the new location. GitHub generally redirects old repository URLs, but integrations require verification.
6. Enable main-branch rules: require PRs and review, disallow force pushes/deletion, and require the exact successful CI status as shown by GitHub. Keep an approved release administrator.

**Alternative:** create a new clean repository, but keep the old one as a public or private archive, with the original authorship/history intact. Do not falsely recast previous work as commits authored by newly joined teammates.

## Team roles

| Permission | Recommended use |
| --- | --- |
| GitHub Read/Triage | Review research, reproduce issues and manage tasks |
| GitHub Write | Build features on branches, open PRs, run tests |
| GitHub Admin | Trusted maintainers for rules, secrets and repository settings |
| Vercel deployment | Release owner until project/team access is separately configured |
| Future database access | Only after a dedicated project, authenticated users and row-level security are reviewed |

## Hosting

The existing Vercel project serves a stable older production version. It is currently in the personal Hobby team `kiyama1`; production must not be repointed during organizational cleanup. GitHub Write access doesn't automatically grant Vercel access. To get automatic previews, connect the transferred repository in the intended Vercel project or create a **separate staging project**. Any paid team upgrade needs approval.

Vercel serves the website; it does not currently synchronize mission data among users. The `supabase/schema.sql` file is **not** an operational shared backend. Realtime data sharing would need a new dedicated Supabase project with Auth, RLS, a reviewable migration and backup plan.

## Exit checklist

- [ ] Organization created and owner accounts secured
- [ ] Original repository mirrored/backed up
- [ ] Transfer completed without losing existing history or PRs
- [ ] Each member accepts their invitation and can open a test PR
- [ ] Protected `main`, required CI and peer review
- [ ] New repository URL and Git integration checked
- [ ] Staging deployment tested on desktop/mobile
- [ ] Production still operational and rollback available

Official GitHub guidance: https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository
