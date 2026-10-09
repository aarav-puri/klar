/**
 * Course series colors. Slots follow a validated categorical order and are
 * tied to a course's stable index, never to its rank, so filtering never
 * repaints a course. Past six courses, the rest share a neutral "other" color.
 */
export const seriesColor = (i: number) => (i < 6 ? `var(--chart-${i + 1})` : "var(--chart-other)");
