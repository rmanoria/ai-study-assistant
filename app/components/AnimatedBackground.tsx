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
    <div className="fixed inset-0 -z-10 overflow-hidden bg-black">
      {/* BASE GRADIENT */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.15),transparent_40%),radial-gradient(circle_at_bottom,rgba(168,85,247,0.15),transparent_40%)]" />

      {/* GRID */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "55px 55px",
        }}
      />

      {/* BLUE ORB */}
      <motion.div
        animate={{
          x: [0, 120, -100, 0],
          y: [0, -80, 60, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute top-10 left-10 h-105 w-105 rounded-full bg-blue-500/50 blur-3xl"
      />

      {/* PURPLE ORB */}
      <motion.div
        animate={{
          x: [0, -120, 100, 0],
          y: [0, 80, -60, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 24,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute bottom-0 right-0 h-105 w-105 rounded-full bg-purple-500/50 blur-3xl"
      />

      {/* CYAN LIGHT */}
      <motion.div
        animate={{
          opacity: [0.4, 0.8, 0.4],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
        }}
        className="absolute top-[35%] left-[40%] h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl"
      />

      {/* FLOATING PARTICLES */}
      {particles.map((particle, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 1, 0.2],
          }}
          transition={{
            duration: 3 + i,
            repeat: Infinity,
          }}
          className="absolute h-2 w-2 rounded-full bg-white/80"
          style={{
            top: particle.top,
            left: particle.left,
          }}
        />
      ))}

      {/* DARK OVERLAY */}
      <div className="absolute inset-0 bg-black/25" />
    </div>
  );
}