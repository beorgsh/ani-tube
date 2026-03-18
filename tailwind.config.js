export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      transitionTimingFunction: {
        preview: "cubic-bezier(0.4, 0, 0.2, 1)", // similar to YouTube's
      },
    },
  },
  plugins: [],
};
