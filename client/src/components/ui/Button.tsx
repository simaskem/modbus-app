import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'success';
}

export function Button({ variant = 'default', className = '', ...props }: ButtonProps) {
  const variantClass = variant !== 'default' ? `btn-${variant}` : '';
  return <button className={`btn ${variantClass} ${className}`.trim()} {...props} />;
}
