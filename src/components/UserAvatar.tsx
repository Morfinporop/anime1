// Круглый аватар пользователя с фоновой заливкой случайного цвета
import { Link } from 'react-router-dom';
import type { User } from '../types';

interface UserAvatarProps {
  user: Pick<User, 'id' | 'username' | 'avatar_color'>;
  /** xs: 24, sm: 32, md: 40, lg: 56, xl: 80 */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Если true — оборачивает в ссылку на профиль */
  showLink?: boolean;
  /** Режим: 'filled' — круг с фоном, 'minimal' — только буква с обводкой */
  variant?: 'filled' | 'minimal';
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-2xl',
};

/**
 * Палитра фонов для буквы. Используется если не задан avatar_color
 */
const FALLBACK_PALETTE = [
  '#ef4444', // красный
  '#f97316', // оранжевый
  '#eab308', // желтый
  '#22c55e', // зеленый
  '#3b82f6', // синий
  '#8b5cf6', // фиолетовый
  '#ec4899', // розовый
  '#06b6d4', // голубой
];

function pickBg(color?: string): string {
  if (color) return color;
  // стабильный по username: используем хеш ника
  const idx = Math.abs(user.username.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[idx];
}

export function UserAvatar({ user, size = 'sm', showLink = false, variant = 'filled', className = '' }: UserAvatarProps) {
  const bg = pickBg(user.avatar_color);
  const filledStyles = {
    color: '#ffffff',  // белая буква
    backgroundColor: bg,
  };
  const minimalStyles = {
    color: '#ffffff',  // белая буква
    backgroundColor: bg,
  };

  const avatar = (
    <div
      className={`${SIZE_CLASSES[size]} rounded-full flex items-center justify-center font-bold shrink-0 ${className}`}
      style={variant === 'filled' ? filledStyles : minimalStyles}
      title={user.username}
    >
      {user.username[0]?.toUpperCase()}
    </div>
  );

  if (showLink) {
    return (
      <Link to={`/user/${user.id}`} className="hover:opacity-80 transition shrink-0">
        {avatar}
      </Link>
    );
  }

  return avatar;
}