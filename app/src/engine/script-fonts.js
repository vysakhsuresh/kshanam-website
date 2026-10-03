/**
 * Families that carry a non-Latin script someone might type into a design.
 *
 * Kept in its own tiny module with no JSON import, so the renderer can be
 * loaded by plain Node in tests. Every design's font stack ends with these,
 * which is what lets a family type Malayalam into a design built around a
 * Latin serif and still get correctly shaped text rather than boxes.
 */
export const SCRIPT_FALLBACK = ['Anek Malayalam', 'Manjari'];
