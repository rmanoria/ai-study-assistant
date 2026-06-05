"use client";

import { motion } from "framer-motion";

const particles = [
  { top: "10%", left: "15%" },
  { top: "20%", left: "80%" },
  { top: "35%", left: "60%" },
  { top: "50%", left: "25%" },
  { top: "70%", left: "75%" },
  { top: "85%", left: "40%" },
  { top: "15%", left: "45%" },
  { top: "60%", left: "10%" },
  { top: "40%", left: "90%" },
  { top: "75%", left: "55%" },
  { top: "30%", left: "35%" },
  { top: "90%", left: "20%" },
  { top: "55%", left: "65%" },
  { top: "12%", left: "92%" },
  { top: "82%", left: "88%" },
];

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#0a0a0f]">
      {/* BASE GRADIENT */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(108,99,255,0.18),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(167,139,250,0.14),transparent_40%)]" />

      {/* GRID */}
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* VIOLET ORB */}
      <motion.div
        animate={{
          x: [0, 100, -80, 0],
          y: [0, -70, 50, 0],
          scale: [1, 1.15, 0.9, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        className="absolute top-10 left-10 h-96 w-96 rounded-full bg-violet-600/30 blur-[100px]"
      />

      {/* INDIGO ORB */}
      <motion.div
        animate={{
          x: [0, -110, 90, 0],
          y: [0, 70, -50, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-500/25 blur-[100px]"
      />

      {/* CYAN PULSE */}
      <motion.div
        animate={{ opacity: [0.3, 0.65, 0.3], scale: [1, 1.25, 1] }}
        transition={{ duration: 7, repeat: Infinity }}
        className="absolute top-[40%] left-[45%] h-64 w-64 rounded-full bg-cyan-400/15 blur-[80px]"
      />

      {/* FLOATING PARTICLES */}
      {particles.map((p, i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -28, 0], opacity: [0.15, 0.6, 0.15] }}
          transition={{ duration: 3 + (i % 5), repeat: Infinity, delay: i * 0.3 }}
          className="absolute h-1.5 w-1.5 rounded-full bg-white/70"
          style={{ top: p.top, left: p.left }}
        />
      ))}

      {/* DARK OVERLAY */}
      <div className="absolute inset-0 bg-black/30" />
    </div>
  );
}
