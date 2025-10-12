import { UserButton } from '@clerk/nextjs';

export default function UserButtonPage() {
  return <UserButton fallbackRedirectUrl="/" />;
}