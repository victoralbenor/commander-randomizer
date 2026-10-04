import { useEffect, useState } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase.js';

// Signs in anonymously and returns the current Firebase user (null until ready).
export default function useFirebaseUser() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth).catch((err) => console.error('Authentication Error:', err));
    return onAuthStateChanged(auth, setUser);
  }, []);

  return user;
}
