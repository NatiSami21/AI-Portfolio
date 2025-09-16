// src/components/PromptSection.jsx
import React, { useState, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff } from 'lucide-react';

// Import all data sources
import intentMapping from '../data/intent-mapping.json';
import knowledgeBase from '../data/knowledge-base.json';
import projects from '../data/projects.json';
import skillsData from '../data/skills.json';
import synonyms from '../data/synonyms.json';
import testimonials from '../data/testimonials.json';
import bio from '../data/bio.json';

// Fuse.js configuration
const fuseOptions = { includeScore: true, threshold: 0.3, minMatchCharLength: 2 };

// Fuse instances
const projectFuse = new Fuse(projects, { ...fuseOptions, keys: ['name', 'description', 'problem', 'technologies', 'tags', 'lessons'] });

const skillFuse = new Fuse(
  Object.entries(skillsData).flatMap(([category, items]) =>
    Array.isArray(items) ? items.map(skill => ({ category, skill })) : []
  ),
  { ...fuseOptions, keys: ['skill', 'category'] }
);

const testimonialFuse = new Fuse(testimonials, { ...fuseOptions, keys: ['testimonial', 'name', 'designation', 'company'] });

const bioFuse = new Fuse([
  { type: 'summary', content: bio.summary },
  { type: 'title', content: bio.title },
  { type: 'location', content: bio.location },
  ...(bio.education || []).map(edu => ({ type: 'education', content: `${edu.degree} ${edu.institution} ${edu.year}` })),
  ...(bio.experiences || []).map(exp => ({ type: 'experience', content: `${exp.title} ${exp.company} ${exp.date}` })),
  ...(bio.entrepreneurship || []).map(ent => ({ type: 'entrepreneurship', content: `${ent.startup} ${ent.focus} ${ent.impact}` }))
], { ...fuseOptions, keys: ['content'] });

const synonymFuse = new Fuse(
  Object.entries(synonyms).flatMap(([canonical, variations]) =>
    Array.isArray(variations) ? variations.map(variation => ({ canonical, variation })) : []
  ),
  { ...fuseOptions, keys: ['variation'] }
);

const intentFuse = new Fuse(
  Object.entries(intentMapping).flatMap(([intent, patterns]) =>
    Array.isArray(patterns) ? patterns.map(pattern => ({ intent, pattern })) : []
  ),
  { ...fuseOptions, keys: ['pattern'] }
);

// Utils
const normalizeText = text => text?.toLowerCase().replace(/[^\w\s]/gi, '').trim() || '';

const expandQueryWithSynonyms = query => {
  const normalizedQuery = normalizeText(query);
  const synonymResults = synonymFuse.search(normalizedQuery);
  if (synonymResults.length > 0) {
    return synonymResults.map(r => r.item.canonical).join(' ');
  }
  return query;
};

// Response generators
const generateProjectResponse = project => ({
  text: `✨ ${project.name}\n\n${project.description}\n\n📌 Problem: ${project.problem}\n🔧 Technologies: ${project.technologies.join(', ')}\n📖 Lessons: ${project.lessons.join(', ')}`,
  links: project.links ? [
    project.links.github && { text: "GitHub Repository", url: project.links.github },
    project.links.demo && { text: "Live Demo", url: project.links.demo }
  ].filter(Boolean) : [],
  followUps: [`What challenges did you face on ${project.name}?`, `What was the impact of ${project.name}?`, "Tell me about another project"]
});

const generateSkillResponse = skillItem => ({
  text: `✨ ${skillItem.category.charAt(0).toUpperCase() + skillItem.category.slice(1)} Skills:\n${skillsData[skillItem.category].join(', ')}`,
  followUps: ["Which projects used these technologies?", "What's your experience level with these?", "Do you have DevOps experience?"]
});

const generateTestimonialResponse = t => ({
  text: `"${t.testimonial}"\n\n- ${t.name}, ${t.designation} at ${t.company}`,
  followUps: ["What other testimonials do you have?", "Tell me about your projects", "What are your skills?"]
});

const generateBioResponse = bioItem => {
  let text = '', followUps = [];
  switch (bioItem.type){
    case 'education': text = `🎓 Education: ${bioItem.content}`; followUps = ["What are your technical skills?", "Tell me about your projects"]; break;
    case 'experience': text = `💼 Experience: ${bioItem.content}`; followUps = ["What projects did you work on there?", "What are your skills?"]; break;
    case 'entrepreneurship': text = `🚀 Entrepreneurship: ${bioItem.content}`; followUps = ["What did you learn from this experience?", "What are your technical skills?"]; break;
    default: text = `👋 ${bio.summary}`; followUps = ["What are your technical skills?", "Tell me about your projects", "What's your education background?"];
  }
  return { text, followUps };
};

const generateDefaultResponse = () => ({
  text: "I'm not sure I understand. Could you try asking about my skills, projects, experience, or education?",
  followUps: ["What are your technical skills?", "Tell me about your projects", "What's your startup experience?", "What's your education background?"]
});

const generateFallbackResponse = suggestions => {
  let text = "I'm not sure I understand. Did you mean something about:";
  suggestions.forEach(s => {
    if (s.type === 'project') text += `\n• ${s.item.name} (project)`;
    else if (s.type === 'skill') text += `\n• ${s.item.category} skills`;
  });
  return {
    text,
    followUps: suggestions.slice(0,3).map(s => s.type==='project'?`Tell me about ${s.item.name}`:`What are your ${s.item.category} skills?`)
  };
};

// Main response logic
const generateResponse = query => {
  const normalizedQuery = normalizeText(query);
  const expandedQuery = expandQueryWithSynonyms(normalizedQuery);

  // Small talk
  const smallTalks = ['hi','hello','hey','thanks','thank you','bye','goodbye'];
  if (smallTalks.includes(expandedQuery)){
    if (['hi','hello','hey'].includes(expandedQuery)) return { text:"Hello! I'm Saba, Nati's AI portfolio assistant. How can I help you today?", followUps:["What are Nati's technical skills?", "Tell me about his projects", "What's his startup experience?"] };
    if (expandedQuery.includes('thank')) return { text:"You're welcome! Anything else you'd like to know?", followUps:["What are his strongest technical skills?", "Tell me about his education", "Tell me about his projects"] };
    return { text:"It was nice chatting! Ask me about Nati's skills or projects.", followUps:["What are Nati's technical skills?", "Tell me about his projects", "What's his startup experience?"] };
  }

  // Intent matching
  const intentResults = intentFuse.search(expandedQuery);
  if (intentResults.length && intentResults[0].score < 0.4){
    const intent = intentResults[0].item.intent;
    if (intent==='project_inquiry'){
      const res = projectFuse.search(expandedQuery);
      if (res.length) return generateProjectResponse(res[0].item);
    }
    if (intent==='skill_inquiry'){
      const res = skillFuse.search(expandedQuery);
      if (res.length) return generateSkillResponse(res[0].item);
    }
    return generateDefaultResponse();
  }

  // Fuse across all data
  const allResults = [
    ...projectFuse.search(expandedQuery).map(r=>({type:'project', item:r.item, score:r.score})),
    ...skillFuse.search(expandedQuery).map(r=>({type:'skill', item:r.item, score:r.score})),
    ...testimonialFuse.search(expandedQuery).map(r=>({type:'testimonial', item:r.item, score:r.score})),
    ...bioFuse.search(expandedQuery).map(r=>({type:'bio', item:r.item, score:r.score}))
  ].filter(r => r.item)
   .sort((a,b)=>a.score - b.score);

  if (allResults.length>0 && allResults[0].score < 0.5){
    const best = allResults[0];
    switch(best.type){
      case 'project': return generateProjectResponse(best.item);
      case 'skill': return generateSkillResponse(best.item);
      case 'testimonial': return generateTestimonialResponse(best.item);
      case 'bio': return generateBioResponse(best.item);
    }
  }

  return generateFallbackResponse(allResults.slice(0,3));
};

// Component
const PromptSection = () => {
  const [messages,setMessages] = useState([]);
  const [input,setInput] = useState('');
  const [isTyping,setIsTyping] = useState(false);
  const [suggestions,setSuggestions] = useState([]);
  const [showSuggestions,setShowSuggestions] = useState(false);
  const [placeholderIndex,setPlaceholderIndex] = useState(0);
  const [lastQuery,setLastQuery] = useState('');
  const [isListening,setIsListening] = useState(false);
  const [conversationContext,setConversationContext] = useState({});

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const placeholders = [
    "Which projects used MERN stack?",
    "What problem did MedHub Ethiopia solve?",
    "Does Nati know CI/CD practices?",
    "What are his strongest frontend skills?",
    "Tell me about his startup experience"
  ];

  // Speech recognition
  useEffect(()=>{
    if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous=false;
      recognitionRef.current.interimResults=false;
      recognitionRef.current.lang='en-US';
      recognitionRef.current.onresult = event => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        handleQuery(transcript);
      };
      recognitionRef.current.onend = ()=>setIsListening(false);
      recognitionRef.current.onerror = ()=>setIsListening(false);
    }
  },[]);

  // Keyboard shortcuts
  useEffect(()=>{
    const handleKeyDown = e=>{
      if(e.key==='/' && !e.shiftKey){ e.preventDefault(); inputRef.current?.focus(); }
      else if(e.key==='ArrowUp' && lastQuery && input===''){ e.preventDefault(); setInput(lastQuery); }
    };
    document.addEventListener('keydown',handleKeyDown);
    return ()=>document.removeEventListener('keydown',handleKeyDown);
  },[lastQuery,input]);

  // Rotate placeholders
  useEffect(()=>{
    const interval = setInterval(()=>setPlaceholderIndex(prev=>(prev+1)%placeholders.length),3000);
    return ()=>clearInterval(interval);
  },[]);

  // Scroll messages
  useEffect(()=>{ messagesEndRef.current?.scrollIntoView({behavior:'smooth'}); },[messages]);

  // Suggestions
  useEffect(()=>{
    if(input.length>1){
      const lower=input.toLowerCase();
      const matched=[];
      projectFuse.search(lower).slice(0,2).forEach(r=>matched.push(`Tell me about ${r.item.name}`));
      skillFuse.search(lower).slice(0,2).forEach(r=>matched.push(`What ${r.item.category} skills does Nati have?`));
      setSuggestions(matched);
      setShowSuggestions(matched.length>0);
    } else setShowSuggestions(false);
  },[input]);

  const startListening = ()=>{ recognitionRef.current?.start(); setIsListening(true); };
  const stopListening = ()=>{ recognitionRef.current?.stop(); setIsListening(false); };
  const handleInputChange = e=>setInput(e.target.value);
  const handleSuggestionClick = s=>{ setInput(s); setShowSuggestions(false); handleQuery(s); };
  const handleSubmit = e=>{ e.preventDefault(); if(input.trim()) handleQuery(input); };

  const handleQuery = query=>{
    const userMessage = { sender:'user', text:query };
    setMessages(prev=>[...prev,userMessage]);
    setLastQuery(query);
    setInput('');
    setShowSuggestions(false);
    setIsTyping(true);
    setTimeout(()=>{
      const response = generateResponse(query, conversationContext);
      const sabaMessage = { sender:'saba', ...response };
      setMessages(prev=>[...prev,sabaMessage]);
      setIsTyping(false);
      if(response.context) setConversationContext(prev=>({...prev,...response.context}));
    },500);
  };

  const handleFollowUp = f=>{ setInput(f); handleQuery(f); };

  return (
    <section id="prompt-section" className="min-h-screen bg-gray-900 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden mb-6">
          <div className="h-96 overflow-y-auto p-4 space-y-4">
            {messages.length===0 ? (
              <div className="text-center text-gray-400 py-12">
                <p>Ask me anything about Nati's skills, projects, or experience!</p>
                <p className="text-sm mt-2">Try asking about his technical skills, projects, or background.</p>
              </div>
            ) : messages.map((m,i)=>(
              <div key={i} className={`flex ${m.sender==='user'?'justify-end':'justify-start'}`}>
                <div className={`max-w-xs md:max-w-md rounded-lg p-4 ${m.sender==='user'?'bg-blue-600 text-white':'bg-gray-700 text-gray-100'}`}>
                  {m.text.split('\n').map((line,j)=><p key={j}>{line}</p>)}
                  {m.links?.length>0 && <div className="mt-2">{m.links.map((link,j)=><a key={j} href={link.url} target="_blank" rel="noopener noreferrer" className="inline-block bg-gray-800 hover:bg-gray-900 text-white text-sm px-3 py-1 rounded mr-2 mt-1">{link.text}</a>)}</div>}
                  {m.followUps?.length>0 && <div className="mt-3 pt-3 border-t border-gray-600">
                    <p className="text-sm font-medium mb-2">Follow-up questions:</p>
                    <div className="flex flex-wrap gap-2">{m.followUps.slice(0,3).map((f,j)=><button key={j} onClick={()=>handleFollowUp(f)} className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded">{f}</button>)}</div>
                  </div>}
                </div>
              </div>
            ))}
            {isTyping && <div className="flex justify-start"><div className="bg-gray-700 text-gray-100 rounded-lg p-4"><div className="flex space-x-1"><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0.4s'}}></div></div></div></div>}
            <div ref={messagesEndRef}/>
          </div>
          <div className="border-t border-gray-700 p-4 bg-gray-800">
            <form onSubmit={handleSubmit} className="flex items-center">
              <div className="relative flex-grow">
                <input ref={inputRef} type="text" value={input} onChange={handleInputChange} placeholder={placeholders[placeholderIndex]} className="w-full bg-gray-900 text-white placeholder-gray-500 rounded-l-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" aria-label="Ask a question"/>
                <AnimatePresence>
                  {showSuggestions && <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">{suggestions.map((s,i)=><button key={i} type="button" onClick={()=>handleSuggestionClick(s)} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-white">{s}</button>)}</motion.div>}
                </AnimatePresence>
              </div>
              <button type="button" onClick={isListening?stopListening:startListening} className={`px-3 py-3 ${isListening?'bg-red-500':'bg-gray-700'} text-white`} aria-label={isListening?'Stop listening':'Start voice input'}>{isListening?<MicOff size={20}/>:<Mic size={20}/>}</button>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white rounded-r-lg px-4 py-3" aria-label="Send message"><Send size={20}/></button>
            </form>
            <div className="mt-2 text-xs text-gray-500 flex justify-between"><span>Press / to focus input, ↑ for previous question</span><span>Powered by Saba 🤖</span></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PromptSection;
