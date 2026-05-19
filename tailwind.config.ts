import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-jakarta)', 'sans-serif'],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Lightning-aligned neutrals
        ink: {
          strong: '#080707',  // headings
          DEFAULT: '#181818', // body
          weak: '#3E3E3C',    // secondary
          subtle: '#706E6B',  // labels, metadata
          mute: '#A8A8A8',    // placeholder, disabled
        },
        line: {
          DEFAULT: '#DDDBDA',
          subtle: '#ECEBEA',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          gray: '#F3F2F2',
        },
      },
    },
  },
  plugins: [],
};
export default config;
