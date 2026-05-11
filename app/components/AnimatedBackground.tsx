"use client";

import { motion } from "framer-motion";

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-black">
      <motion.div
        animate={{
          x: [0, 100, -100, 0],
          y: [0, -50, 50, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute top-20 left-20 h-72 w-72 rounded-full bg-blue-500/30 blur-3xl"
      />

      <motion.div
        animate={{
          x: [0, -100, 100, 0],
          y: [0, 50, -50, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-purple-500/30 blur-3xl"
      />
    </div>
  );
}