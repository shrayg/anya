"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Plus } from "lucide-react";

import { siteConfig } from "@/config/site";

const faqs = [
  {
    question: `What is ${siteConfig.name}?`,
    answer: `${siteConfig.name} is an OSINT intelligence platform for authorized investigators. It combines exposure search, identity and platform pivots, public records, network intelligence, AI synthesis, and case management in one workspace.`,
  },
  {
    question: "How does a search become a case?",
    answer:
      "Run a search from the homepage or full panel, review the returned signals, and attach the useful results to a dossier. Cases keep targets, linked searches, notes, and collected intelligence together.",
  },
  {
    question: "Which intelligence modules are supported?",
    answer:
      "The live catalog covers AI briefs, breach and stealer indexes, identity, public records, network, financial assets, gaming and social platforms, and dating-profile pivots. Module health is monitored inside the product.",
  },
  {
    question: "How are access and sensitive results handled?",
    answer:
      "Sessions are authenticated, module access is plan-gated, sensitive free-tier results can be masked, and searches remain scoped to the account that ran them. Lawful-use and safety controls are part of the workflow.",
  },
  {
    question: `Can I try ${siteConfig.name} before upgrading?`,
    answer:
      "Yes. The Free and Starter experiences support focused homepage searches. Professional unlocks the full investigation panel, and higher tiers expand quotas and AI access.",
  },
  {
    question: "Where can I get help?",
    answer: `Email ${siteConfig.links.supportEmail} for billing and account help, check the live status page for provider availability, or reach the Telegram community for quick questions.`,
  },
];

export const FAQSection = () => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  return (
    <div className="landing-faq">
      <div className="landing-faq-heading">
        <h2>Answers without the runaround.</h2>
        <p>The essentials about access, workflow, security, and support.</p>
      </div>

      <div className="landing-faq-list">
        {faqs.map((faq, index) => {
          const open = expandedIndex === index;
          const answerId = `landing-faq-answer-${index}`;

          return (
            <motion.div
              key={faq.question}
              className="landing-faq-item"
              initial={{ opacity: 0 }}
              transition={{ duration: 0.5, delay: index * 0.035 }}
              viewport={{ once: true, margin: "-8%" }}
              whileInView={{ opacity: 1 }}
            >
              <button
                aria-controls={answerId}
                aria-expanded={open}
                type="button"
                onClick={() => setExpandedIndex(open ? null : index)}
              >
                <span>{faq.question}</span>
                <motion.i animate={{ rotate: open ? 45 : 0 }}>
                  <Plus className="size-5" />
                </motion.i>
              </button>

              <AnimatePresence initial={false}>
                {open ? (
                  <motion.div
                    animate={{ height: "auto", opacity: 1 }}
                    className="landing-faq-answer"
                    exit={{ height: 0, opacity: 0 }}
                    id={answerId}
                    initial={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p>{faq.answer}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
