/**
 * SOURCE OF TRUTH KEYWORDS: postcss, tailwind-v4, build-config, css-pipeline
 * WHAT: PostCSS configuration wiring Tailwind CSS v4 into the Next.js build
 * WHY: Next.js only discovers postcss.config.js / .cjs / .postcssrc.* —
 *      it does NOT load postcss.config.mjs. Without a recognized file the
 *      Tailwind plugin never runs, `@tailwind utilities` is left unexpanded,
 *      and every page renders unstyled.
 * WHERE: postcss.config.js
 */

module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
