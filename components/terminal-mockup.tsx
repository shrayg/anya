"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Maximize2 } from "lucide-react";

import { siteConfig } from "@/config/site";

export const TerminalMockup = () => {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [showResponse, setShowResponse] = useState(false);
  const [displayedResponse, setDisplayedResponse] = useState("");

  const terminalText = `$ npm install ${siteConfig.name}\n✓ Installation complete\n\n$ ${siteConfig.name} --init\nConfiguring OSINT environment...\n✓ Initialized successfully\n\n$ ${siteConfig.name} --help\nUsage: ${siteConfig.name} [command] [options]\n\nCommands:\n  scan      Perform intelligence scan\n  analyze   Analyze collected data\n  export    Export results\n `;
  const responseText = "buy a plan, bum!";

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < terminalText.length) {
        setDisplayedText(terminalText.slice(0, index + 1));
        index++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, 30);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (showResponse) {
      let index = 0;
      const interval = setInterval(() => {
        if (index < responseText.length) {
          setDisplayedResponse(responseText.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
        }
      }, 30);

      return () => clearInterval(interval);
    }
  }, [showResponse]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && userInput.trim()) {
      setShowResponse(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="w-full max-w-4xl mx-auto"
    >
      <div className="backdrop-blur-md border border-white/10 bg-black/40 rounded-lg overflow-hidden shadow-2xl">
        {/* Terminal Header */}
        <div className="bg-black/60 border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500/60"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/60"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/60"></div>
          </div>
          <span className="text-gray-400 text-sm font-mono">{siteConfig.name}</span>

        </div>

        {/* Terminal Content */}
        <div className="px-6 py-4 min-h-80 font-mono text-sm cursor-text" onClick={() => document.getElementById('terminal-input')?.focus()}>
          {isComplete ? (
            <>
              <pre className="text-white/80 whitespace-pre-wrap break-words">
                {displayedText}
              </pre>
              {!showResponse && (
                <div className="text-white/80" onClick={() => document.getElementById('terminal-input')?.focus()}>
                  $&nbsp;
                  <input
                    id="terminal-input"
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="bg-transparent text-white/80 outline-none border-none caret-transparent font-mono text-sm inline absolute opacity-0 pointer-events-none"
                  />
                  <span className="relative">
                    {userInput}
                    <motion.span
                      animate={{ opacity: [1, 0.3] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                      className="text-white/80 inline"
                    >
                      _
                    </motion.span>
                  </span>
                </div>
              )}
              {showResponse && (
                <pre className="text-white/80 whitespace-pre-wrap break-words">
                  $ {userInput}
                  {"\n"}{displayedResponse}
                </pre>
              )}
            </>
          ) : (
            <pre className="text-white/80 whitespace-pre-wrap break-words">
              {displayedText}
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block w-2 h-5 ml-1 bg-cyan-400"
              ></motion.span>
            </pre>
          )}
        </div>

        {/* Terminal Footer */}
        <div className="border-t border-white/10 bg-black/50 px-6 py-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{siteConfig.name}@2026</span>
            <span>Ready</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
