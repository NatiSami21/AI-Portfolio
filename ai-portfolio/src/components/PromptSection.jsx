// src/components/PromptSection.jsx
import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Fuse from "fuse.js";
import synonyms from "../data/synonyms.json";

/**
 * PromptSection (Fuse.js + synonyms + two-stage search)
 *
 * - Small-talk classifier (strict, token-level) -> handles "hi", "thanks"
 * - Stage 2: fuzzy KB search (Fuse.js) after expanding query with synonyms
 * - If best score <= threshold -> return best answer
 * - If best score > threshold -> show top-3 "Did you mean...?" clickable suggestions
 * - Preserves UI behavior: typing animation, scrolling on answer, suggestions dropdown, prefill event
 */

export default function PromptSection() {
  const [messages, setMessages] = useState([
    {
      from: "saba",
      text: "👋 Hi I’m Saba. Ask me anything about his projects, or try a suggested question above.",
    },
  ]);

  const [input, setInput] = useState("");
  const [placeholder, setPlaceholder] = useState(
    "Ask about Nati’s projects, skills, or experience..."
  );
  const [suggestions, setSuggestions] = useState([]);
  const [knowledgeBase, setKnowledgeBase] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  const [pendingFollowUps, setPendingFollowUps] = useState([]);
  const [followUpIndex, setFollowUpIndex] = useState(0);
  const [lastAnsweredTopic, setLastAnsweredTopic] = useState(null);

  const [didYouMean, setDidYouMean] = useState([]); // fallback suggestions from Fuse
  const fuseRef = useRef(null);
  const docsRef = useRef([]); // flattened docs

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // small-talk tokens (strict)
  const SMALL_TALK = new Set(["hi", "hello", "hey", "thanks", "thank", "yo", "good", "morning", "evening"]);
  const smallTalkResponses = {
    hi: "👋 Hello! I’m Saba, Nati’s AI-powered portfolio assistant. Ask me anything!",
    hello: "Hi there! Ask me about Nati’s projects or skills.",
    thanks: "You’re welcome! 😄 Want to know more about Nati’s achievements?",
    thank: "Happy to help! 😊 Any other question about Nati?"
  };

  // --- Utility helpers ---
  const tokensOf = (text = "") =>
    String(text)
      .toLowerCase()
      .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

  const levenshtein = (a = "", b = "") => {
    const m = a.length; const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  };

  // apply synonyms: if any synonym appears in tokens, add canonical key to expanded query
  const expandQueryWithSynonyms = (rawQuery) => {
    const toks = tokensOf(rawQuery);
    const additions = [];
    for (const canonical of Object.keys(synonyms)) {
      const synList = synonyms[canonical] || [];
      // if any synonym token present in query tokens, add canonical keyword
      if (synList.some((s) => toks.includes(s.toLowerCase()))) additions.push(canonical);
    }
    return `${rawQuery} ${additions.join(" ")}`.trim();
  };

  // fetch KB and init fuse
  useEffect(() => {
    fetch("/knowledge-base.json")
      .then((res) => res.json())
      .then((data) => {
        setKnowledgeBase(data);
        // flatten arrays into docs
        const docs = [];
        Object.entries(data).forEach(([category, value]) => {
          if (Array.isArray(value)) {
            value.forEach((item, idx) => {
              docs.push({ ...item, __category: category, __id: `${category}-${idx}` });
            });
          } else if (value && typeof value === "object") {
            // profile or single object
            docs.push({ ...value, __category: category, __id: category });
          }
        });
        docsRef.current = docs;
        // fuse options: weight important fields
        const options = {
          includeScore: true,
          threshold: 0.35, // tune: lower => stricter; 0.35 is a good start
          ignoreLocation: true,
          keys: [
            { name: "name", weight: 0.9 },
            { name: "title", weight: 0.9 },
            { name: "company_name", weight: 0.8 },
            { name: "description", weight: 0.6 },
            { name: "technologies", weight: 0.85 },
            { name: "tags.name", weight: 0.8 },
            { name: "skills", weight: 0.8 },
            { name: "skills_gained", weight: 0.8 },
            { name: "problems_solved", weight: 0.8 },
            { name: "lessons_gained", weight: 0.6 },
            { name: "headline", weight: 0.6 }
          ],
        };
        fuseRef.current = new Fuse(docs, options);
      })
      .catch((err) => {
        console.error("Error loading knowledge base:", err);
      });
  }, []);

  // Prefill event (unchanged behavior)
  useEffect(() => {
    const handler = (e) => {
      const q = e.detail;
      setInput(q || "");
      const el = document.getElementById("prompt-section");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => inputRef.current?.focus(), 300);
    };
    window.addEventListener("prefill-query", handler);
    return () => window.removeEventListener("prefill-query", handler);
  }, []);

  // simulate typing & append message
  const simulateTyping = (text, onComplete) => {
    setIsTyping(true);
    let i = 0;
    setMessages(prev => [...prev, { from: "saba", text: "" }]);
    const interval = setInterval(() => {
      const current = text.slice(0, i);
      setMessages(prev => {
        const copy = prev.slice(0, prev.length - 1);
        return [...copy, { from: "saba", text: current }];
      });
      i++;
      if (i > text.length) {
        clearInterval(interval);
        setIsTyping(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
        if (onComplete) onComplete();
      }
    }, 16);
  };

  // Build answer from a known item (used for direct suggestion or fuzzy best result)
  const buildAnswerFromItem = (item, category) => {
    const title = item.title || item.name || item.company_name || "Item";
    let out = `✨ ${title}\n\n`;
    if (item.headline) out += `${item.headline}\n\n`;
    if (item.description) out += `${item.description}\n\n`;
    if (item.problems_solved) out += `Problems solved: ${item.problems_solved.join(", ")}\n\n`;
    if (item.technologies) out += `Technologies: ${item.technologies.join(", ")}\n`;
    if (item.skills || item.skills_gained) out += `Skills: ${(item.skills || item.skills_gained).join(", ")}\n`;
    if (item.lessons_gained) out += `Lessons: ${item.lessons_gained.join(", ")}\n`;
    if (item.impact) out += `Impact: ${item.impact}\n`;
    if (item.source_code_link) out += `🔗 Link: ${item.source_code_link}\n`;
    if (item.media) out += `🎬 Media: ${item.media}\n`;

    // follow-ups
    const followUps = [];
    if (category === "projects") {
      followUps.push("How did he solve performance or scaling issues in this project?");
      followUps.push("Show the project's source or demo link?");
    } else if (category === "experiences") {
      followUps.push("What skills did he gain in this role?");
      followUps.push("Which projects came out of this experience?");
    } else {
      followUps.push("Would you like more examples or code links?");
    }

    // set last answered context
    setLastAnsweredTopic({ category, item });
    return { text: out, followUps };
  };

  // Small-talk classifier (strict): only allow small talk when query is very short and tokens are small-talk tokens
  const detectSmallTalk = (query) => {
    const toks = tokensOf(query);
    if (toks.length === 0) return null;
    // if query contains only small-talk tokens or is 1 token and matches smalltalk -> respond
    if (toks.length <= 3) {
      for (const t of toks) {
        if (SMALL_TALK.has(t)) {
          // pick canonical key (first match)
          for (const k of Object.keys(smallTalkResponses)) {
            if (t === k || levenshtein(t, k) <= 1) return smallTalkResponses[k];
          }
        }
      }
    }
    return null;
  };

  // Main search function using Fuse + synonyms expansion, returns { type: "best"|"fallback"|"none", data }
  const runFuzzySearch = (query) => {
    if (!fuseRef.current) return { type: "none" };
    // expand with synonyms
    const expanded = expandQueryWithSynonyms(query);

    const results = fuseRef.current.search(expanded);
    if (!results || results.length === 0) return { type: "none" };

    // Best score (lower is better). We'll use threshold of 0.35 from options.
    const best = results[0];
    // If best.score <= 0.35 treat as confident hit (exact enough)
    if (typeof best.score === "number" && best.score <= 0.35) {
      return { type: "best", data: best.item };
    }

    // Otherwise return top-3 as fallback suggestions
    const top3 = results.slice(0, 3).map((r) => r.item);
    return { type: "fallback", data: top3 };
  };

  // Follow-up trigger (yes / tell me more)
  const handleFollowUpTrigger = (userText) => {
    const t = (userText || "").toLowerCase().trim();
    if (!pendingFollowUps || pendingFollowUps.length === 0) return false;
    if (["yes", "y", "tell me more", "more", "please"].includes(t)) {
      const next = pendingFollowUps[followUpIndex % pendingFollowUps.length];
      setFollowUpIndex(i => i + 1);
      // If follow-up refers to performance and we have lastAnsweredTopic, craft context-aware answer
      if (lastAnsweredTopic && next.toLowerCase().includes("performance")) {
        // if project has performance data
        const perf = lastAnsweredTopic.item?.performance;
        const text = perf ? `🚀 Performance improvements: ${perf}` : `🚀 He optimized queries, lazy-loaded UI, and added caching to improve performance.`;
        setTimeout(() => handleSend(text), 200);
      } else {
        setTimeout(() => handleSend(next), 200);
      }
      return true;
    }
    return false;
  };

  // Build answer by query (stage1 small talk then stage2 fuzzy)
  const buildAnswer = (query) => {
    // 1) small talk (strict)
    const st = detectSmallTalk(query);
    if (st) return { text: st, followUps: [] };

    // 2) check direct suggested mappings (optional - you can add more keys)
    const qLower = query.toLowerCase().trim();
    // exact canonical mapping check
    if (["which projects used mern stack?", "which projects used mern", "mern projects"].includes(qLower)) {
      // find MERN projects
      const mproj = (docsRef.current || []).filter(d =>
        Array.isArray(d.technologies) && d.technologies.some(t => String(t).toLowerCase().includes("mern") || String(t).toLowerCase().includes("mongo"))
      );
      if (mproj.length) {
        return {
          text: `📌 Projects using MERN: ${mproj.map(p => p.name || p.title).join(", ")}`,
          followUps: [`Do you want details on ${mproj[0].name || mproj[0].title}?`]
        };
      }
    }

    // 3) run Fuse fuzzy search
    const res = runFuzzySearch(query);
    if (res.type === "none") {
      return {
        text: `🤔 I couldn't find a direct match for "${query}". Try: "Tell me about MedHub Ethiopia", "What are his frontend skills?", or "Show testimonials".`,
        followUps: ["Would you like a list of top projects?", "Do you want his top skills?"]
      };
    }

    if (res.type === "best") {
      const item = res.data;
      // find its originating category
      const category = item.__category || "projects";
      const ans = buildAnswerFromItem(item, category);
      return ans;
    }

    // fallback: did you mean (top 3)
    if (res.type === "fallback") {
      const top = res.data;
      setDidYouMean(top);
      const choices = top.map((t, i) => `${i + 1}. ${t.name || t.title || t.company_name || "Item"}`).join("\n");
      return {
        text: `I found a few close matches — did you mean one of these?\n\n${choices}\n\nClick any suggestion below or type its name.`,
        followUps: []
      };
    }
  };

  // handle suggestion selection from Did-you-mean list
  const handleDidYouMeanSelect = (item) => {
    // push user message
    const label = item.name || item.title || item.company_name || "Item";
    setMessages(prev => [...prev, { from: "user", text: label }]);
    // create answer and simulate
    const answer = buildAnswerFromItem(item, item.__category);
    setDidYouMean([]);
    setPendingFollowUps(answer.followUps || []);
    setFollowUpIndex(0);
    setTimeout(() => simulateTyping(answer.text), 80);
    setInput("");
  };

  // main send handler
  const handleSend = (raw) => {
    const msgInput = (raw || "").trim();
    if (!msgInput) return;

    setMessages(prev => [...prev, { from: "user", text: msgInput }]);
    setLastAnsweredTopic((prev) => prev); // noop to keep state stable

    if (handleFollowUpTrigger(msgInput)) {
      setInput("");
      return;
    }

    const answerObj = buildAnswer(msgInput);
    setPendingFollowUps(answerObj.followUps || []);
    setFollowUpIndex(0);

    setDidYouMean([]); // clear previous did-you-mean
    setTimeout(() => simulateTyping(answerObj.text), 120);
    setInput("");
    setSuggestions([]);
  };

  // Live suggestions under input (unchanged behavior)
  useEffect(() => {
    if (!input) {
      setSuggestions([]);
      return;
    }
    const q = input.toLowerCase();
    const rotating = [
      "Which projects used MERN stack?",
      "What problem did MedHub Ethiopia solve?",
      "Does Nati know CI/CD practices?",
      "What are his strongest frontend skills?",
      "Which databases does he know?"
    ];
    const s1 = rotating.filter((r) => r.toLowerCase().includes(q)).slice(0, 3);
    const s2 = (docsRef.current || [])
      .map((p) => `Tell me about ${p.name || p.title || p.company_name}`)
      .filter((s) => s.toLowerCase().includes(q))
      .slice(0, 3);
    setSuggestions([...s1, ...s2].slice(0, 5));
  }, [input]);

  // suggestion click handler
  const onSuggestionClick = (s) => {
    setInput(s);
    inputRef.current?.focus();
  };

  // keyboard shortcuts: / focus, arrowUp recall last question
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "ArrowUp") {
        const last = messages.slice().reverse().find(m => m.from === "user");
        if (last) {
          setInput(last.text);
          inputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [messages]);

  // auto-scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isTyping]);

  return (
    <section id="prompt-section" className="relative w-full min-h-screen bg-primary">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* header */}
        <div className="p-4 bg-black-200 rounded-xl mb-4 shadow-card flex items-center justify-between">
          <div>
            <div className="text-white font-semibold">💼 Ask Saba — Nati's AI Portfolio Assistant</div>
            <div className="text-sm text-gray-400">Type a question or pick a suggested prompt.</div>
          </div>
          <div className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white">Powered by Saba 🤖</div>
        </div>

        {/* messages window */}
        <div className="bg-black-100 rounded-xl p-6 min-h-[40vh] max-h-[60vh] overflow-auto mb-4">
          {messages.map((m, i) => (
            <div key={i} className={`mb-4 flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: i * 0.02 }} className={`px-4 py-3 rounded-2xl max-w-[85%] whitespace-pre-wrap break-words ${m.from === "user" ? "bg-blue-600 text-white" : "bg-gray-700 text-green-200"}`}>
                {m.text}
              </motion.div>
            </div>
          ))}

          {/* Did you mean suggestions: show as interactive chips under messages */}
          {didYouMean && didYouMean.length > 0 && (
            <div className="mb-4 flex gap-2 flex-wrap">
              {didYouMean.map((d, idx) => (
                <button key={idx} onClick={() => handleDidYouMeanSelect(d)} className="px-3 py-1 rounded bg-white/6 text-white hover:bg-white/10">
                  {d.name || d.title || d.company_name || `Suggestion ${idx + 1}`}
                </button>
              ))}
            </div>
          )}

          {isTyping && <div className="text-gray-400 italic">Saba is typing…</div>}
          <div ref={messagesEndRef} />
        </div>

        {/* input + suggestions */}
        <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} className="relative">
          <div className="flex items-center gap-3">
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholder} className="flex-1 px-4 py-3 rounded-2xl bg-black/60 border border-white/6 text-white focus:outline-none focus:ring-2 focus:ring-[#915EFF]" />
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#915EFF] hover:bg-[#7a3fe0] text-white font-medium">Send</button>
          </div>

          {suggestions.length > 0 && (
            <div className="mt-2 bg-black/70 border border-white/6 rounded-lg shadow-lg text-sm overflow-hidden">
              {suggestions.map((s, i) => (
                <div key={i} onClick={() => onSuggestionClick(s)} className="px-4 py-2 hover:bg-white/5 cursor-pointer">{s}</div>
              ))}
            </div>
          )}

          {pendingFollowUps.length > 0 && (
            <div className="mt-3 text-sm text-gray-300 italic">Suggested next: <strong>{pendingFollowUps[0]}</strong> — reply <code>yes</code> to continue.</div>
          )}
        </form>
      </div>
    </section>
  );
}
