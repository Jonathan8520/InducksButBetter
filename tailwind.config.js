/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      /**
       * Aucune fonte n'était déclarée : le site s'affichait dans la police système par
       * défaut, ce qui contribuait à l'impression de gabarit générique.
       *
       * Volontairement, aucune fonte n'est TÉLÉCHARGÉE : la base est conçue pour
       * fonctionner hors-ligne et le déploiement est purement statique. On s'appuie donc
       * sur des familles présentes partout, choisies pour leur caractère.
       */
      fontFamily: {
        // Titres : une serif d'imprimé, qui évoque la page plutôt que l'écran.
        display: ['Georgia', '"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', 'serif'],
        // Interface : la grotesque système, neutre et dense.
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        // Codes Inducks (« W OS  178-02 ») : ce sont des identifiants, l'alignement des
        // colonnes compte autant que dans du code.
        mono: ['"Cascadia Mono"', 'Consolas', '"SF Mono"', 'Menlo', '"DejaVu Sans Mono"', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        'brand-shades-700': '#1e3a8a',
        /* ── Semantic surface tokens ────────────────── */
        surface: {
          DEFAULT:  "hsl(var(--surface))",
          2:        "hsl(var(--surface-2))",
          3:        "hsl(var(--surface-3))",
          invert:   "hsl(var(--surface-invert))",
        },
        /* ── Semantic border tokens ─────────────────── */
        'border-subtle': "hsl(var(--border-subtle))",
        /* ── Semantic text tokens ────────────────────── */
        'text-body':      "hsl(var(--text-body))",
        'text-secondary': "hsl(var(--text-secondary))",
        'text-hint':      "hsl(var(--text-hint))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
