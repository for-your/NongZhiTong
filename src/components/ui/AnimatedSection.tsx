import { motion } from 'framer-motion';
import { fadeInUp } from './animationVariants';

export default function AnimatedSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return <motion.div className={className} variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} transition={{ delay }}>{children}</motion.div>;
}
