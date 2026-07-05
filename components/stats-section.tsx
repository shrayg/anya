"use client";

import { motion } from "framer-motion";
import { Database, Users } from "lucide-react";
import ShinyText from "./shiny-text";

export const StatsSection = () => {
  const stats = [
    {
      label: "Database Size",
      value: "342,819,204 billion",
      icon: Database,
    },
    {
      label: "Active Users",
      value: "1",
      icon: Users,
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" },
    },
  };

  return (
    <section className="py-16 px-4 z-20">
      <div className="max-w-6xl mx-auto">
        <ShinyText text="Our Metrics" className="text-4xl md:text-5xl z-20 font-bold text-center mb-12 transition-all ease-in-out" />

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="relative rounded-2xl p-8 backdrop-blur-xl border border-white/10 hover:border-white/20 transition-colors"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <stat.icon className="w-10 h-10 text-white/80" />
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + index * 0.2 }}
                viewport={{ once: true }}
              >
                <ShinyText text={stat.value} className="text-4xl md:text-5xl font-bold mb-2" />
              </motion.div>
              <p className="text-white/60 text-lg">{stat.label}</p>

              {/* Gradient border effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
