// Круглый аватар пользователя
import { Link } from 'react-router-dom';
import type { User } from '../types';

interface UserAvatarProps {
  user: Pick<User, 'id' | 'username' | 'avatar_color'>;
  /** xs: 24, sm: 32, md: 40, lg: 56, xl: 80 */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Если true — оборачивает в ссылку на профиль */
  showLink?: boolean;
  /** Вариант: 'filled' (с фоном) или 'minimal' (только буква, без фона) */
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

export function UserAvatar({ user, size = 'sm', showLink = false, variant = 'minimal', className = '' }: UserAvatarProps) {
  // Минималистичный — только буква с цветным фоном-буквы, без заливки
  const minimalStyles = {
    color: user.avatar_color,
    backgroundColor: 'transparent',
    boxShadow: `inset 0 0 0 2px ${user.avatar_color}22`,
  };

  // Заполненный — круг с фоном
  const filledStyles = {
    color: '#fff',
    backgroundColor: user.avatar_color,
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