import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { useAuth } from './context';
export function AccountAvatar() {
  const { profile } = useAuth();
  const photo = profile?.photoURL?.startsWith('https://') ? profile.photoURL : null;
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  return (
    <span className="account-avatar" aria-hidden="true">
      {photo && photo !== failedPhoto ? (
        <img
          src={photo}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedPhoto(photo)}
        />
      ) : (
        <UserRound size={22} />
      )}
    </span>
  );
}
