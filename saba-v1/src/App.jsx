// src/App.jsx
import React from "react";
import Navbar from "./components/Navbar";
import Greetings from "./components/Greetings";
import PromptSection from "./components/PromptSection";
// import global CSS that you already have (tailwind etc)

export default function App() {
  return (
    <div className="relative min-h-screen bg-primary">
      <Navbar />
      <div className="pt-16"> {/* account for fixed navbar height */}
        <Greetings />
        <PromptSection />
      </div>
    </div>
  );
}
