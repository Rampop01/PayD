import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';

interface HelpLinkProps {
  topic?: string;
  section?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'text' | 'icon-text';
}

const sizeClasses = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const textSizeClasses = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
};

export function HelpLink({
  topic,
  section,
  className = '',
  size = 'md',
  variant = 'icon',
}: HelpLinkProps) {
  const helpPath = topic
    ? `/help?q=${encodeURIComponent(topic)}`
    : section
      ? `/help#${section}`
      : '/help';

  const baseClasses =
    'inline-flex items-center gap-1 text-muted hover:text-accent transition-colors';

  if (variant === 'icon') {
    return (
      <Link to={helpPath} className={`${baseClasses} ${className}`} title="Get help">
        <HelpCircle className={sizeClasses[size]} />
      </Link>
    );
  }

  if (variant === 'text') {
    return (
      <Link to={helpPath} className={`${baseClasses} ${textSizeClasses[size]} ${className}`}>
        Help
      </Link>
    );
  }

  return (
    <Link to={helpPath} className={`${baseClasses} ${textSizeClasses[size]} ${className}`}>
      <HelpCircle className={sizeClasses[size]} />
      <span>Help</span>
    </Link>
  );
}

interface ContextHelpProps {
  topic: string;
  className?: string;
}

export function ContextHelp({ topic, className = '' }: ContextHelpProps) {
  return (
    <Link
      to={`/help?q=${encodeURIComponent(topic)}`}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface-hi border border-border-hi text-muted hover:text-accent hover:border-accent transition-colors ${className}`}
      title={`Get help with: ${topic}`}
    >
      <HelpCircle className="w-3 h-3" />
    </Link>
  );
}
