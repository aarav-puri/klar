/** Neo-brutalist button styles for the website. Every one has a 2px border and a hard shadow it sinks into. */
const base =
  "nb-border nb-press inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-bold focus-visible:outline-offset-4 [&_svg]:size-4 [&_svg]:shrink-0";

export const nbButton = {
  primary: `${base} nb-shadow-lg bg-nb-dark px-7 py-3.5 text-base text-white dark:bg-nb-pop dark:text-nb-text`,
  secondary: `${base} nb-shadow bg-nb-card px-7 py-3.5 text-base text-nb-text`,
  small: `${base} nb-shadow bg-nb-dark px-4 py-2 text-sm text-white dark:bg-nb-pop dark:text-nb-text`,
};
