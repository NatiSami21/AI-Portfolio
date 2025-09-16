// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{html,js,jsx,ts,tsx}', // For files in a 'src' directory
    './pages/**/*.{html,js,jsx,ts,tsx}', // For Next.js projects
    './components/**/*.{html,js,jsx,ts,tsx}', // For component folders
    './index.html', // For a simple setup with a single index file
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};