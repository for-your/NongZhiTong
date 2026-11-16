import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface PillButtonProps {
  children: React.ReactNode;
  href?: string;
  variant?: 'primary' | 'light' | 'outline';
  type?: 'button' | 'submit';
  onClick?: () => void;
  className?: string;
}

const styles = {
  primary: 'bg-brand text-white shadow-lg shadow-brand-deep/15 hover:bg-brand-deep',
  light: 'bg-gold text-ink hover:bg-[#d99a31]',
  outline: 'border border-white/40 text-white hover:border-white hover:bg-white/10',
};

export default function PillButton({ children, href, variant = 'primary', type = 'button', onClick, className = '' }: PillButtonProps) {
  const content = (
    <motion.span
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className={`btn-sheen inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold transition-colors ${styles[variant]} ${className}`}
    >
      {children}
    </motion.span>
  );
  return href ? <Link to={href}>{content}</Link> : <button type={type} onClick={onClick}>{content}</button>;
}
