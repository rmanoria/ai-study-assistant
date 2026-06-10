"use client";

import { motion } from "framer-motion";

const particles = [
  { top: "8%",  left: "12%" }, { top: "18%", left: "78%" },
  { top: "32%", left: "58%" }, { top: "48%", left: "22%" },
  { top: "68%", left: "72%" }, { top: "83%", left: "38%" },
  { top: "14%", left: "43%" }, { top: "58%", left: "8%"  },
  { top: "38%", left: "88%" }, { top: "73%", left: "53%" },
  { top: "28%", left: "33%" }, { top: "88%", left: "18%" },
  { top: "53%", left: "63%" }, { top: "11%", left: "90%" },
];

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#070711]">
      {/* Base gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(124,90,240,0.14),transparent_52%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.10),transparent_52%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.06),transparent_55%)]" />

      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(to right,rgba(255,255,255,0.3) 1px,transparent 1px)," +
            "linear-gradient(to bottom,rgba(255,255,255,0.3) 1px,transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Main violet orb */}
      <motion.div
        animate={{ x: [0, 80, -60, 0], y: [0, -50, 40, 0], scale: [1, 1.1, 0.93, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
        className="absolute -top-16 -left-16 h-120 w-120 rounded-full bg-violet-600/15 blur-[120px]"
      />

      {/* Indigo orb */}
      <motion.div
        animate={{ x: [0, -90, 70, 0], y: [0, 60, -40, 0], scale: [1, 0.9, 1.08, 1] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute -bottom-20 -right-20 h-115 w-115 rounded-full bg-indigo-500/12 blur-[120px]"
      />

      {/* Cyan accent */}
      <motion.div
        animate={{ opacity: [0.18, 0.42, 0.18], scale: [1, 1.18, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[40%] left-[45%] h-64 w-64 rounded-full bg-cyan-400/8 blur-[80px]"
      />

      {/* Floating particles */}
      {particles.map((p, i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -(18 + (i % 4) * 7), 0], opacity: [0.06, 0.4, 0.06], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 3.5 + (i % 5) * 0.9, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
          className="absolute rounded-full"
          style={{
            top: p.top, left: p.left,
            width:  i % 3 === 0 ? "4px" : "2px",
            height: i % 3 === 0 ? "4px" : "2px",
            background: i % 4 === 0 ? "rgba(167,139,250,0.7)" : i % 4 === 1 ? "rgba(34,211,238,0.6)" : i % 4 === 2 ? "rgba(255,255,255,0.5)" : "rgba(99,102,241,0.65)",
          }}
        />
      ))}

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(0,0,0,0.5)_100%)]" />
      <div className="absolute inset-0 bg-black/15" />
    </div>
  );
}
