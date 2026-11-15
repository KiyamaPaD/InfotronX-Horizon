# MARS ATLAS — Data provenance and AI assistance disclosure (DRAFT)

This file is a transparent disclosure draft for the InfotronX Horizon team to review before its NASA Space Apps 2026 submission. **Confirm every tool actually used**; add all missing AI tools before publication. Avoid invented vendor names, exact contribution percentages or vague claims that NASA authored the custom code.

## Data and external services

- **NASA/JPL Mars Trek:** publicly served Mars map imagery and tile metadata.
  https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
- **USGS Astrogeology / NASA MRO CTX:** processed Jezero CTX digital terrain model (numeric heights) and separate orthorectified imagery. See source links and resolution distinctions in `JUDGE_SCIENTIFIC_VALIDATION.md`.
- **Supabase:** optional private account, mission sync and Crew Profile storage; the mapping and A* core remain usable manually.
- **GitHub:** version control and automated tests.
- **Vercel:** website hosting/deployment.

## AI-assisted development — confirmed in this workstream

**OpenAI ChatGPT:** assisted with architecture planning, code drafts, mathematical reasoning, test design, user-interface iterations, documentation, and preparation of model explanations. The team remains responsible for checking, running, debugging, selecting and accepting the resulting code and claims. AI-generated prose is not a scientific source, and AI model outputs are not a substitute for numeric terrain measurements.

**Other AI tools/models:** TO BE COMPLETED BY THE TEAM based on actual use. Do **not** state "none" unless every teammate confirms it. Record the model/tool, purpose, human validation and whether AI-generated assets were used.

### Suggested submission language (review before sending)

> "Our custom MARS ATLAS application uses NASA/JPL Mars Trek imagery and USGS/NASA CTX-derived Jezero terrain data. We used OpenAI ChatGPT as a development assistant for parts of the code, interface exploration, tests and documentation. Our team selected the design, integrated and checked the application, and remains responsible for the mathematics, data provenance and final claims. Our route calculations use deterministic algorithms, not AI-generated terrain or AI-certified safety. Additional tools used by teammates are disclosed in our full project notes."

## Distinguish AI from algorithms

- **A*** is deterministic search on a weighted grid graph. It is not generative AI.
- A synthetic uncertainty simulation is not a measured NASA probability model.
- A numerical route selected from sampled CTX terrain is not a spaceflight-approved traverse.
- AI may optionally explain already-computed evidence, but must not secretly validate, add, save, or override a user-created mission.

## Pending before the final 18:00 team checkpoint

1. Each teammate confirms exactly what AI tools were used.
2. Add any image-generation or generative code tools used, with roles and validation.
3. Check source attribution in the UI, README, demo and project submission text.
4. Keep the Mars Trek image mosaic, numerical CTX DTM and user hypothetical decisions visibly distinct.
