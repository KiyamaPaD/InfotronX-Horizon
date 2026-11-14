# V7.1 — Measure theory and multiscale terrain analysis

**Status:** optional scientific lab over V7; still a draft until interactive review. All displayed figures are **modelled measurements on a source DEM**, not EVA safety decisions.

## Why measure theory matters

The Mars model uses **a natural rotation-invariant spherical surface-area measure**, closely related to integration with respect to Lebesgue measure in latitude/longitude coordinates. It is not correct to give every angular pixel the same area globally: a degree of longitude shrinks with latitude.

For a region \(A\) on a reference sphere of radius \(R = 3,396,190\,\mathrm m\), in planetocentric latitude \(\varphi\) and east-positive longitude \(\lambda\),

\[
\mu(A) = R^2\int\!\!\int_A \cos(\varphi)\,d\varphi\,d\lambda.
\]

For a pixel centered at latitude \(\varphi_i\), with angular half-height \(\Delta\varphi/2\) and width \(\Delta\lambda\), its **exact spherical reference-area** is

\[
A_i=R^2\Delta\lambda\left[\sin\!\left(\varphi_i+\frac{\Delta\varphi}{2}\right)-\sin\!\left(\varphi_i-\frac{\Delta\varphi}{2}\right)\right].
\]

The modeled reachable area is \(\mu(U) \approx \sum_{i:U_i=1} A_i\), excluding explicit NoData cells. The display also reports the reachable fraction \(\mu(U)/\mu(D_\text{valid})\).

This is **reference-sphere projected area**, NOT measured rugged terrain surface area. The latter would require an additional \(\sqrt{1+\lVert\nabla z\rVert^2}\) term in a locally planar approximation, along with resolution uncertainty. And it is not an actual physical safe zone.

### Where Haar measure belongs

The unique (up to scaling) translation-invariant Haar measure on the additive group \(\mathbb R^2\) is Lebesgue area. On the sphere, the natural area measure is invariant under the *rotations* acting on it; it can be obtained by pushing forward suitably normalized Haar measure from \(SO(3)\). However, \(S^2\) is not the additive plane and cannot be assigned globally uniform degree-square pixel area. We do **not** need an \(SO(3)\) integrator merely to compute local DEM reachability.

## Haar wavelet **transform**, not Haar measure

The **Haar wavelet transform** is a multi-resolution analysis technique and should not be confused with Haar measure. Given a 2×2 numeric height patch,

\[
\begin{bmatrix}z_{00}&z_{01}\\z_{10}&z_{11}\end{bmatrix},
\quad a=(z_{00}+z_{01}+z_{10}+z_{11})/4,
\]

we compute directional contrasts

\[
h=(z_{00}-z_{01}+z_{10}-z_{11})/4,
\quad v=(z_{00}+z_{01}-z_{10}-z_{11})/4,
\quad d=(z_{00}-z_{01}-z_{10}+z_{11})/4.
\]

These are **height-scaled (meters), invertible Haar coefficients**, normalized by 1/4 to retain intuitive mean-and-contrast values; they are not the orthonormal 1/2 Haar transform convention. In fact,

\[
\frac{1}{4}\sum_{k=1}^4(z_k-a)^2=h^2+v^2+d^2.
\]

The multi-scale algorithm averages each valid block to the next level, yielding modeled footprints ~40, 80, 160, 320 m, etc., as long as enough samples remain. A block with any NoData elevation is excluded; there is no interpolation across unknown terrain. This is an actual **multi-resolution height-contrast** calculation, not a proxy for unknown rock size, sand, astronaut mobility, or sub-pixel hazards.

**Key pitfall:** an ordinary inclined plane produces non-zero Haar contrast too, because horizontal/vertical detail also captures **slope**, not just small-scale residuals. Compare it with V7's independently detrended 3×3 plane residual, and do not call these quantities interchangeable.

## Why the current UI and algorithms benefit

1. The reachability-isocline area is now a coordinate-aware spherical integral instead of `cellCount × one center pixel area`.
2. The accessible fraction is normalized to the area of valid DEM data, not unknown pixels.
3. The new Terrain Intelligence lab reports multiple height-contrast scales with units and source caveats. Results can be added to the Mission Brief after calculation.
4. Pure functions have synthetic tests for spherical area, invertibility, conservation of variance, flat terrain, step terrain, missing data and Dijkstra area integration.

## Scientific source and citations

- DEM dataset: **USGS / NASA MRO CTX Jezero TRN digital terrain mosaic**, Fergason et al. (2020), DOI [10.5066/P906QQT8](https://doi.org/10.5066/P906QQT8), already bundled in V6.1.
- **MultiscaleDTM**: [Pike et al., multiscale geomorphometry (2023)](https://doi.org/10.1111/tgis.13067), methodology reference.
- [Kalbermatten et al. (2012), wavelets for multi-scale DEM interpretation](https://doi.org/10.1016/j.geomorph.2011.09.023).
- [Recent roughness-review article, Remote Sensing (2025)](https://doi.org/10.3390/rs17233864).
- The **new functions are independently implemented** in `src/measure-theory.js`, not copies of the papers' source code.

## Next mathematical research (after the actual review)

- **Coarea formula**: calculate area percentages by elevation/slope bands, or lengths of contour levels, only when grid resolution and interpolation are documented.
- **Bayesian uncertainty**: attach calibrated DEM variance distributions after obtaining overlapping HiRISE/CTX validation samples. No arbitrary distributions sold as actual hazards.
- **Wasserstein distance / optimal transport**: compare probability distributions of two route resource predictions rather than a single average; requires calibrated scenario data.
- **Riemannian/Finsler geometry**: route lengths on a height field and direction-dependent costs, using validated terrain data rather than decorative complexity.
- **SO(3), quaternions and Haar integration**: useful for rover attitude priors and sensor/3D orientation pipelines, not a near-term route-area feature.

These ideas have value only with explicit data sources, correct coordinate systems and testable outputs.
