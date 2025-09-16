// src/components/Greetings.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import StarsCanvas from "./Stars"; // starry background component

const suggestions = [
  "Which projects used MERN stack?",
  "What problem did MedHub Ethiopia solve?",
  "Does Nati know CI/CD practices?",
  "What are his strongest frontend skills?",
  "Which databases does he know?",
];

const Greetings = () => {
  const [currentIdx, setCurrentIdx] = useState(0);

  // rotate index every 3s
  useEffect(() => {
    const t = setInterval(() => setCurrentIdx((i) => (i + 1) % suggestions.length), 3000);
    return () => clearInterval(t);
  }, []);

  // click a suggestion -> scroll to prompt and dispatch prefill event
  const handleSuggestionClick = (text) => {
    // dispatch event to prompt section (decoupled)
    window.dispatchEvent(new CustomEvent("prefill-query", { detail: text }));
    // scroll prompt section into view (PromptSection should have id="prompt-section")
    const el = document.getElementById("prompt-section");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section className="relative w-full min-h-screen flex items-center justify-center text-center px-4 bg-hero-pattern bg-cover bg-no-repeat bg-center">
      <StarsCanvas />

      <div className="relative z-10 max-w-3xl">
        <motion.h1
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
          className="text-white text-4xl sm:text-5xl font-bold leading-tight"
        >
          Welcome, Hiring Team!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3 }}
          className="text-white-100 mt-4 text-lg sm:text-xl max-w-xl mx-auto"
        >
          I’m <span className="text-[#915EFF] font-semibold">Saba</span>, Nati’s AI powered portfolio assistant. Ask me anything about his <span className="orange-text-gradient">skills</span>, <span className="pink-text-gradient">projects</span>, or <span className="blue-text-gradient">experience</span>.
        </motion.p>

        {/* rotating suggestion visual (single slot) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="mt-10 flex items-center justify-center"
        >
          <button
            onClick={() => handleSuggestionClick(suggestions[currentIdx])}
            className="px-6 py-3 rounded-2xl border border-secondary bg-black/40 text-white text-sm sm:text-base shadow-card hover:scale-105 transition-transform"
            aria-label="Use suggested question"
          >
            <span className="italic text-gray-200">Try:</span>{" "}
            <span className="ml-2 font-medium">{suggestions[currentIdx]}</span>
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-4 text-sm text-gray-400"
        >
          Click the suggestion to jump to the chat — or start typing below.
        </motion.p>
      </div>
    </section>
  );
};

export default Greetings;
