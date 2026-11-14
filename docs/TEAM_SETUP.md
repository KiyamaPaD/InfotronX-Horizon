# InfotronX Horizon — team setup

**Project:** Mars Atlas  
**Challenge:** NASA Space Apps Challenge 2026  
**Team season:** 2026–2027

## Current locations

- **GitHub:** https://github.com/KiyamaPaD/Mars-Atlas
- **Production alias:** https://mars-atlas-mu.vercel.app (confirm access from an incognito session before sharing)
- **Repository branch:** `main`, with a fresh Git history and direct pushes
- **Hosting:** Vercel project `mars-atlas` in the existing account

The clean repository was intentionally created as a new publication location. It does not carry the earlier Git history, but the code has a development history prior to that first commit. Keep the original repository/backups until you have verified this version and the attribution requirements.

## Access for coworkers

- **Just testing?** Share the working site URL or a Vercel **Shareable Link** if authentication is required. Testers do not need GitHub write access.
- **Reporting bugs?** Give the [beta checklist](BETA_TESTING.md) and the [Issues link](https://github.com/KiyamaPaD/Mars-Atlas/issues).
- **Writing code?** Invite the actual GitHub account as a repository collaborator with appropriate `Write` access. Each person commits under their own account.
- **Deploy administration?** Keep Vercel project settings and future domain ownership with a trusted maintainer.
- **Organization later?** `InfotronX-Horizon` is an optional future GitHub organization, not a completed migration.

## Hosting and storage boundaries

The Vercel frontend is connected to a dedicated Supabase project for authenticated cloud saving and per-mission roles. Browser-local saves and exports still work independently; cloud operations are explicit, not simultaneous realtime editing. Email redirects and real-user verification are still required.

## Team launch checklist

- [x] New `Mars-Atlas` repository exists, with `main` and initial GitHub Actions success
- [x] New Vercel `mars-atlas` deployment is marked READY
- [ ] Public/coworker access tested in private browsing
- [ ] Desktop and mobile interactive smoke test performed
- [ ] All key workflows tested, with bugs recorded in GitHub Issues
- [ ] Source attributions and hackathon eligibility reviewed honestly
- [ ] Custom domain purchased and connected (future task)

## Cloud access activation

The dedicated Mars Atlas project has been created and secured. See [local-sql/README.md](../local-sql/README.md) for Auth redirect URLs and the security checklist. Before publicly inviting accounts, test sign-up confirmation, sign-in, cloud save/open and sharing across two different users. Never share a private service key.
