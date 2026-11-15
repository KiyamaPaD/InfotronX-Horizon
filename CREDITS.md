# Credits

Mars Atlas stands on public data and open-source software. Thank you to everyone who made them.

*Mars Atlas is an independent project. It is not made, certified or endorsed by NASA, USGS or ESA.*

## Data

- **Viking MDIM 2.1 colour mosaic**: USGS Astrogeology / NASA Viking Orbiters, served by NASA Mars Trek.
- **HiRISE Jezero orthomosaic**: NASA / JPL-Caltech / University of Arizona (Mars Reconnaissance Orbiter), served by NASA Mars Trek.
- **CTX Jezero mosaic**: NASA / JPL-Caltech / MSSS (Mars Reconnaissance Orbiter), served by NASA Mars Trek.
- **MOLA elevation and relief shading**: NASA / Goddard Space Flight Center (Mars Global Surveyor), with HRSC context from ESA / DLR / FU Berlin, served by NASA Mars Trek.
- **CTX terrain model of the Mars 2020 landing site** (the bundled 20 m elevation clip): USGS Astrogeology Science Center. Fergason, R. L., et al. (2020). DOI [10.5066/P906QQT8](https://doi.org/10.5066/P906QQT8).
- **3D model of Mars** (the planet in the 3D view, with its texture and normal map): NASA/JPL-Caltech, https://science.nasa.gov/resource/planet-mars-3d-model/. The file is included unchanged as `assets/nasa/mars-3d-model.glb`; the app makes its mesh denser and lifts it with MOLA heights.
- Mars Trek: https://trek.nasa.gov/mars/

Please check each provider's own terms before reusing their imagery.

## Software

- **three.js** (MIT): 3D graphics in the welcome screen and the terrain view.
- **Supabase** (Apache-2.0): optional accounts and cloud storage.
- **Google Fonts**: DM Sans and Space Grotesk (SIL Open Font Licence).
- Everything else is native browser JavaScript and CSS.

## The globe, space scenery and animations

The planets, satellites, rocket, stars and shooting stars on the welcome screen and in the 3D view are decorative illustrations drawn by the app. They are not real-time positions of real objects.

## AI assistance

AI tools helped write code and documentation. People reviewed and tested the result. Tools used so far: OpenAI ChatGPT and Anthropic Claude. See [docs/AI_USE_AND_SOURCES.md](docs/AI_USE_AND_SOURCES.md) for details, and keep that file up to date.

## Team

Built by **InfotronX Horizon** for the NASA Space Apps Challenge 2026. Contributors are listed in the [GitHub contributors page](https://github.com/KiyamaPaD/Mars-Atlas/graphs/contributors).

## Copyright

Copyright (c) 2026 InfotronX Horizon and Mars Atlas contributors. The source code is released under the [MIT licence](LICENSE). Data and images keep the licences and credits of their owners.
