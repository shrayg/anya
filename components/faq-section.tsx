"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import ShinyText from "./shiny-text";
import { siteConfig } from "@/config/site";

export const FAQSection = () => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: `What is ${siteConfig.name}?`,
      answer: `${siteConfig.name} is an OSINT trace platform for investigators — breach lookups, platform pivots, AI synthesis, and case filing in one workspace.`,
    },
    {
      question: `How do I get started with ${siteConfig.name}?`,
      answer: "Register on the site, open your dashboard, and launch any module from the sidebar or quick launch grid.",
    },
    {
      question: "Which modules are supported?",
      answer: "Discord, Roblox, breaches, stealer logs, phone/username pivots, leak storage, AI search, and dozens more. New modules ship regularly.",
    },
    {
      question: "Is my data secure?",
      answer: "Sessions are authenticated, searches are scoped to your account, and sensitive results can be filed into private cases.",
    },
    {
      question: `Can I try ${siteConfig.name} for free?`,
      answer: "Yes — free tier includes limited searches. Upgrade anytime for higher quotas and premium modules.",
    },
    {
      question: `What support does ${siteConfig.name} offer?`,
      answer: "Coffee Support on the dashboard, Telegram community, and priority help for paid tiers.",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  return (
    <section className="py-20 px-4 z-20">
      <div className="max-w-4xl mx-auto">
        <ShinyText text="Frequently Asked Questions" className="text-4xl md:text-5xl z-20 font-bold text-center mb-16 transition-all ease-in-out" />

        <motion.div
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {faqs.map((faq, index) => (
            <motion.div key={index} variants={itemVariants}>
              <motion.button
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                className="w-full text-left"
                whileHover={{ scale: 1.01 }}
              >
                <div
                  className="rounded-xl border border-white/10 hover:border-white/20 transition-colors p-6 backdrop-blur-xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                    <motion.div
                      animate={{ rotate: expandedIndex === index ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ChevronDown className="w-5 h-5 text-white/60" />
                    </motion.div>
                  </div>

                  <AnimatePresence>
                    {expandedIndex === index && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <p className="text-white/60 mt-4 pt-4 border-t border-white/10">{faq.answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.button>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
