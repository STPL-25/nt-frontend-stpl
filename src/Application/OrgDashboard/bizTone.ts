/**
 * Colour = meaning (status / kind), never decoration, and always paired with an icon or a word. Every class is written out in
 * full so Tailwind can see it, each tone has a dark-mode pair, and the theme colour (`primary`) is not used for text because it
 * disappears on the pastel themes.
 */
export type BizTone = "sky" | "amber" | "green" | "violet" | "teal" | "red" | "slate";

export const BIZ_TONE: Record<BizTone, { chip: string; icon: string; text: string; bar: string; dot: string; ring: string }> = {
  sky:    { chip: "bg-sky-500/10 text-sky-800 ring-sky-600/25 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/25",             icon: "bg-sky-500/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300",             text: "text-sky-700 dark:text-sky-300",       bar: "bg-sky-500",    dot: "bg-sky-500",    ring: "ring-sky-500/20" },
  amber:  { chip: "bg-amber-500/10 text-amber-800 ring-amber-600/25 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25", icon: "bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",     text: "text-amber-700 dark:text-amber-300",   bar: "bg-amber-500",  dot: "bg-amber-500",  ring: "ring-amber-500/20" },
  green:  { chip: "bg-green-500/10 text-green-800 ring-green-600/25 dark:bg-green-400/10 dark:text-green-300 dark:ring-green-400/25", icon: "bg-green-500/10 text-green-700 dark:bg-green-400/10 dark:text-green-300",     text: "text-green-700 dark:text-green-300",   bar: "bg-green-500",  dot: "bg-green-500",  ring: "ring-green-500/20" },
  violet: { chip: "bg-violet-500/10 text-violet-800 ring-violet-600/25 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/25", icon: "bg-violet-500/10 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300", text: "text-violet-700 dark:text-violet-300", bar: "bg-violet-500", dot: "bg-violet-500", ring: "ring-violet-500/20" },
  teal:   { chip: "bg-teal-500/10 text-teal-800 ring-teal-600/25 dark:bg-teal-400/10 dark:text-teal-300 dark:ring-teal-400/25",       icon: "bg-teal-500/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300",         text: "text-teal-700 dark:text-teal-300",     bar: "bg-teal-500",   dot: "bg-teal-500",   ring: "ring-teal-500/20" },
  red:    { chip: "bg-red-500/10 text-red-800 ring-red-600/25 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/25",             icon: "bg-red-500/10 text-red-700 dark:bg-red-400/10 dark:text-red-300",             text: "text-red-700 dark:text-red-300",       bar: "bg-red-500",    dot: "bg-red-500",    ring: "ring-red-500/20" },
  slate:  { chip: "bg-slate-500/10 text-slate-700 ring-slate-500/25 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/25", icon: "bg-slate-500/10 text-slate-600 dark:bg-slate-400/10 dark:text-slate-300",     text: "text-slate-600 dark:text-slate-300",   bar: "bg-slate-400",  dot: "bg-slate-400",  ring: "ring-slate-500/20" },
};
