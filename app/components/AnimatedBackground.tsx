"use client";

import { motion } from "framer-motion";

const particles = [
  { top: "8%",  left: "12%" },
  { top: "18%", left: "78%" },
  { top: "32%", left: "58%" },
  { top: "48%", left: "22%" },
  { top: "68%", left: "72%" },
  { top: "83%", left: "38%" },
  { top: "14%", left: "43%" },
  { top: "58%", left: "8%"  },
  { top: "38%", left: "88%" },
  { top: "73%", left: "53%" },
  { top: "28%", left: "33%" },
  { top: "88%", left: "18%" },
  { top: "53%", left: "63%" },
  { top: "11%", left: "90%" },
  { top: "80%", left: "85%" },
  { top: "44%", left: "50%" },
  { top: "62%", left: "30%" },
  { top: "22%", left: "5%"  },
];

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#05050f]">

      {/* ── DEEP BASE GRADIENT ── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.16),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.14),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(6,182,212,0.07),transparent_55%)]" />

      {/* ── SUBTLE GRID ── */}
      <div
        className="absolute inset-0 opacity-[0.032]"
        style={{
          backgroundImage:
            "linear-gradient(to right,rgba(255,255,255,0.2) 1px,transparent 1px)," +
            "linear-gradient(to bottom,rgba(255,255,255,0.2) 1px,transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      {/* ── AURORA BAND ── */}
      <motion.div
        animate={{ opacity: [0.04, 0.09, 0.04], scaleX: [1, 1.08, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[28%] -left-20 right-0 h-px blur-[2px]"
        style={{ background: "linear-gradient(90deg,transparent,rgba(139,92,246,0.5),rgba(6,182,212,0.4),transparent)" }}
      />
      <motion.div
        animate={{ opacity: [0.03, 0.07, 0.03], scaleX: [1, 1.05, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        className="absolute top-[62%] -left-10 right-0 h-px blur-[2px]"
        style={{ background: "linear-gradient(90deg,transparent,rgba(6,182,212,0.35),rgba(99,102,241,0.45),transparent)" }}
      />

      {/* ── MAIN VIOLET ORB ── */}
      <motion.div
        animate={{
          x: [0, 90, -70, 0],
          y: [0, -60, 45, 0],
          scale: [1, 1.12, 0.92, 1],
        }}
        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
        className="absolute -top-10 -left-10 h-120 w-120 rounded-full bg-violet-600/20 blur-[120px]"
      />

      {/* ── INDIGO ORB bottom-right ── */}
      <motion.div
        animate={{
          x: [0, -100, 80, 0],
          y: [0, 65, -45, 0],
          scale: [1, 0.88, 1.08, 1],
        }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        className="absolute -bottom-16 -right-16 h-115 w-115 rounded-full bg-indigo-500/18 blur-[120px]"
      />

      {/* ── CYAN ACCENT center ── */}
      <motion.div
        animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.22, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[38%] left-[42%] h-72 w-72 rounded-full bg-cyan-400/10 blur-[90px]"
      />

      {/* ── SOFT PURPLE FILL top-right ── */}
      <motion.div
        animate={{ opacity: [0.1, 0.22, 0.1], scale: [1, 1.1, 1] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute -top-20 right-[10%] h-80 w-80 rounded-full bg-purple-500/15 blur-[100px]"
      />

      {/* ── FLOATING PARTICLES ── */}
      {particles.map((p, i) => (
        <motion.div
          key={i}
          animate={{
            y:       [0, -(20 + (i % 4) * 8), 0],
            opacity: [0.08, 0.45, 0.08],
            scale:   [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 3.5 + (i % 6) * 0.8,
            repeat: Infinity,
            delay: i * 0.28,
            ease: "easeInOut",
          }}
          className="absolute rounded-full"
          style={{
            top: p.top, left: p.left,
            width:  i % 3 === 0 ? "5px" : i % 3 === 1 ? "3px" : "2px",
            height: i % 3 === 0 ? "5px" : i % 3 === 1 ? "3px" : "2px",
            background: i % 4 === 0
              ? "rgba(167,139,250,0.8)"  // violet
              : i % 4 === 1
              ? "rgba(6,182,212,0.7)"    // cyan
              : i % 4 === 2
              ? "rgba(255,255,255,0.6)"  // white
              : "rgba(99,102,241,0.75)", // indigo
          }}
        />
      ))}

      {/* ── VIGNETTE ── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />

      {/* ── FINAL DARK WASH ── */}
      <div className="absolute inset-0 bg-black/20" />
    </div>
  );
}